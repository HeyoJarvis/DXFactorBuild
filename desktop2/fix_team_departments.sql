-- Fix Team Departments
-- Update this SQL with your actual team names and desired departments

-- Option 1: Update by pattern (if your team names follow a convention)
-- Uncomment and modify these lines based on your team naming patterns:

-- UPDATE teams SET department = 'Engineering' WHERE name LIKE 'eng-%' OR name LIKE 'dev-%';
-- UPDATE teams SET department = 'Product' WHERE name LIKE 'product-%' OR name LIKE 'design-%';
-- UPDATE teams SET department = 'Sales' WHERE name LIKE 'sales-%';
-- UPDATE teams SET department = 'Marketing' WHERE name LIKE 'marketing-%';
-- UPDATE teams SET department = 'Customer Success' WHERE name LIKE 'support-%' OR name LIKE 'success-%';

-- Option 2: Update individual teams
-- Replace 'team-name-here' with your actual team names:

-- UPDATE teams SET department = 'Engineering' WHERE name = 'team-name-here';
-- UPDATE teams SET department = 'Engineering' WHERE name = 'another-team';
-- UPDATE teams SET department = 'Product' WHERE name = 'product-team';
-- UPDATE teams SET department = 'Sales' WHERE name = 'sales-team';

-- After running your updates, verify the results:
SELECT
  COALESCE(department, 'No Department Set') as department,
  COUNT(*) as team_count,
  array_agg(name ORDER BY name) as team_names
FROM teams
GROUP BY department
ORDER BY department;
