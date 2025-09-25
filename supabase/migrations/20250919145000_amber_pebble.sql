/*
  # Create call_sessions table

  1. New Tables
    - `call_sessions`
      - `id` (uuid, primary key)
      - `caller_id` (uuid, references user_profiles)
      - `agent_id` (uuid, references user_profiles, nullable)
      - `status` (text, check constraint for valid statuses)
      - `caller_language` (text, not null)
      - `agent_language` (text, nullable)
      - `started_at` (timestamptz, default now())
      - `ended_at` (timestamptz, nullable)
      - `duration` (integer, nullable)

  2. Security
    - Enable RLS on `call_sessions` table
    - Add policy for callers to read their own sessions
    - Add policy for agents to read sessions assigned to them
    - Add policy for authenticated users to insert sessions
    - Add policy for participants to update sessions
*/

-- Create call_sessions table
CREATE TABLE IF NOT EXISTS public.call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'ringing', 'connected', 'ended')),
  caller_language text NOT NULL,
  agent_language text,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  duration integer
);

-- Enable Row Level Security
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Callers can read own sessions"
  ON public.call_sessions
  FOR SELECT
  TO authenticated
  USING (caller_id = auth.uid());

CREATE POLICY "Agents can read assigned sessions"
  ON public.call_sessions
  FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Users can insert call sessions"
  ON public.call_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (caller_id = auth.uid());

CREATE POLICY "Participants can update sessions"
  ON public.call_sessions
  FOR UPDATE
  TO authenticated
  USING (caller_id = auth.uid() OR agent_id = auth.uid())
  WITH CHECK (caller_id = auth.uid() OR agent_id = auth.uid());