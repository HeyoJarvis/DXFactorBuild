-- =====================================================
-- MIGRATION: Add ALL missing columns to conversation_sessions
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Add missing columns to conversation_sessions table
ALTER TABLE public.conversation_sessions 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS workflow_type TEXT DEFAULT 'task',
ADD COLUMN IF NOT EXISTS workflow_id TEXT,
ADD COLUMN IF NOT EXISTS workflow_intent TEXT,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS source_channel_id TEXT,
ADD COLUMN IF NOT EXISTS source_message_id TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_sessions_active ON public.conversation_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sessions_workflow_type ON public.conversation_sessions(workflow_type);
CREATE INDEX IF NOT EXISTS idx_sessions_workflow_id ON public.conversation_sessions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON public.conversation_sessions(started_at DESC);

-- Update existing rows with default values
UPDATE public.conversation_sessions 
SET is_active = true 
WHERE is_active IS NULL;

UPDATE public.conversation_sessions 
SET workflow_type = 'task' 
WHERE workflow_type IS NULL;

UPDATE public.conversation_sessions 
SET started_at = created_at 
WHERE started_at IS NULL;

-- Fix conversation_messages table (add missing columns only)
-- Add the new columns if they don't exist
ALTER TABLE public.conversation_messages
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();

-- Update timestamp from created_at for ALL existing rows (ensure no nulls)
UPDATE public.conversation_messages 
SET timestamp = COALESCE(timestamp, created_at, NOW());

-- Add index for user_id
CREATE INDEX IF NOT EXISTS idx_messages_user ON public.conversation_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON public.conversation_messages(timestamp DESC);

-- Verify the changes for conversation_sessions
SELECT 
  'conversation_sessions' as table_name,
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'conversation_sessions' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Verify the changes for conversation_messages
SELECT 
  'conversation_messages' as table_name,
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'conversation_messages' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

