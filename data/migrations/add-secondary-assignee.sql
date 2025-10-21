-- Add secondary assignee support to tasks table
-- This allows non-dev team members to assign themselves to JIRA tickets
-- while preserving the original JIRA assignee (usually a developer)

-- Add secondary_assignee column
ALTER TABLE public.tasks 
  ADD COLUMN IF NOT EXISTS secondary_assignee UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_tasks_secondary_assignee ON public.tasks(secondary_assignee);

-- Add comment for documentation
COMMENT ON COLUMN public.tasks.secondary_assignee IS 'Non-dev team member assigned to track/manage this ticket (e.g., PM, Sales, Support)';

-- Update RLS policies to include secondary assignee
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can view assigned or secondary assigned tasks" ON public.tasks;

-- Create new policy that includes secondary assignee
CREATE POLICY "Users can view assigned or secondary assigned tasks" ON public.tasks
  FOR SELECT
  USING (
    auth.uid() = assigned_to OR 
    auth.uid() = secondary_assignee OR 
    auth.uid() = created_by
  );

-- Update policy for updates
DROP POLICY IF EXISTS "Users can update assigned or secondary assigned tasks" ON public.tasks;

CREATE POLICY "Users can update assigned or secondary assigned tasks" ON public.tasks
  FOR UPDATE
  USING (
    auth.uid() = assigned_to OR 
    auth.uid() = secondary_assignee OR 
    auth.uid() = created_by
  );

-- Migration complete
-- This allows:
-- 1. JIRA assignee (developer) remains in 'assigned_to' field
-- 2. Non-dev team members can assign themselves via 'secondary_assignee'
-- 3. Both assignees can view and update the task
-- 4. Queries can filter by either assignee type

