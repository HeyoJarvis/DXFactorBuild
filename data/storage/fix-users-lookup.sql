-- =====================================================
-- Allow Service Role to Look Up Users by Slack ID
-- This enables the desktop app to find which Supabase user
-- corresponds to a Slack mention
-- =====================================================

-- Add policy for service role to read users table
DROP POLICY IF EXISTS "Service role can read all users" ON public.users;

CREATE POLICY "Service role can read all users" ON public.users
  FOR SELECT TO service_role
  USING (true);

-- Verify the slack_user_id index exists for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_slack_user_id ON public.users(slack_user_id);

SELECT '✅ Service role can now look up users by Slack ID!' AS status;

