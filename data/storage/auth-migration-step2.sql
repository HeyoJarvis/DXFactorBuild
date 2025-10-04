-- =====================================================
-- Step 2: Update Existing Tasks Table for Multi-User
-- Run this AFTER step 1
-- =====================================================

-- First, drop existing RLS policies that might conflict
DROP POLICY IF EXISTS tasks_all_access ON public.tasks;
DROP POLICY IF EXISTS tasks_user_access ON public.tasks;
DROP POLICY IF EXISTS "Users can view assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view created tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update created tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete created tasks" ON public.tasks;

-- Add user reference columns if they don't exist
DO $$ 
BEGIN
  -- Add assigned_to column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tasks' 
    AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Added assigned_to column';
  ELSE
    RAISE NOTICE '⏭️  assigned_to column already exists';
  END IF;

  -- Add created_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tasks' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Added created_by column';
  ELSE
    RAISE NOTICE '⏭️  created_by column already exists';
  END IF;

  -- Add due_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tasks' 
    AND column_name = 'due_date'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN due_date TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE '✅ Added due_date column';
  ELSE
    RAISE NOTICE '⏭️  due_date column already exists';
  END IF;
END $$;

-- Update status values if needed (from 'todo' to 'pending')
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tasks' 
    AND column_name = 'status'
  ) THEN
    -- Update any 'todo' status to 'pending'
    UPDATE public.tasks SET status = 'pending' WHERE status = 'todo';
    RAISE NOTICE '✅ Updated status values';
  END IF;
END $$;

-- Recreate indexes
DROP INDEX IF EXISTS idx_tasks_user;
DROP INDEX IF EXISTS idx_tasks_assigned_to;
DROP INDEX IF EXISTS idx_tasks_created_by;
DROP INDEX IF EXISTS idx_tasks_status;
DROP INDEX IF EXISTS idx_tasks_priority;
DROP INDEX IF EXISTS idx_tasks_due_date;
DROP INDEX IF EXISTS idx_tasks_created;

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at DESC);

-- Ensure RLS is enabled
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Create new RLS policies for multi-user access
-- Users can see tasks assigned to them or created by them
CREATE POLICY "Users can view assigned tasks" ON public.tasks
  FOR SELECT
  USING (
    auth.uid() = assigned_to 
    OR auth.uid() = created_by
    OR user_id = 'desktop-user'  -- Keep old single-user tasks visible
  );

-- Users can create tasks
CREATE POLICY "Users can create tasks" ON public.tasks
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    OR user_id = 'desktop-user'  -- Allow old-style creation temporarily
  );

-- Users can update tasks they're assigned to or created
CREATE POLICY "Users can update tasks" ON public.tasks
  FOR UPDATE
  USING (
    auth.uid() = assigned_to 
    OR auth.uid() = created_by
    OR user_id = 'desktop-user'  -- Keep old single-user tasks editable
  );

-- Users can delete tasks they created
CREATE POLICY "Users can delete created tasks" ON public.tasks
  FOR DELETE
  USING (
    auth.uid() = created_by
    OR user_id = 'desktop-user'  -- Keep old single-user tasks deletable
  );

-- Update the trigger function to handle new status values
DROP TRIGGER IF EXISTS tasks_updated_at_trigger ON public.tasks;

CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at_trigger
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;

-- Done!
DO $$
BEGIN
  RAISE NOTICE '✅ Step 2 complete: Tasks table updated for multi-user support';
  RAISE NOTICE '📋 Tasks now support assigned_to and created_by';
  RAISE NOTICE '🔒 RLS policies updated for user-specific access';
END $$;

