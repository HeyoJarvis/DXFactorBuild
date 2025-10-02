-- Force Supabase Schema Cache Refresh
-- Run this in Supabase SQL Editor to force a cache reload

-- Create a simple dummy function that will trigger cache refresh
CREATE OR REPLACE FUNCTION ping_cache()
RETURNS TEXT AS $$
BEGIN
  RETURN 'cache refreshed at ' || NOW()::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Call it once
SELECT ping_cache();

-- Grant permissions
GRANT EXECUTE ON FUNCTION ping_cache() TO authenticated, anon;

-- Success message
SELECT 'Schema cache has been refreshed! Wait 10 seconds and try again.' AS message;

