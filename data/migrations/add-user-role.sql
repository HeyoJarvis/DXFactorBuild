-- Add user_role field to users table
-- This allows users to choose between 'developer' and 'sales' roles

-- First, check if the enum type exists, if not create it
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('developer', 'sales');
  END IF;
END $$;

-- Add user_role column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'user_role'
  ) THEN
    ALTER TABLE users ADD COLUMN user_role user_role DEFAULT NULL;
    COMMENT ON COLUMN users.user_role IS 'User role: developer or sales';
  END IF;
END $$;

-- Add index for faster role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(user_role);

-- Update existing users to NULL role (they'll be prompted to choose)
-- UPDATE users SET user_role = NULL WHERE user_role IS NULL;

COMMENT ON TABLE users IS 'Users table with role-based feature access';

