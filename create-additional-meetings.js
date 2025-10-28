/**
 * Add Second Past Meeting for Mobile Engineering and Business Development Teams
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEAM_IDS = {
  eng_mobile: '00000000-0000-0000-0000-000000000020',
  bizdev: '00000000-0000-0000-0000-000000000024'
};

// Past dates
const fiveDaysAgo = new Date();
fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

const sixDaysAgo = new Date();
sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

const ADDITIONAL_MEETINGS = [
  // Mobile Engineering - Technical Deep Dive
  {
    team_id: TEAM_IDS.eng_mobile,
    meeting_id: 'meeting-mobile-eng-2-past',
    title: 'Mobile Code Review & Testing Strategy',
    start_time: fiveDaysAgo.toISOString(),
    ai_summary: `**Mobile Code Review & Testing Strategy**
Date: ${fiveDaysAgo.toLocaleDateString()}
Attendees: David Kim (Engineering Lead), Bob Martinez (Engineer)

---

**David Kim**: Hey Bob, let's do a deep dive on the code quality and testing strategy for our mobile platform. We've been shipping fast but I want to make sure we're not accumulating technical debt.

**Bob Martinez**: Good timing. I've been thinking about this too. Our test coverage is at about 65% right now.

**David Kim**: That's not bad, but for a production app we should be closer to 80%. What's not covered?

**Bob Martinez**: Mostly the UI components. We have good unit tests for business logic, but our component tests are lacking. The Arc Reactor stuff especially - it's complex with all the drag-and-drop.

**David Kim**: Testing drag-and-drop is annoying. Are you using React Testing Library?

**Bob Martinez**: Yeah, but simulating drag events is tricky. I've been looking at Playwright for E2E tests instead. It actually simulates real user interactions.

**David Kim**: Playwright sounds promising. What about the performance regression we saw last week? The notifications SCRUM-47 - is that tested?

**Bob Martinez**: Not yet. We need performance benchmarks. I think we should add automated performance tests that fail if render time exceeds 100ms.

**David Kim**: Love that. Can you set that up? We could use Lighthouse CI in our GitHub Actions.

**Bob Martinez**: Yeah, I'll add it this sprint. What about code reviews? I feel like we're rushing through them sometimes.

**David Kim**: True. New rule: no PR gets merged without at least 2 approvals and all comments resolved. Even small PRs.

**Bob Martinez**: That'll slow us down a bit but improve quality. Also, can we enforce linting? I'm seeing inconsistent formatting.

**David Kim**: We have ESLint configured but it's not enforced. Let's make it a pre-commit hook and CI check. No merge if linting fails.

**Bob Martinez**: Perfect. What about the calendar integration code? That's pretty complex with all the timezone handling.

**David Kim**: That needs special attention. Can you write integration tests that cover all the edge cases? Different timezones, DST transitions, recurring events?

**Bob Martinez**: Yeah, I'll create a test matrix. We should also document the timezone handling logic - it's not obvious.

**David Kim**: Good point. Let's add inline comments and a wiki page explaining the approach.

**Bob Martinez**: One more thing - dependency updates. We're 3 versions behind on React Native. Should we upgrade?

**David Kim**: Let's schedule that for next sprint. Upgrading mid-sprint is risky. We'll need to do thorough regression testing.

**Bob Martinez**: Makes sense. So to recap: increase test coverage to 80%, add performance benchmarks, enforce stricter code reviews, pre-commit linting, document complex logic, and schedule dependency updates.

**David Kim**: Exactly. I'll update our engineering standards doc. This will make our codebase way more maintainable.

---

**Action Items:**
- Bob: Add Playwright E2E tests for Arc Reactor drag-and-drop
- Bob: Set up Lighthouse CI for automated performance testing
- Bob: Write integration tests for calendar timezone handling
- David: Configure pre-commit hooks for ESLint
- David: Update CI to fail on linting errors
- David: Document code review requirements (2 approvals minimum)
- Both: Schedule React Native upgrade for next sprint

**Decisions Made:**
- Target test coverage: 80%
- All PRs require 2 approvals minimum
- ESLint enforcement via pre-commit hooks and CI
- Performance budget: 100ms max render time
- Dependency upgrades in dedicated sprint (not mid-sprint)`
  },

  // Business Development - Strategic Planning
  {
    team_id: TEAM_IDS.bizdev,
    meeting_id: 'meeting-bizdev-2-past',
    title: 'Enterprise Sales Strategy & Pricing Review',
    start_time: sixDaysAgo.toISOString(),
    ai_summary: `**Enterprise Sales Strategy & Pricing Review**
Date: ${sixDaysAgo.toLocaleDateString()}
Attendees: Rachel Thompson (CEO), Tina Young (CFO), Emma Wilson (Sales), Grace Taylor (Sales Manager), Steven Walker (CTO)

---

**Rachel Thompson**: Thanks for joining everyone. We need to finalize our enterprise pricing strategy. We've been doing deals at $40-50/user which is working, but I want to make sure we're positioned correctly against competitors.

**Tina Young**: I've been analyzing our unit economics. Our current cost per user is about $13/month, so at $45/user we're at 71% margin. That's healthy.

**Emma Wilson**: From the field, customers are comparing us to Slack plus Asana plus Copilot. That combo runs them $50-60/user, so our $45 pricing is very competitive.

**Grace Taylor**: Agreed. I'm not seeing much price resistance at $45. Where I see pushback is on minimum seat counts. Some prospects want to start with just 20 users.

**Rachel Thompson**: What's our current minimum?

**Grace Taylor**: We've been saying 100 users for enterprise pricing. Below that, we redirect to self-serve.

**Rachel Thompson**: That makes sense from an ops perspective, but are we leaving money on the table? Emma, what do you think?

**Emma Wilson**: I've lost two deals recently because they wanted to start small. Mid-market companies with 50-75 users. They'd pay $50/user if we let them in.

**Tina Young**: So 75 users at $50/month is $45,000 annual contract value. That's decent, but below our $100K ACV target for enterprise segment.

**Rachel Thompson**: What if we create a "Growth" tier? 25-100 users at $50/user, then Enterprise tier for 100+ at $45/user with more features.

**Steven Walker**: From a tech perspective, that's easy. We can gate features based on tier. What features would be Growth vs Enterprise?

**Emma Wilson**: Growth tier gets AI chat, task management, basic integrations. Enterprise adds SSO, premium support, advanced analytics, unlimited integrations.

**Grace Taylor**: I like that. It gives us an upsell path. Start them at Growth, prove value, expand to Enterprise.

**Tina Young**: Let me model this out... If we convert 10 Growth deals at $40K ACV each, that's $400K. Then upsell 3 to Enterprise at $200K each, that's $600K more. Better than losing those deals entirely.

**Rachel Thompson**: Exactly. What about our ceiling? We haven't talked about Fortune 500 pricing.

**Emma Wilson**: For deals over 1,000 users, I think we need custom pricing. They'll want on-prem deployment, dedicated support, SLAs.

**Steven Walker**: On-prem is a big lift. We'd need to package everything in Docker, support their infrastructure, deal with their security audits. That's expensive.

**Tina Young**: We should charge accordingly. I'd say our floor for on-prem is $300K annually, regardless of seat count. Plus professional services fee of $50-100K for deployment.

**Rachel Thompson**: That feels right. Emma, are you seeing demand for on-prem?

**Emma Wilson**: Two prospects have asked. Financial services companies, super paranoid about data. They'd pay premium for on-prem.

**Rachel Thompson**: Okay, so our pricing structure is: Self-serve (1-24 users) at $60/user, Growth (25-99 users) at $50/user, Enterprise (100+) at $45/user, and Custom for 1,000+ or on-prem starting at $300K.

**Grace Taylor**: What about payment terms? Some enterprises want quarterly or monthly billing.

**Tina Young**: For deals under $100K, we should push for annual upfront. Over $100K, we can offer quarterly but no discount. Our cash flow is tight, we need that money upfront.

**Emma Wilson**: That's standard. I haven't seen much resistance to annual billing in enterprise.

**Rachel Thompson**: Good. What about our sales process? How long are deals taking to close?

**Grace Taylor**: Average is 3 months for mid-market, 6-9 months for enterprise. Could be faster if we had better collateral.

**Rachel Thompson**: What's missing?

**Grace Taylor**: Case studies, ROI calculator, comparison sheets vs competitors, demo videos. We're selling on live demos which work but don't scale.

**Steven Walker**: I can get engineering to create demo videos. What angles do you need?

**Emma Wilson**: "Engineering productivity" angle showing JIRA integration and code search. "Executive efficiency" showing meeting intelligence. "Team collaboration" showing team chat.

**Rachel Thompson**: Let's prioritize that. Grace, work with Steven's team on the video scripts. Tina, can you build an ROI calculator?

**Tina Young**: Yeah, I'll model time savings and productivity gains. We can show customers they'll pay for themselves in 3 months.

**Rachel Thompson**: Perfect. Last thing - what's our pipeline looking like for Q4?

**Emma Wilson**: I have 8 deals in late stage, total value around $650K. Should close 4-5 of them.

**Grace Taylor**: My team has another 15 in mid-stage. If we can close 30%, that's another $400K.

**Rachel Thompson**: So we're tracking toward $1M+ in Q4. That's fantastic growth.

**Tina Young**: Just remember, we need to hit $2M ARR by year-end. We're at $1.8M now, so we need $200K more.

**Emma Wilson**: Acme Corp alone is $250K. If I close that, we're there.

**Rachel Thompson**: No pressure, Emma! But seriously, great work everyone. Let's execute on this strategy and dominate Q4.

---

**Action Items:**
- Rachel: Create Growth tier in pricing page and contracts
- Steven: Coordinate with Grace on demo video creation (3 videos)
- Tina: Build ROI calculator tool for sales team
- Grace: Develop case studies and competitor comparison sheets
- Emma: Focus on closing Acme Corp and other late-stage deals
- Tina: Model on-prem pricing economics for Fortune 500

**Decisions Made:**
- New Growth tier: 25-99 users at $50/user
- Enterprise tier: 100+ users at $45/user
- Custom/On-prem: $300K+ for 1,000+ users or on-prem deployment
- Payment terms: Annual upfront for <$100K deals, quarterly for $100K+
- Target Q4: Close $1M in new business to hit $2M ARR
- Sales enablement priority: Demo videos, case studies, ROI calculator`
  }
];

async function createAdditionalMeetings() {
  console.log('📅 Creating Additional Past Meetings\n');
  console.log('═'.repeat(80));

  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'shail@heyjarvis.ai')
    .single();

  const userId = users?.id;
  if (!userId) {
    console.error('❌ Could not find user');
    return;
  }

  console.log(`✓ Using user ID: ${userId}\n`);

  let created = 0;

  for (const meeting of ADDITIONAL_MEETINGS) {
    meeting.user_id = userId;
    
    try {
      const { data, error } = await supabase
        .from('team_meetings')
        .insert(meeting)
        .select()
        .single();

      if (error) {
        console.log(`❌ Failed to create "${meeting.title}":`, error.message);
      } else {
        const meetingDate = new Date(meeting.start_time);
        console.log(`✅ ${meetingDate.toLocaleDateString()} - ${meeting.title}`);
        created++;
      }
    } catch (error) {
      console.log(`❌ Error with "${meeting.title}":`, error.message);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log(`\n✅ Created ${created} additional past meetings`);
  console.log('\n💡 These meetings will show in Team Context (left panel)');
  console.log('💡 Restart desktop app to see the new meetings.');
  console.log('═'.repeat(80));
}

createAdditionalMeetings()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });


