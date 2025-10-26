# Fix: Teams Showing Under "General"

## Problem
All teams are appearing under "General" because:
1. ✅ **FIXED**: Backend wasn't fetching the `department` field
2. ⚠️ **TO FIX**: Teams in database might not have `department` values set

## Solution

### Step 1: Backend Fix ✅
Already applied - added `department` to the select query:
```javascript
.select('id, name, description, slug, department')
```

### Step 2: Set Department Values in Database

You need to assign departments to your teams in Supabase. Here are your options:

#### Option A: Manual Assignment (Recommended)
1. Open Supabase SQL Editor
2. Run the queries in `SET_TEAM_DEPARTMENTS.sql`
3. Modify the patterns to match your actual team names

#### Option B: Quick Script
Run this to see your current teams:
```sql
SELECT id, name, slug, department FROM teams ORDER BY name;
```

Then update specific teams:
```sql
-- Update individual teams
UPDATE teams SET department = 'Engineering' WHERE name = 'eng-desktop-puerto_rico-alice';
UPDATE teams SET department = 'Engineering' WHERE name = 'eng-mobile-team';
UPDATE teams SET department = 'Sales' WHERE name = 'sales-enterprise-team';
```

#### Option C: Bulk Update by Pattern
If your team names follow a pattern (e.g., start with 'eng-', 'sales-', etc.):
```sql
-- Pattern-based updates
UPDATE teams SET department = 'Engineering' WHERE name LIKE 'eng-%';
UPDATE teams SET department = 'Sales' WHERE name LIKE 'sales-%';
UPDATE teams SET department = 'Product' WHERE name LIKE 'product-%';
```

### Step 3: Restart the App
After updating the database:
1. Restart your desktop app
2. Switch to Team mode
3. You should now see teams grouped by their departments!

## Expected Result

Before:
```
General
├── eng-desktop-puerto_rico-alice
├── eng-mobile-team
├── sales-enterprise-team
└── product-design-team
```

After:
```
Engineering
├── eng-desktop-puerto_rico-alice
└── eng-mobile-team

Sales
└── sales-enterprise-team

Product
└── product-design-team
```

## Common Department Names

Here are some common department names you might want to use:
- **Engineering** - Development, DevOps, QA teams
- **Product** - Product management, design teams
- **Sales** - Sales, account management teams
- **Marketing** - Marketing, content, growth teams
- **Customer Success** - Support, success, training teams
- **Operations** - HR, finance, admin teams
- **General** - Mixed or temporary teams

## Verify It Worked

After updating, run this query to see the distribution:
```sql
SELECT 
  department, 
  COUNT(*) as team_count, 
  array_agg(name ORDER BY name) as team_names
FROM teams 
GROUP BY department
ORDER BY department;
```

You should see output like:
```
department    | team_count | team_names
--------------+------------+----------------------------------
Engineering   | 2          | {eng-desktop-..., eng-mobile-...}
Sales         | 1          | {sales-enterprise-team}
Product       | 1          | {product-design-team}
```

---

**Note**: If teams still show under "General" after updating the database, make sure to restart the desktop app to clear the cached data.


