-- SQL to check and set department values for teams
-- Run this in your Supabase SQL Editor

-- 1. First, check which teams don't have departments
SELECT id, name, slug, department 
FROM teams 
ORDER BY name;

-- 2. Update teams to assign departments based on their names
-- (Modify these based on your actual team names)

-- Example: Engineering teams
UPDATE teams 
SET department = 'Engineering'
WHERE name LIKE 'eng-%' 
   OR name ILIKE '%engineering%'
   OR slug LIKE 'eng-%';

-- Example: Sales teams
UPDATE teams 
SET department = 'Sales'
WHERE name LIKE 'sales-%' 
   OR name ILIKE '%sales%'
   OR slug LIKE 'sales-%';

-- Example: Product teams
UPDATE teams 
SET department = 'Product'
WHERE name LIKE 'product-%' 
   OR name ILIKE '%product%'
   OR slug LIKE 'product-%';

-- Example: Marketing teams
UPDATE teams 
SET department = 'Marketing'
WHERE name LIKE 'marketing-%' 
   OR name ILIKE '%marketing%'
   OR slug LIKE 'marketing-%';

-- Example: Customer Success teams
UPDATE teams 
SET department = 'Customer Success'
WHERE name LIKE 'cs-%' 
   OR name ILIKE '%customer%'
   OR slug LIKE 'cs-%';

-- 3. Set a default department for any remaining teams without one
UPDATE teams 
SET department = 'General'
WHERE department IS NULL OR department = '';

-- 4. Verify the changes
SELECT department, COUNT(*) as team_count, array_agg(name) as team_names
FROM teams 
GROUP BY department
ORDER BY department;


