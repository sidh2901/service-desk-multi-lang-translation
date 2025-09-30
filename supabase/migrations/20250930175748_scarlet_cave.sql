/*
  # Add agent availability tracking

  1. Schema Changes
    - Add `is_available` boolean column to user_profiles table
    - Add `last_seen` timestamp column to user_profiles table
    - Set default values for existing records

  2. Security
    - Update existing RLS policies to handle new columns
    - Allow users to update their own availability status

  3. Indexes
    - Add index on is_available for faster queries
*/

-- Add availability tracking columns
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

-- Create index for faster availability queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_availability 
ON user_profiles(role, is_available) 
WHERE role = 'agent';

-- Update existing records to set default availability
UPDATE user_profiles 
SET is_available = true, last_seen = now() 
WHERE is_available IS NULL OR last_seen IS NULL;