-- Update Avi's Slack user ID from old bot to new bot
-- Old ID: U09GJSJLDNW (from old Slack bot)
-- New ID: U09G4EL2CHM (from new hj2 Slack bot)

UPDATE public.users
SET slack_user_id = 'U09G4EL2CHM'
WHERE email = 'avi@heyjarvis.ai'
  OR slack_user_id = 'U09GJSJLDNW';

-- Verify the update
SELECT id, email, name, slack_user_id, slack_team_id
FROM public.users
WHERE email = 'avi@heyjarvis.ai';
