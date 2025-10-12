-- Fix user_role enum type
-- The enum might already exist with different values, so we need to recreate it

-- Step 1: Drop the column if it exists (to remove dependency)
ALTER TABLE users DROP COLUMN IF EXISTS user_role;

-- Step 2: Drop the old enum type if it exists
DROP TYPE IF EXISTS user_role;

-- Step 3: Create the enum type with correct values
CREATE TYPE user_role AS ENUM ('developer', 'sales');

-- Step 4: Add the column back with the correct enum type
ALTER TABLE users ADD COLUMN user_role user_role DEFAULT NULL;

-- Step 5: Add comment
COMMENT ON COLUMN users.user_role IS 'User role: developer or sales';

-- Step 6: Add index for faster role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(user_role);

COMMENT ON TABLE users IS 'Users table with role-based feature access';

