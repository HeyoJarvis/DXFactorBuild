/**
 * Create Microsoft Teams Tasks for Demo
 * Creates 1-2 realistic tasks per team member (excluding Engineering)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Define tasks for each team member
const TEAM_TASKS = {
  // Sales Team
  'emma.wilson@beachbaby.demo': [
    {
      title: 'Follow up with Enterprise Client - Acme Corp',
      description: 'Schedule demo call and send proposal for Q1 2024 contract renewal',
      priority: 'high'
    },
    {
      title: 'Prepare Q4 Sales Presentation',
      description: 'Create deck for quarterly business review with metrics and forecasts',
      priority: 'medium'
    }
  ],
  'frank.rodriguez@beachbaby.demo': [
    {
      title: 'Prospect Outreach - Tech Startups List',
      description: 'Contact 20 prospects from the Y Combinator batch for product demos',
      priority: 'medium'
    }
  ],
  'grace.taylor@beachbaby.demo': [
    {
      title: 'Sales Team Training - New Product Features',
      description: 'Organize training session for team on the latest product updates',
      priority: 'high'
    },
    {
      title: 'Review and Approve Sales Commissions',
      description: 'Validate Q4 commission calculations and approve payouts',
      priority: 'high'
    }
  ],
  'henry.brown@beachbaby.demo': [
    {
      title: 'Update CRM Contact Records',
      description: 'Clean up and update contact information for key accounts in HubSpot',
      priority: 'low'
    }
  ],

  // Product Team
  'iris.anderson@beachbaby.demo': [
    {
      title: 'Product Roadmap Review for Q1 2024',
      description: 'Finalize priorities and feature list for next quarter with stakeholders',
      priority: 'high'
    },
    {
      title: 'User Research Synthesis - Mobile App Feedback',
      description: 'Analyze user feedback from mobile beta and create action items',
      priority: 'medium'
    }
  ],
  'jack.lee@beachbaby.demo': [
    {
      title: 'Design System Updates - Dark Mode Components',
      description: 'Create dark mode variants for all core UI components',
      priority: 'medium'
    },
    {
      title: 'Mobile App Wireframes - Settings Screen',
      description: 'Design new settings interface with improved user experience',
      priority: 'low'
    }
  ],
  'kelly.davis@beachbaby.demo': [
    {
      title: 'Conduct User Interviews - Enterprise Customers',
      description: 'Schedule and conduct 5 user interviews to understand enterprise needs',
      priority: 'high'
    }
  ],
  'leo.white@beachbaby.demo': [
    {
      title: 'Analyze Product Usage Metrics',
      description: 'Review November analytics and identify drop-off points in user journey',
      priority: 'medium'
    }
  ],

  // Marketing Team
  'maya.garcia@beachbaby.demo': [
    {
      title: 'Write Blog Post - Best Practices for Team Collaboration',
      description: 'Create 2000-word article for company blog with SEO optimization',
      priority: 'medium'
    },
    {
      title: 'Plan Content Calendar for January',
      description: 'Schedule social media posts, blogs, and email campaigns for next month',
      priority: 'high'
    }
  ],
  'nathan.miller@beachbaby.demo': [
    {
      title: 'SEO Audit - Website Performance',
      description: 'Analyze site rankings, fix broken links, and optimize meta descriptions',
      priority: 'high'
    }
  ],
  'olivia.harris@beachbaby.demo': [
    {
      title: 'Brand Guidelines Update',
      description: 'Update brand book with new logo variations and color palette',
      priority: 'medium'
    },
    {
      title: 'Coordinate with Design Team on Marketing Materials',
      description: 'Review and approve Q1 campaign assets and promotional materials',
      priority: 'low'
    }
  ],
  'paul.clark@beachbaby.demo': [
    {
      title: 'Schedule Social Media Posts for Product Launch',
      description: 'Create and schedule 2 weeks of social content for upcoming feature release',
      priority: 'high'
    }
  ],
  'quinn.lewis@beachbaby.demo': [
    {
      title: 'Marketing Campaign Performance Report',
      description: 'Analyze ROI and conversion metrics from Q4 campaigns',
      priority: 'medium'
    },
    {
      title: 'Set up Google Analytics Goals',
      description: 'Configure conversion tracking for new landing pages',
      priority: 'low'
    }
  ],

  // Executive Team
  'rachel.thompson@beachbaby.demo': [
    {
      title: 'Board Meeting Preparation',
      description: 'Prepare quarterly board presentation with financial and growth metrics',
      priority: 'high'
    },
    {
      title: 'Strategic Planning Session - 2024 Goals',
      description: 'Organize executive retreat to define company OKRs for next year',
      priority: 'high'
    }
  ],
  'steven.walker@beachbaby.demo': [
    {
      title: 'Technical Infrastructure Review',
      description: 'Assess current tech stack and plan for scalability improvements',
      priority: 'high'
    },
    {
      title: 'Hire Senior Engineering Manager',
      description: 'Review candidates and conduct final interviews for engineering leadership role',
      priority: 'medium'
    }
  ],
  'tina.young@beachbaby.demo': [
    {
      title: 'Q4 Financial Close and Reconciliation',
      description: 'Complete financial statements and prepare for annual audit',
      priority: 'high'
    }
  ]
};

/**
 * Map priority to status
 */
function getStatusFromPriority(priority) {
  // High priority tasks are more likely to be in progress
  if (priority === 'high') {
    return Math.random() > 0.5 ? 'in_progress' : 'pending';
  }
  return 'pending';
}

/**
 * Create Teams tasks for non-engineering members
 */
async function createTeamsTasks() {
  console.log('🚀 Creating Microsoft Teams tasks for demo...\n');
  console.log('═'.repeat(80));

  let totalCreated = 0;
  let totalSkipped = 0;

  // Get user IDs for all team members
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, name')
    .in('email', Object.keys(TEAM_TASKS));

  if (usersError) {
    console.error('❌ Failed to fetch users:', usersError.message);
    return;
  }

  console.log(`✓ Found ${users.length} users to create tasks for\n`);

  // Create a map of email to user
  const userMap = {};
  users.forEach(user => {
    userMap[user.email] = user;
  });

  // Create tasks for each user
  for (const [email, tasks] of Object.entries(TEAM_TASKS)) {
    const user = userMap[email];
    
    if (!user) {
      console.log(`⚠️  User not found: ${email}`);
      continue;
    }

    console.log(`\n👤 ${user.name} (${email})`);
    console.log('─'.repeat(80));

    for (const taskData of tasks) {
      const status = getStatusFromPriority(taskData.priority);
      
      const task = {
        title: taskData.title,
        description: taskData.description,
        status: status,
        external_source: 'teams',
        assigned_to: user.id,
        created_by: user.id,
        metadata: {
          priority: taskData.priority,
          source_platform: 'Microsoft Teams',
          team_channel: 'General'
        }
      };

      // Check if task already exists
      const { data: existing } = await supabase
        .from('tasks')
        .select('id')
        .eq('title', task.title)
        .eq('assigned_to', user.id)
        .single();

      if (existing) {
        console.log(`   ⏭️  "${taskData.title}"`);
        console.log(`      Already exists (skipped)`);
        totalSkipped++;
      } else {
        const { data, error } = await supabase
          .from('tasks')
          .insert(task)
          .select()
          .single();

        if (error) {
          console.log(`   ❌ "${taskData.title}"`);
          console.log(`      Error: ${error.message}`);
          totalSkipped++;
        } else {
          console.log(`   ✅ "${taskData.title}"`);
          console.log(`      Priority: ${taskData.priority} | Status: ${status}`);
          totalCreated++;
        }
      }
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log(`\n✅ Teams tasks creation complete!`);
  console.log(`   Created: ${totalCreated} new tasks`);
  console.log(`   Skipped: ${totalSkipped} existing/failed tasks`);
  console.log(`   Total:   ${totalCreated + totalSkipped} tasks processed\n`);

  // Show summary by team
  console.log('📊 Task Summary by Team:');
  console.log('─'.repeat(80));

  const teams = {
    'Sales': ['emma.wilson@beachbaby.demo', 'frank.rodriguez@beachbaby.demo', 'grace.taylor@beachbaby.demo', 'henry.brown@beachbaby.demo'],
    'Product': ['iris.anderson@beachbaby.demo', 'jack.lee@beachbaby.demo', 'kelly.davis@beachbaby.demo', 'leo.white@beachbaby.demo'],
    'Marketing': ['maya.garcia@beachbaby.demo', 'nathan.miller@beachbaby.demo', 'olivia.harris@beachbaby.demo', 'paul.clark@beachbaby.demo', 'quinn.lewis@beachbaby.demo'],
    'Executive': ['rachel.thompson@beachbaby.demo', 'steven.walker@beachbaby.demo', 'tina.young@beachbaby.demo']
  };

  for (const [teamName, emails] of Object.entries(teams)) {
    const teamUserIds = emails.map(e => userMap[e]?.id).filter(Boolean);
    
    const { data: teamTasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('external_source', 'teams')
      .in('assigned_to', teamUserIds);

    console.log(`   ${teamName}: ${teamTasks?.length || 0} tasks`);
  }

  console.log('\n💡 TIP: Restart the desktop app to see these tasks in team context');
  console.log('═'.repeat(80));
}

// Run the script
createTeamsTasks()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });


