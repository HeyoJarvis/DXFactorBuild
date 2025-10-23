/**
 * Create Feature-Aligned Tasks for 5-Team Structure
 * Mobile vs Desktop feature separation with JIRA + Teams tasks
 */

const { createClient } = require('@supabase/supabase-js');
const JIRAService = require('./desktop2/main/services/JIRAService');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mobile vs Desktop JIRA task assignments
const JIRA_ASSIGNMENTS = {
  mobile: ['SCRUM-45', 'SCRUM-47', 'SCRUM-49', 'SCRUM-50'], // UI, Notifications, Code Search, Meeting Scheduler
  desktop: ['SCRUM-41', 'SCRUM-42', 'SCRUM-43', 'SCRUM-44', 'SCRUM-46', 'SCRUM-48'] // Auth, History, Onboarding, Performance, JIRA, GitHub
};

// Teams tasks for functional and bizdev
const TEAMS_TASKS = {
  // Mobile Functional Team
  'iris.anderson@beachbaby.demo': [
    { title: 'Mobile Roadmap Q1 - Feature Prioritization', description: 'Define mobile app feature priorities for Q1 release', priority: 'high' }
  ],
  'jack.lee@beachbaby.demo': [
    { title: 'Mobile Design System - Component Library', description: 'Create mobile-specific design components and patterns', priority: 'high' }
  ],
  'maya.garcia@beachbaby.demo': [
    { title: 'Mobile App Launch Campaign', description: 'Plan marketing campaign for mobile app launch', priority: 'medium' }
  ],
  'kelly.davis@beachbaby.demo': [
    { title: 'Mobile UX Research - User Testing', description: 'Conduct usability testing with 10 mobile users', priority: 'high' }
  ],
  'paul.clark@beachbaby.demo': [
    { title: 'Mobile Social Media Strategy', description: 'Create social content highlighting mobile features', priority: 'medium' }
  ],

  // Desktop Functional Team  
  'olivia.harris@beachbaby.demo': [
    { title: 'Desktop Platform Brand Guidelines', description: 'Update brand guidelines for desktop platform', priority: 'medium' }
  ],
  'leo.white@beachbaby.demo': [
    { title: 'Desktop Analytics Dashboard', description: 'Set up desktop platform usage analytics in Mixpanel', priority: 'high' }
  ],
  'nathan.miller@beachbaby.demo': [
    { title: 'Desktop Platform SEO Strategy', description: 'Optimize desktop landing pages for search engines', priority: 'high' }
  ],
  'quinn.lewis@beachbaby.demo': [
    { title: 'Desktop Marketing Attribution', description: 'Implement attribution tracking for desktop conversions', priority: 'medium' }
  ],

  // Business Development Team
  'emma.wilson@beachbaby.demo': [
    { title: 'Enterprise Deal - Acme Corp $250K ARR', description: 'Close Q1 enterprise contract with Acme Corporation', priority: 'high' },
    { title: 'Q4 Sales Forecast Update', description: 'Update sales forecast based on current pipeline', priority: 'high' }
  ],
  'frank.rodriguez@beachbaby.demo': [
    { title: 'Outbound Prospecting - 30 Tech Startups', description: 'Reach out to Y Combinator batch prospects', priority: 'medium' }
  ],
  'grace.taylor@beachbaby.demo': [
    { title: 'Sales Team Training - Product Updates', description: 'Train sales team on new mobile and desktop features', priority: 'high' }
  ],
  'henry.brown@beachbaby.demo': [
    { title: 'CRM Data Cleanup - Salesforce', description: 'Clean duplicate accounts and update contact info', priority: 'low' }
  ],
  'rachel.thompson@beachbaby.demo': [
    { title: 'Board Meeting Prep - Q4 Performance', description: 'Prepare board deck with metrics and strategic updates', priority: 'high' }
  ],
  'steven.walker@beachbaby.demo': [
    { title: 'Infrastructure Scaling Plan', description: 'Plan tech infrastructure for 10x growth', priority: 'high' }
  ],
  'tina.young@beachbaby.demo': [
    { title: 'Year-End Financial Close', description: 'Complete Q4 financial statements and audit prep', priority: 'high' }
  ]
};

async function createFeatureTasks() {
  console.log('🚀 Creating Feature-Aligned Tasks\n');
  console.log('═'.repeat(80));

  // Get all users
  const { data: users } = await supabase
    .from('users')
    .select('id, email, name');

  const userMap = {};
  users.forEach(u => { userMap[u.email] = u; });

  // Team IDs
  const TEAM_IDS = {
    eng_mobile: '00000000-0000-0000-0000-000000000020',
    func_mobile: '00000000-0000-0000-0000-000000000021',
    eng_desktop: '00000000-0000-0000-0000-000000000022',
    func_desktop: '00000000-0000-0000-0000-000000000023',
    bizdev: '00000000-0000-0000-0000-000000000024'
  };

  let mobileJira = 0, desktopJira = 0, teamsTasksCreated = 0;

  // ===== MOBILE ENGINEERING: JIRA TASKS =====
  console.log('\n📱 MOBILE ENGINEERING TEAM (JIRA)\n');
  console.log('─'.repeat(80));

  // Get authenticated user for JIRA
  const { data: authUsers } = await supabase
    .from('users')
    .select('id, email, integration_settings')
    .not('integration_settings->jira->access_token', 'is', null)
    .limit(1);

  if (authUsers && authUsers.length > 0) {
    const authUser = authUsers[0];
    const jiraService = new JIRAService({
      logger: { info: console.log, error: console.error, warn: console.warn, debug: () => {} },
      supabaseAdapter: { supabase }
    });

    await jiraService.initialize(authUser.id);

    try {
      // Fetch all SCRUM tasks
      const params = new URLSearchParams({
        jql: 'project = SCRUM AND key >= SCRUM-41 ORDER BY key ASC',
        maxResults: '100',
        fields: 'summary,status,description,priority,issuetype'
      });

      const response = await jiraService.jiraCore._makeRequest(`/rest/api/3/search/jql?${params.toString()}`);

      // Mobile team members
      const mobileEngineers = [
        userMap['david.kim@beachbaby.demo'],
        userMap['bob.martinez@beachbaby.demo']
      ];

      // Assign mobile JIRA tasks
      for (const issue of response.issues) {
        if (JIRA_ASSIGNMENTS.mobile.includes(issue.key)) {
          const engineer = mobileEngineers[mobileJira % mobileEngineers.length];
          
          const task = {
            title: issue.fields.summary,
            description: issue.fields.description?.content?.[0]?.content?.[0]?.text || '',
            status: issue.fields.status.name === 'To Do' ? 'pending' : 'in_progress',
            external_source: 'jira',
            external_id: issue.id,
            external_url: `https://heyjarvis-team.atlassian.net/browse/${issue.key}`,
            assigned_to: engineer.id,
            created_by: authUser.id,
            metadata: {
              jira_key: issue.key,
              assigned_engineer: engineer.name,
              feature: 'mobile'
            }
          };

          const { error } = await supabase.from('tasks').insert(task);
          if (!error) {
            console.log(`✅ ${issue.key}: ${issue.fields.summary} → ${engineer.name}`);
            mobileJira++;
          }
        }
      }

      // ===== DESKTOP ENGINEERING: JIRA TASKS =====
      console.log('\n💻 DESKTOP ENGINEERING TEAM (JIRA)\n');
      console.log('─'.repeat(80));

      const desktopEngineers = [
        userMap['alice.chen@beachbaby.demo'],
        userMap['carol.johnson@beachbaby.demo']
      ];

      // Assign desktop JIRA tasks
      for (const issue of response.issues) {
        if (JIRA_ASSIGNMENTS.desktop.includes(issue.key)) {
          const engineer = desktopEngineers[desktopJira % desktopEngineers.length];
          
          const task = {
            title: issue.fields.summary,
            description: issue.fields.description?.content?.[0]?.content?.[0]?.text || '',
            status: issue.fields.status.name === 'To Do' ? 'pending' : 'in_progress',
            external_source: 'jira',
            external_id: issue.id,
            external_url: `https://heyjarvis-team.atlassian.net/browse/${issue.key}`,
            assigned_to: engineer.id,
            created_by: authUser.id,
            metadata: {
              jira_key: issue.key,
              assigned_engineer: engineer.name,
              feature: 'desktop'
            }
          };

          const { error } = await supabase.from('tasks').insert(task);
          if (!error) {
            console.log(`✅ ${issue.key}: ${issue.fields.summary} → ${engineer.name}`);
            desktopJira++;
          }
        }
      }

    } catch (error) {
      console.error('❌ JIRA fetch failed:', error.message);
    }
  }

  // ===== FUNCTIONAL & BIZDEV: TEAMS TASKS =====
  console.log('\n📋 FUNCTIONAL & BUSINESS DEVELOPMENT TEAMS\n');
  console.log('─'.repeat(80));

  for (const [email, tasks] of Object.entries(TEAMS_TASKS)) {
    const user = userMap[email];
    if (!user) continue;

    for (const taskData of tasks) {
      const status = taskData.priority === 'high' && Math.random() > 0.5 ? 'in_progress' : 'pending';
      
      const task = {
        title: taskData.title,
        description: taskData.description,
        status: status,
        external_source: 'teams',
        assigned_to: user.id,
        created_by: user.id,
        metadata: {
          priority: taskData.priority,
          source_platform: 'Microsoft Teams'
        }
      };

      const { error } = await supabase.from('tasks').insert(task);
      if (!error) {
        console.log(`✅ ${user.name}: ${taskData.title}`);
        teamsTasksCreated++;
      }
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('\n📊 TASK CREATION SUMMARY\n');
  console.log(`Mobile Engineering (JIRA): ${mobileJira} tasks`);
  console.log(`Desktop Engineering (JIRA): ${desktopJira} tasks`);
  console.log(`Functional & BizDev (Teams): ${teamsTasksCreated} tasks`);
  console.log(`\nTotal: ${mobileJira + desktopJira + teamsTasksCreated} tasks`);
  console.log('\n' + '═'.repeat(80));
}

createFeatureTasks()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

