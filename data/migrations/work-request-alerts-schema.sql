-- Work Request Alert System Database Schema

-- Work requests table
CREATE TABLE IF NOT EXISTS work_requests (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR NOT NULL,
    channel_id VARCHAR NOT NULL,
    message_text TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    urgency VARCHAR CHECK (urgency IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    work_type VARCHAR CHECK (work_type IN ('coding', 'design', 'analysis', 'support', 'other')) DEFAULT 'other',
    estimated_effort VARCHAR CHECK (estimated_effort IN ('quick', 'medium', 'large', 'unknown')) DEFAULT 'unknown',
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    key_actions JSONB DEFAULT '[]'::jsonb,
    suggested_response TEXT,
    status VARCHAR CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')) DEFAULT 'pending',
    response TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR PRIMARY KEY,
    type VARCHAR NOT NULL,
    title VARCHAR NOT NULL,
    message TEXT NOT NULL,
    urgency VARCHAR CHECK (urgency IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    actions JSONB DEFAULT '[]'::jsonb,
    status VARCHAR CHECK (status IN ('unread', 'read', 'dismissed')) DEFAULT 'unread',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Chat alerts table
CREATE TABLE IF NOT EXISTS chat_alerts (
    id VARCHAR PRIMARY KEY,
    type VARCHAR NOT NULL,
    work_request_id VARCHAR REFERENCES work_requests(id),
    title VARCHAR NOT NULL,
    message TEXT NOT NULL,
    urgency VARCHAR CHECK (urgency IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
    suggested_response TEXT,
    key_actions JSONB DEFAULT '[]'::jsonb,
    status VARCHAR CHECK (status IN ('unread', 'read', 'dismissed')) DEFAULT 'unread',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_work_requests_status ON work_requests(status);
CREATE INDEX IF NOT EXISTS idx_work_requests_urgency ON work_requests(urgency);
CREATE INDEX IF NOT EXISTS idx_work_requests_user_id ON work_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_work_requests_created_at ON work_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_urgency ON notifications(urgency);
CREATE INDEX IF NOT EXISTS idx_notifications_timestamp ON notifications(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_chat_alerts_status ON chat_alerts(status);
CREATE INDEX IF NOT EXISTS idx_chat_alerts_work_request_id ON chat_alerts(work_request_id);
CREATE INDEX IF NOT EXISTS idx_chat_alerts_created_at ON chat_alerts(created_at DESC);

-- Row Level Security (RLS) policies
ALTER TABLE work_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_alerts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write their own data
CREATE POLICY "Users can manage their work requests" ON work_requests
    FOR ALL USING (auth.uid()::text = user_id OR auth.uid()::text = 'admin');

CREATE POLICY "Users can manage their notifications" ON notifications
    FOR ALL USING (true); -- Admin can see all notifications

CREATE POLICY "Users can manage their chat alerts" ON chat_alerts
    FOR ALL USING (true); -- Admin can see all alerts
