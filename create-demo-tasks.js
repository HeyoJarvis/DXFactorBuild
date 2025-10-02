const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function createDemoTasks() {
  console.log('📝 Creating demo tasks for desktop-user...\n');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const demoTasks = [
    {
      user_id: 'desktop-user',
      workflow_id: `desktop-user_task_${Date.now()}_1`,
      workflow_type: 'task',
      workflow_intent: 'task_management',
      session_title: 'Review quarterly sales data',
      workflow_metadata: {
        priority: 'high',
        description: 'Analyze Q3 performance metrics and prepare report',
        tags: ['sales', 'quarterly-review'],
        due_date: null
      },
      is_active: true,
      is_completed: false
    },
    {
      user_id: 'desktop-user',
      workflow_id: `desktop-user_task_${Date.now()}_2`,
      workflow_type: 'task',
      workflow_intent: 'task_management',
      session_title: 'Schedule team meeting',
      workflow_metadata: {
        priority: 'medium',
        description: 'Coordinate with all department heads for next week',
        tags: ['meeting', 'team'],
        due_date: null
      },
      is_active: true,
      is_completed: false
    },
    {
      user_id: 'desktop-user',
      workflow_id: `desktop-user_task_${Date.now()}_3`,
      workflow_type: 'task',
      workflow_intent: 'task_management',
      session_title: 'Update CRM contacts',
      workflow_metadata: {
        priority: 'low',
        description: 'Import new leads from last marketing campaign',
        tags: ['crm', 'leads'],
        due_date: null
      },
      is_active: true,
      is_completed: false
    },
    {
      user_id: 'desktop-user',
      workflow_id: `desktop-user_task_${Date.now()}_4`,
      workflow_type: 'task',
      workflow_intent: 'task_management',
      session_title: 'Fix production bug in checkout',
      workflow_metadata: {
        priority: 'urgent',
        description: 'Users reporting payment processing errors',
        tags: ['bug', 'urgent', 'production'],
        due_date: null
      },
      is_active: true,
      is_completed: false
    }
  ];

  for (const task of demoTasks) {
    const { data, error } = await supabase
      .from('conversation_sessions')
      .insert([task])
      .select()
      .single();

    if (error) {
      console.error(`❌ Failed to create task "${task.session_title}":`, error.message);
    } else {
      console.log(`✅ Created task: "${task.session_title}" [${task.workflow_metadata.priority}]`);
    }
  }

  console.log('\n✨ Demo tasks created! Now restart the desktop app to see them.');
}

createDemoTasks().catch(console.error);

