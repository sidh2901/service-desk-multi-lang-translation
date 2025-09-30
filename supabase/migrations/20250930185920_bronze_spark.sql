/*
  # Fix Agent Availability and Call Connection System

  1. Schema Updates
    - Add `is_available` and `last_seen` columns to `user_profiles`
    - Update `call_sessions` table structure
    - Add proper indexes for performance

  2. Security
    - Update RLS policies for real-time updates
    - Add policies for agent availability tracking

  3. Functions
    - Add function to update agent availability
    - Add function to match callers with available agents
*/

-- Add missing columns to user_profiles if they don't exist
DO $$ 
BEGIN
  -- Add is_available column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'is_available'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_available boolean DEFAULT true;
  END IF;

  -- Add last_seen column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'last_seen'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_seen timestamptz DEFAULT now();
  END IF;
END $$;

-- Update existing agent profiles to be available by default
UPDATE user_profiles 
SET is_available = true, last_seen = now() 
WHERE role = 'agent' AND (is_available IS NULL OR last_seen IS NULL);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_availability 
ON user_profiles (role, is_available) 
WHERE role = 'agent';

CREATE INDEX IF NOT EXISTS idx_user_profiles_last_seen 
ON user_profiles (last_seen) 
WHERE role = 'agent';

CREATE INDEX IF NOT EXISTS idx_call_sessions_status 
ON call_sessions (status);

CREATE INDEX IF NOT EXISTS idx_call_sessions_caller_agent 
ON call_sessions (caller_id, agent_id);

-- Update RLS policies for better real-time functionality

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Recreate policies with better permissions
CREATE POLICY "Users can read own profile" 
ON user_profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Callers can read agent profiles" 
ON user_profiles FOR SELECT 
TO authenticated 
USING (role = 'agent' OR auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON user_profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
ON user_profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- Update call session policies for better real-time updates
DROP POLICY IF EXISTS "Callers can read own sessions" ON call_sessions;
DROP POLICY IF EXISTS "Agents can read assigned sessions" ON call_sessions;
DROP POLICY IF EXISTS "Participants can update sessions" ON call_sessions;
DROP POLICY IF EXISTS "Users can insert call sessions" ON call_sessions;

CREATE POLICY "Callers can read own sessions" 
ON call_sessions FOR SELECT 
TO authenticated 
USING (caller_id = auth.uid());

CREATE POLICY "Agents can read assigned sessions" 
ON call_sessions FOR SELECT 
TO authenticated 
USING (agent_id = auth.uid());

CREATE POLICY "Agents can read waiting sessions" 
ON call_sessions FOR SELECT 
TO authenticated 
USING (
  status = 'waiting' AND 
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role = 'agent' AND is_available = true
  )
);

CREATE POLICY "Participants can update sessions" 
ON call_sessions FOR UPDATE 
TO authenticated 
USING (caller_id = auth.uid() OR agent_id = auth.uid()) 
WITH CHECK (caller_id = auth.uid() OR agent_id = auth.uid());

CREATE POLICY "Agents can claim waiting sessions" 
ON call_sessions FOR UPDATE 
TO authenticated 
USING (
  status = 'waiting' AND agent_id IS NULL AND
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = auth.uid() AND role = 'agent' AND is_available = true
  )
) 
WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Users can insert call sessions" 
ON call_sessions FOR INSERT 
TO authenticated 
WITH CHECK (caller_id = auth.uid());

-- Function to update agent availability with automatic last_seen update
CREATE OR REPLACE FUNCTION update_agent_availability()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically update last_seen when is_available changes
  IF OLD.is_available IS DISTINCT FROM NEW.is_available THEN
    NEW.last_seen = now();
  END IF;
  
  -- Update last_seen when explicitly updated
  IF OLD.last_seen IS DISTINCT FROM NEW.last_seen THEN
    NEW.last_seen = COALESCE(NEW.last_seen, now());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic availability updates
DROP TRIGGER IF EXISTS trigger_update_agent_availability ON user_profiles;
CREATE TRIGGER trigger_update_agent_availability
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  WHEN (OLD.role = 'agent')
  EXECUTE FUNCTION update_agent_availability();

-- Function to find available agents for a caller
CREATE OR REPLACE FUNCTION find_available_agents(caller_language text DEFAULT NULL)
RETURNS TABLE (
  agent_id uuid,
  agent_name text,
  agent_email text,
  agent_language text,
  last_seen timestamptz,
  is_available boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.id,
    up.name,
    up.email,
    up.language,
    up.last_seen,
    up.is_available
  FROM user_profiles up
  WHERE up.role = 'agent'
    AND up.is_available = true
    AND up.last_seen > (now() - interval '5 minutes')
  ORDER BY 
    CASE WHEN caller_language IS NOT NULL AND up.language = caller_language THEN 1 ELSE 2 END,
    up.last_seen DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION find_available_agents TO authenticated;

-- Function to automatically match caller with agent
CREATE OR REPLACE FUNCTION auto_assign_agent(session_id uuid)
RETURNS boolean AS $$
DECLARE
  session_record call_sessions;
  available_agent_id uuid;
BEGIN
  -- Get the session details
  SELECT * INTO session_record FROM call_sessions WHERE id = session_id;
  
  IF NOT FOUND OR session_record.status != 'waiting' THEN
    RETURN false;
  END IF;
  
  -- Find an available agent
  SELECT agent_id INTO available_agent_id 
  FROM find_available_agents(session_record.caller_language) 
  LIMIT 1;
  
  IF available_agent_id IS NOT NULL THEN
    -- Assign the agent to the session
    UPDATE call_sessions 
    SET agent_id = available_agent_id, 
        status = 'ringing',
        agent_language = (
          SELECT language FROM user_profiles WHERE id = available_agent_id
        )
    WHERE id = session_id AND status = 'waiting';
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auto_assign_agent TO authenticated;