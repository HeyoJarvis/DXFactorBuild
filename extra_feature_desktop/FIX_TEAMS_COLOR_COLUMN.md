# Fix: Add Color Column to Teams Table

## Issue

The Teams feature frontend includes a color picker, but the database schema was missing the `color` column, causing this error:

```
Could not find the 'color' column of 'teams' in the schema cache
```

## Solution

A new migration has been created to add the missing column.

## How to Apply the Fix

### Option 1: Run the Migration SQL (Recommended)

Execute the migration file against your Supabase database:

```bash
# If you have psql access to your Supabase database
psql $DATABASE_URL -f extra_feature_desktop/migrations/005_add_color_to_teams.sql
```

### Option 2: Run via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Paste and execute this SQL:

```sql
-- Add color column if it doesn't exist
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6';

-- Add comment for documentation
COMMENT ON COLUMN teams.color IS 'Hex color code for UI differentiation of teams';
```

### Option 3: Use Supabase Client (Programmatic)

Run this script to add the column:

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // Need service role key for schema changes
);

async function addColorColumn() {
  const { error } = await supabase.rpc('exec', {
    sql: `ALTER TABLE teams ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6';`
  });
  
  if (error) {
    console.error('Error adding column:', error);
  } else {
    console.log('✅ Color column added successfully!');
  }
}

addColorColumn();
```

## Verify the Fix

After applying the migration, restart your Electron app and try creating a team again. The color picker should now work correctly.

## Files Updated

1. **`migrations/004_teams_feature.sql`** - Updated to include `color` column for future fresh installs
2. **`migrations/005_add_color_to_teams.sql`** - New migration to add column to existing databases

## Default Color

The default color is set to `#3B82F6` (blue), but users can select any color from the color picker when creating or editing teams.

