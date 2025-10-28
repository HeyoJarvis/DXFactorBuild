-- Run this in Supabase SQL Editor to see your current teams
SELECT id, name, slug, department
FROM teams
ORDER BY name;

-- See department distribution
SELECT
  COALESCE(department, 'NULL') as department,
  COUNT(*) as team_count,
  array_agg(name ORDER BY name) as team_names
FROM teams
GROUP BY department
ORDER BY department;
