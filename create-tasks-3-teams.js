/**
 * Create Tasks for 3-Team Structure
 * Engineering (keep existing JIRA tasks)
 * Functional (Product + Marketing tasks)
 * Business Development (Sales + Executive tasks)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Define tasks for each user (1-2 per person)
const TASKS = {
  // Functional Team (Product + Marketing)
  'iris.anderson@beachbaby.demo': [
    {
      title: 'Q1 Product Roadmap - Feature Prioritization',
      description: 'Review user feedback and define feature priorities for Q1 2024 release cycle',
      priority: 'high'
    },
    {
      title: 'User Research - Enterprise Customer Interviews',
      description: 'Conduct 5 enterprise customer interviews to understand scaling needs',
      priority: 'medium'
    }
  ],
  'jack.lee@beachbaby.demo': [
    {
      title: 'Design System 2.0 - Component Library Overhaul',
      description: 'Update component library with new design tokens and accessibility improvements',
      priority: 'medium'
    }
  ],
  'kelly.davis@beachbaby.demo': [
    {
      title: 'UX Audit - Mobile App User Journey',
      description: 'Analyze mobile app user flows and identify friction points',
      priority: 'high'
    }
  ],
  'leo.white@beachbaby.demo': [
    {
      title: 'Product Analytics Dashboard Setup',
      description: 'Configure Mixpanel dashboards for key product metrics and funnels',
      priority: 'medium'
    }
  ],
  'maya.garcia@beachbaby.demo': [
    {
      title: 'Content Strategy - Q1 Editorial Calendar',
      description: 'Plan and schedule blog posts, case studies, and whitepapers for Q1',
      priority: 'high'
    },
    {
      title: 'SEO Optimization - High-Priority Pages',
      description: 'Update meta descriptions and content for top 10 landing pages',
      priority: 'medium'
    }
  ],
  'nathan.miller@beachbaby.demo': [
    {
      title: 'Technical SEO Audit',
      description: 'Conduct comprehensive site audit and fix crawl errors',
      priority: 'high'
    }
  ],
  'olivia.harris@beachbaby.demo': [
    {
      title: 'Brand Guidelines Update v2.0',
      description: 'Refresh brand book with new visual identity and messaging framework',
      priority: 'medium'
    },
    {
      title: 'Website Redesign - Homepage Mockups',
      description: 'Create new homepage designs aligned with updated brand guidelines',
      priority: 'low'
    }
  ],
  'paul.clark@beachbaby.demo': [
    {
      title: 'Social Media Campaign - Product Launch',
      description: 'Plan and execute social campaign for Q1 feature release',
      priority: 'high'
    }
  ],
  'quinn.lewis@beachbaby.demo': [
    {
      title: 'Marketing Attribution Model Setup',
      description: 'Implement multi-touch attribution in Google Analytics and HubSpot',
      priority: 'medium'
    }
  ],

  // Business Development Team (Sales + Executive)
  'emma.wilson@beachbaby.demo': [
    {
      title: 'Enterprise Deal - Close Acme Corp Q1 Contract',
      description: '$250K ARR deal - final negotiations and contract signing',
      priority: 'high'
    },
    {
      title: 'Q4 Pipeline Review and Forecast Update',
      description: 'Update sales forecast based on current pipeline and close rates',
      priority: 'high'
    }
  ],
  'frank.rodriguez@beachbaby.demo': [
    {
      title: 'Outbound Prospecting - Tech Startup Segment',
      description: 'Reach out to 30 qualified prospects from Y Combinator and TechStars',
      priority: 'medium'
    }
  ],
  'grace.taylor@beachbaby.demo': [
    {
      title: 'Sales Team Training - New Product Features',
      description: 'Conduct training for sales team on Q1 product releases',
      priority: 'high'
    },
    {
      title: 'Sales Playbook Update',
      description: 'Refresh competitive battlecards and objection handling scripts',
      priority: 'medium'
    }
  ],
  'henry.brown@beachbaby.demo': [
    {
      title: 'CRM Data Quality - Account Cleanup',
      description: 'Clean up duplicate accounts and update contact information in Salesforce',
      priority: 'low'
    }
  ],
  'rachel.thompson@beachbaby.demo': [
    {
      title: 'Board Meeting Preparation - Q4 Review',
      description: 'Prepare quarterly board deck with financial metrics and strategic updates',
      priority: 'high'
    },
    {
      title: 'Annual Planning - 2024 Company OKRs',
      description: 'Define top-level company objectives and key results for 2024',
      priority: 'high'
    }
  ],
  'steven.walker@beachbaby.demo': [
    {
      title: 'Infrastructure Scale Planning',
      description: 'Plan tech infrastructure upgrades to support 10x growth',
      priority: 'high'
    },
    {
      title: 'Engineering Leadership Hiring',
      description: 'Interview candidates for VP of Engineering role',
      priority: 'medium'
    }
  ],
  'tina.young@beachbaby.demo': [
    {
      title: 'Year-End Financial Close',
      description: 'Complete financial statements and prepare for annual audit',
      priority: 'high'
    }
  ]
};

function getStatusFromPriority(priority) {
  if (priority === 'high') {
    return Math.random() > 0.5 ? 'in_progress' : 'pending';
  }
  return 'pending';
}

async function createTasks() {
  console.log('🚀 Creating tasks for 3-team structure...\n');
  console.log('═'.repeat(80));

  // Get all users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email, name')
    .in('email', Object.keys(TASKS));

  if (usersError) {
    console.error('❌ Failed to fetch users:', usersError.message);
    return;
  }

  const userMap = {};
  users.forEach(u => {
    userMap[u.email] = u;
  });

  console.log(`✓ Found ${users.length} users\n`);

  let totalCreated = 0;
  let functionalTasks = 0;
  let businessDevTasks = 0;

  // Functional team emails
  const functionalEmails = [
    'iris.anderson@beachbaby.demo',
    'jack.lee@beachbaby.demo',
    'kelly.davis@beachbaby.demo',
    'leo.white@beachbaby.demo',
    'maya.garcia@beachbaby.demo',
    'nathan.miller@beachbaby.demo',
    'olivia.harris@beachbaby.demo',
    'paul.clark@beachbaby.demo',
    'quinn.lewis@beachbaby.demo'
  ];

  console.log('📋 FUNCTIONAL TEAM TASKS\n');
  console.log('─'.repeat(80));

  for (const email of functionalEmails) {
    const user = userMap[email];
    const tasks = TASKS[email];
    
    if (!user || !tasks) continue;

    console.log(`\n${user.name}:`);

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
          team: 'Functional'
        }
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert(task)
        .select()
        .single();

      if (error) {
        console.log(`   ❌ "${taskData.title}" - ${error.message}`);
      } else {
        console.log(`   ✅ "${taskData.title}" [${taskData.priority}/${status}]`);
        totalCreated++;
        functionalTasks++;
      }
    }
  }

  console.log('\n\n📋 BUSINESS DEVELOPMENT TEAM TASKS\n');
  console.log('─'.repeat(80));

  const businessDevEmails = Object.keys(TASKS).filter(e => !functionalEmails.includes(e));

  for (const email of businessDevEmails) {
    const user = userMap[email];
    const tasks = TASKS[email];
    
    if (!user || !tasks) continue;

    console.log(`\n${user.name}:`);

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
          team: 'Business Development'
        }
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert(task)
        .select()
        .single();

      if (error) {
        console.log(`   ❌ "${taskData.title}" - ${error.message}`);
      } else {
        console.log(`   ✅ "${taskData.title}" [${taskData.priority}/${status}]`);
        totalCreated++;
        businessDevTasks++;
      }
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log(`\n✅ Task creation complete!`);
  console.log(`   Functional: ${functionalTasks} tasks`);
  console.log(`   Business Development: ${businessDevTasks} tasks`);
  console.log(`   Total created: ${totalCreated} tasks`);
  
  console.log('\n📊 Complete Team Summary:');
  console.log('─'.repeat(80));
  console.log(`   Engineering: 4 members, 10 JIRA tasks (existing)`);
  console.log(`   Functional: 9 members, ${functionalTasks} tasks`);
  console.log(`   Business Development: 7 members, ${businessDevTasks} tasks`);
  console.log('\n═'.repeat(80));
  console.log('💡 Restart desktop app to see the new structure!');
}

createTasks()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });


