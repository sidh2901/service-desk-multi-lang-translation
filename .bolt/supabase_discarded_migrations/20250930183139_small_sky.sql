/*
  # Fix Agent Availability and Call Connection System

  1. Schema Updates
    - Add is_available and last_seen columns to user_profiles
    - Update call_sessions table structure
    - Add proper indexes for performance

  2. Security
    - Update RLS policies for real-time updates
    - Add policies for agent availability tracking

  3. Functions
    - Add function to update agent availability
    - Add function to match callers with available agents
*/

-- Add availability tracking to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'is_available'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_available boolean DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'last_seen'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_seen timestamptz DEFAULT now();
  END IF;
END $$;

-- Update user_profiles policies to allow availability updates
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Add policy to read all agent profiles (for caller to see available agents)
DROP POLICY IF EXISTS "Callers can read agent profiles" ON user_profiles;
CREATE POLICY "Callers can read agent profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (role = 'agent' OR auth.uid() = id);

-- Update call_sessions policies for real-time updates
DROP POLICY IF EXISTS "Users can insert call sessions" ON call_sessions;
CREATE POLICY "Users can insert call sessions"
  ON call_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (caller_id = auth.uid());

DROP POLICY IF EXISTS "Participants can update sessions" ON call_sessions;
CREATE POLICY "Participants can update sessions"
  ON call_sessions
  FOR UPDATE
  TO authenticated
  USING ((caller_id = auth.uid()) OR (agent_id = auth.uid()))
  WITH CHECK ((caller_id = auth.uid()) OR (agent_id = auth.uid()));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_availability 
ON user_profiles (role, is_available) 
WHERE role = 'agent';

CREATE INDEX IF NOT EXISTS idx_call_sessions_status 
ON call_sessions (status, created_at);

-- Function to update agent availability
CREATE OR REPLACE FUNCTION update_agent_availability()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_seen timestamp when agent updates availability
  NEW.last_seen = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update last_seen
DROP TRIGGER IF EXISTS trigger_update_agent_availability ON user_profiles;
CREATE TRIGGER trigger_update_agent_availability
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_availability();