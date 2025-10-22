# Fix Teams Migration Error

## Error

```
ERROR: 42703: column "timezone" of relation "teams" does not exist
```

## Root Cause

The `teams` table was partially created from a previous migration run. When the migration ran again with `CREATE TABLE IF NOT EXISTS`, it skipped creation, leaving the table without the required columns (`timezone`, `color`, etc.).

## Solution

Run the following SQL to add all missing columns:

```sql
-- Add timezone column if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' 
    AND column_name = 'timezone'
  ) THEN
    ALTER TABLE teams ADD COLUMN timezone TEXT DEFAULT 'UTC';
  END IF;
END $$;

-- Add color column if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'teams' 
    AND column_name = 'color'
  ) THEN
    ALTER TABLE teams ADD COLUMN color TEXT DEFAULT '#3B82F6';
  END IF;
END $$;

-- Update timezone to be NOT NULL
ALTER TABLE teams ALTER COLUMN timezone SET NOT NULL;

-- Add comments
COMMENT ON COLUMN teams.timezone IS 'IANA timezone identifier (e.g., America/New_York)';
COMMENT ON COLUMN teams.color IS 'Hex color for UI differentiation';
```

## Quick Fix

### Option 1: Run the Fix Migration (Recommended)

```bash
# In Supabase SQL Editor, run:
# extra_feature_desktop/migrations/006_fix_teams_columns.sql
```

### Option 2: Drop and Recreate (Clean Slate)

If you have no important data in the teams table yet:

```sql
-- Drop existing table and related objects
DROP TABLE IF EXISTS team_repositories CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- Then re-run migration 004_teams_feature.sql completely
```

## Verification

After applying the fix, verify the columns exist:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'teams'
ORDER BY ordinal_position;
```

You should see:
- `id` (uuid)
- `name` (text)
- `description` (text)
- `timezone` (text, NOT NULL)
- `color` (text)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

## Next Steps

1. Run the fix migration above
2. Restart your Electron app
3. Try creating a team - should work now!

