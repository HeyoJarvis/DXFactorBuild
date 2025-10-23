/**
 * Create Team Meetings with Realistic Transcripts
 * 2 meetings per team with natural conversations
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Team IDs
const TEAM_IDS = {
  eng_mobile: '00000000-0000-0000-0000-000000000020',
  func_mobile: '00000000-0000-0000-0000-000000000021',
  eng_desktop: '00000000-0000-0000-0000-000000000022',
  func_desktop: '00000000-0000-0000-0000-000000000023',
  bizdev: '00000000-0000-0000-0000-000000000024'
};

// Calculate dates (recent meetings)
const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const twoDaysAgo = new Date(today);
twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
const threeDaysAgo = new Date(today);
threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
const fourDaysAgo = new Date(today);
fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

const MEETINGS = [
  // Mobile Engineering
  {
    team_id: TEAM_IDS.eng_mobile,
    meeting_id: 'meeting-mobile-eng-1',
    title: 'Mobile Sprint Planning & Architecture Review',
    start_time: yesterday.toISOString(),
    ai_summary: `**Mobile Sprint Planning & Architecture Review**
Date: ${yesterday.toLocaleDateString()}
Attendees: David Kim (Engineering Lead), Bob Martinez (Engineer)

---

**David Kim**: Alright Bob, let's knock out these four SCRUM tickets for the mobile sprint. First up is SCRUM-45, the Arc Reactor UI responsiveness issue. You've been looking at this, right?

**Bob Martinez**: Yeah, I spent yesterday afternoon profiling it. The main problem is we're re-rendering the entire component tree every time the user drags an item. It's causing that janky feeling, especially on older Android devices.

**David Kim**: What's the render count looking like?

**Bob Martinez**: On a single drag operation? Like 60+ renders. Way too many. I think if we memoize the child components with React.memo and debounce the drag handlers, we could get it down to maybe 10-15.

**David Kim**: That sounds right. We should also look at using requestAnimationFrame for the drag updates instead of firing on every mouse move event.

**Bob Martinez**: Good idea. I'll try that. Should take me about 3 days to refactor properly with tests.

**David Kim**: Perfect. So that's you on SCRUM-45. Now SCRUM-47 - desktop notifications for critical tasks. That one's mine. The tricky part is the notification permission flow and making sure they work across different operating systems.

**Bob Martinez**: Are you using the native notification API?

**David Kim**: Yeah, but I'm wrapping it with a fallback system. If the user denies permissions, we'll show in-app toasts instead. Also need to handle the badge counts on mobile properly.

**Bob Martinez**: Makes sense. What about iOS? Don't they have stricter notification rules?

**David Kim**: Yeah, we can only trigger them when the app is in the foreground on iOS unless we set up push notifications properly. I'm coordinating with the backend team on that.

**Bob Martinez**: Cool. That's going to be a big UX win when it's done.

**David Kim**: Definitely. Okay, SCRUM-49 - code search functionality. This is the big one. We need to decide on the architecture here.

**Bob Martinez**: I was thinking ElasticSearch or maybe Algolia?

**David Kim**: I considered both. ElasticSearch would give us more control but it's heavy. What if we just do local indexing with something like Fuse.js? The codebases aren't that massive for most users.

**Bob Martinez**: Hmm, Fuse.js could work for fuzzy search, but what about semantic search? Like if someone searches for "authentication" and we want to find "login" and "auth" related code too?

**David Kim**: Fair point. Maybe we start with Fuse.js for MVP and then add semantic search later with embeddings. We don't want to over-engineer this in the first iteration.

**Bob Martinez**: Yeah, you're right. Let's go with Fuse.js. I can knock that out in probably 4-5 days.

**David Kim**: Perfect. Last one - SCRUM-50, the meeting scheduler with calendar integration. This is probably the most complex because we need to integrate with Google Calendar, Outlook, and maybe Apple Calendar.

**Bob Martinez**: Oh man, calendar APIs are always a pain. Do we have OAuth set up for all those services?

**David Kim**: We have Google and Microsoft OAuth working. Apple Calendar uses CalDAV which is different. I'm thinking we start with Google and Microsoft for V1.

**Bob Martinez**: That covers like 90% of users anyway.

**David Kim**: Exactly. The hard part is handling timezones properly and dealing with recurring events. I'm going to pair with Alice on the desktop team since they dealt with similar calendar stuff before.

**Bob Martinez**: Good call. When are you starting that one?

**David Kim**: After I finish the notifications, so probably next week.

**Bob Martinez**: Alright, so to summarize - I've got Arc Reactor performance and code search, you've got notifications and meeting scheduler.

**David Kim**: Yep. Let's plan to sync mid-sprint, probably Thursday, to see if we're on track. If the Arc Reactor fix is working well, maybe we can get you to help with the calendar integration.

**Bob Martinez**: Sounds good. One more thing - should we coordinate with the Mobile Functional team? Iris was asking about when these features would be ready for the go-to-market plan.

**David Kim**: Yeah, I'll ping her after this. We should probably join their next meeting to give them a proper timeline.

**Bob Martinez**: Cool. Anything else?

**David Kim**: Nope, that's it. Let's crush these tickets!

---

**Action Items:**
- Bob Martinez: Refactor Arc Reactor component with React.memo and requestAnimationFrame (SCRUM-45) - 3 days
- Bob Martinez: Implement code search with Fuse.js (SCRUM-49) - 4-5 days
- David Kim: Build notification system with fallback for permission denial (SCRUM-47) - 1 week
- David Kim: Calendar integration for Google/Microsoft (SCRUM-50) - Next week, pair with Alice
- David Kim: Sync with Mobile Functional team on timeline

**Decisions Made:**
- Use React.memo and debouncing for Arc Reactor performance
- Start with Fuse.js for code search, add semantic search later
- Notifications will have in-app fallback if permissions denied
- Calendar integration: Google + Microsoft only for V1, skip Apple CalDAV initially
- Mid-sprint sync scheduled for Thursday`
  },

  // Mobile Functional
  {
    team_id: TEAM_IDS.func_mobile,
    meeting_id: 'meeting-mobile-func-1',
    title: 'Mobile App Go-to-Market Strategy & Design Review',
    start_time: threeDaysAgo.toISOString(),
    ai_summary: `**Mobile App Go-to-Market Strategy & Design Review**
Date: ${threeDaysAgo.toLocaleDateString()}
Attendees: Iris Anderson (Product Manager, Meeting Lead), Jack Lee (Design), Maya Garcia (Marketing), Kelly Davis (UX Research), Paul Clark (Social Media)

---

**Iris Anderson**: Hey everyone, thanks for jumping on. We've got a lot to cover today - mobile roadmap for Q1, Jack's design system updates, and Maya's launch campaign ideas. Let's start with the roadmap. Based on engineering capacity, we can ship about 8-10 features in Q1.

**Kelly Davis**: Before we dive into features, can I share what I learned from user interviews? It's pretty relevant to prioritization.

**Iris Anderson**: Absolutely, go ahead.

**Kelly Davis**: So I talked to 10 mobile app users this week. The number one request - and I mean every single person mentioned this - was dark mode. They said it's painful to use the app at night.

**Maya Garcia**: Oh wow, that's consistent feedback.

**Jack Lee**: We have dark mode in the design system already, it's just not implemented in the mobile app yet. I can prioritize that.

**Iris Anderson**: How long would that take to implement?

**Jack Lee**: If I focus on it? Maybe a week for the core components. Another week for testing all the edge cases and making sure nothing breaks.

**Iris Anderson**: Okay, let's definitely put that in Q1. Kelly, anything else from the interviews?

**Kelly Davis**: Yeah, people love the notification features David's team is building. They said current task management apps spam them with notifications, so they turn them all off. Our approach of only notifying for critical stuff resonates.

**Paul Clark**: That's actually perfect for social media content. "Tired of notification spam? HeyJarvis only alerts you when it matters." That could be a TikTok series.

**Maya Garcia**: I like that angle. We could do a whole campaign around "notifications done right."

**Iris Anderson**: Good, I'm adding that to the messaging brief. Jack, let's talk about the design system. What's the status?

**Jack Lee**: So I've completed the mobile component library overhaul. We now have 47 components with mobile-specific touch interactions, proper touch targets - minimum 44x44 pixels for all interactive elements - and gesture support for swipe actions.

**Iris Anderson**: That sounds comprehensive. Are they documented?

**Jack Lee**: Yeah, everything's in Figma with code snippets. I also created an interactive prototype so engineers can see exactly how animations should feel.

**Maya Garcia**: Can I see that? I want to get some screenshots for the marketing site.

**Jack Lee**: Sure, I'll send you the Figma link after this. One thing though - I made the components really flexible, but that means engineers need to understand the design tokens system. Should we do a quick training session?

**Iris Anderson**: Yes, let's schedule that. Maybe next week with David and Bob?

**Jack Lee**: Perfect.

**Maya Garcia**: Okay, can I share the launch campaign ideas? I've been working on this all week.

**Iris Anderson**: Go for it.

**Maya Garcia**: So the concept is "Work From Anywhere, Literally." We showcase people using the mobile app in cool locations - coffee shops, parks, even the beach. The tagline is "Your team's brain in your pocket."

**Paul Clark**: I love that. For social, we could do a user-generated content campaign. Ask people to share photos of where they're working and tag us.

**Maya Garcia**: Exactly! And we run paid ads on LinkedIn and Twitter targeting remote workers and startup founders. I'm projecting we can reach about 500,000 impressions with a $15,000 budget.

**Iris Anderson**: What's the conversion rate assumption?

**Maya Garcia**: I'm using 2% click-through and 10% of those becoming signups. So roughly 1,000 new mobile users in the first month.

**Kelly Davis**: Just want to flag - in my interviews, people said they discovered the app through word of mouth, not ads. Maybe we should invest more in referral programs?

**Maya Garcia**: That's a good point. What if we do 60% paid ads, 40% referral incentives?

**Iris Anderson**: I like that split. Maya, can you model out the economics of a referral program? Like what would we give users for referring friends?

**Maya Garcia**: Yeah, I'll put together some options. Maybe a month free for each referral?

**Paul Clark**: What about the TikTok strategy? I think we're missing a huge opportunity there. Mobile users are younger and that's where they hang out.

**Iris Anderson**: What would the content be?

**Paul Clark**: Quick tips, like "15-second productivity hacks with HeyJarvis mobile." Show off the gestures, the quick actions, stuff that looks cool and is actually useful.

**Jack Lee**: I can help with that. The animations I designed are really smooth - they'd look great on video.

**Maya Garcia**: Okay, I'm sold on TikTok. Paul, can you own that channel?

**Paul Clark**: Absolutely. I'll start creating content next week.

**Iris Anderson**: This is great. Let me summarize the roadmap priorities: Dark mode is now P0, notifications are P0, code search P1, and meeting scheduler P1. Jack finishes the design system training, Maya drafts the campaign brief with the referral program economics, and Paul starts the TikTok channel. Kelly, can you do another round of user testing once dark mode is in beta?

**Kelly Davis**: Yep, I'll schedule 5 users for testing.

**Iris Anderson**: Perfect. Anything else?

**Jack Lee**: Just one thing - I'm seeing some inconsistency between our mobile and desktop designs. Should they look the same or is it okay if mobile has its own visual identity?

**Iris Anderson**: Good question. I think mobile can have its own identity as long as it's recognizable as HeyJarvis. Let's chat with Olivia's team to make sure we're aligned on brand.

**Maya Garcia**: Yeah, brand consistency is important. We don't want to confuse users.

**Iris Anderson**: I'll set up a sync with the desktop functional team. Alright, I think we're good. Thanks everyone!

---

**Action Items:**
- Jack Lee: Complete dark mode implementation (2 weeks), conduct design system training with engineering
- Maya Garcia: Draft launch campaign brief, model referral program economics, coordinate with Paul on social strategy
- Paul Clark: Start TikTok content creation, plan 15-second productivity hack series
- Kelly Davis: Schedule 5 user tests for dark mode beta
- Iris Anderson: Sync with Desktop Functional team on brand consistency
- Iris Anderson: Update Q1 roadmap with new priorities

**Decisions Made:**
- Dark mode is now P0 priority for Q1
- Launch campaign: "Work From Anywhere, Literally" concept approved
- Budget split: 60% paid ads, 40% referral program
- TikTok approved as new social channel
- Mobile can have distinct visual identity while staying on-brand
- Target: 1,000 new mobile users in first month post-launch`
  },

  // Desktop Engineering
  {
    team_id: TEAM_IDS.eng_desktop,
    meeting_id: 'meeting-desktop-eng-1',
    title: 'Desktop Platform Technical Sync - Auth & Performance',
    start_time: twoDaysAgo.toISOString(),
    ai_summary: `**Desktop Platform Technical Sync - Auth & Performance**
Date: ${twoDaysAgo.toLocaleDateString()}
Attendees: Alice Chen (Engineering Lead), Carol Johnson (Engineer)

---

**Alice Chen**: Hey Carol, let's do a quick sync on our desktop tickets. I know you've been debugging SCRUM-42, the conversation history not saving issue.

**Carol Johnson**: Oh man, that was a fun bug to track down. Took me like 6 hours yesterday.

**Alice Chen**: Did you find it?

**Carol Johnson**: Yeah! So it wasn't actually a database issue like we thought. The problem was in our SQLite write logic. We were opening a new database connection for each message save, but not properly closing them.

**Alice Chen**: Connection leak?

**Carol Johnson**: Exactly. After about 50 messages, we'd hit the connection limit and writes would silently fail. No errors, nothing. The messages just... disappeared into the void.

**Alice Chen**: Wow, that's a terrible failure mode. How'd you catch it?

**Carol Johnson**: I added debug logging to every database operation and ran a stress test. Sent 100 messages as fast as I could, and boom - connection pool exhausted.

**Alice Chen**: Nice debugging. What's the fix?

**Carol Johnson**: I refactored it to use a connection pool properly. Now we reuse connections and have explicit cleanup. Also added error handlers so if writes fail, we at least log it and show the user an error.

**Alice Chen**: Perfect. How long to test and ship?

**Carol Johnson**: It's ready to go. I tested it with 500 messages and it's solid. I'll merge it today.

**Alice Chen**: Awesome. Okay, my turn to vent about SCRUM-41 - the authentication persistence nightmare.

**Carol Johnson**: Is that the one where users get logged out randomly?

**Alice Chen**: Yes! And it's driving me crazy. The issue is our token refresh logic. We store the JWT in localStorage, which is fine, but the refresh token expires after 7 days.

**Carol Johnson**: And users don't open the app every day, so the refresh token goes stale?

**Alice Chen**: Exactly. Then when they come back a week later, we try to refresh using an expired token, it fails, and boom - logged out.

**Carol Johnson**: Can't we just make the refresh token last longer?

**Alice Chen**: We could, but it's a security risk. The real solution is to store tokens in a more persistent way and have a better refresh strategy. I'm thinking Redis or even just the OS keychain.

**Carol Johnson**: OS keychain is probably better for desktop. It's encrypted by default.

**Alice Chen**: Yeah, that's what I'm leaning towards. Electron has good keychain APIs. The migration is going to be annoying though.

**Carol Johnson**: How many users would be affected?

**Alice Chen**: Every desktop user. But if we do it right, they won't even notice. We'll transparently migrate their tokens on next login.

**Carol Johnson**: When are you doing this?

**Alice Chen**: I'm starting today, probably done in a week. It's pretty critical for user retention.

**Carol Johnson**: For sure. Okay, what about SCRUM-44 - performance with large task lists? I saw that one's assigned to me.

**Alice Chen**: Yeah, users with 500+ tasks are seeing the app slow to a crawl. Takes like 10 seconds to load the task list.

**Carol Johnson**: Are we rendering all 500 tasks at once?

**Alice Chen**: Yep. No virtualization, no lazy loading, just dumping everything into the DOM.

**Carol Johnson**: Ouch. I'm guessing we need a virtual list?

**Alice Chen**: Exactly. I'd use react-window or react-virtualized. Only render what's visible in the viewport, maybe plus 10-20 items as buffer.

**Carol Johnson**: That should get us to under a second load time even with thousands of tasks.

**Alice Chen**: Yeah. Also look at the query - we might be fetching too much data. Do we really need the full task description for the list view?

**Carol Johnson**: Good point. We probably just need ID, title, status, and assignee for the list. Fetch the full details only when someone clicks.

**Alice Chen**: Exactly. That'll reduce the data transfer too.

**Carol Johnson**: I'll prototype this. Should be ready to test by end of week.

**Alice Chen**: Perfect. Oh, SCRUM-46 - JIRA integration. That one's mine too. The OAuth flow keeps breaking for some users.

**Carol Johnson**: What's the error?

**Alice Chen**: Redirect URI mismatch. JIRA is really strict about the redirect URIs being exactly what you registered. If the port changes or there's a trailing slash difference, it fails.

**Carol Johnson**: Can we just hardcode a specific port?

**Alice Chen**: We could, but what if it's in use? I'm thinking we register multiple redirect URIs with JIRA - localhost:3000, :3001, :3002, etc. Then try each one until we find an available port.

**Carol Johnson**: That's clever. Sounds like a pain to set up though.

**Alice Chen**: Yeah, I'll need to update our JIRA app configuration. Should be done this week though.

**Carol Johnson**: Cool. Last one - SCRUM-48, GitHub integration. Similar to JIRA?

**Alice Chen**: Pretty much identical OAuth flow. Once I fix JIRA, I can copy the pattern to GitHub. They're both OAuth 2.0 with PKCE.

**Carol Johnson**: Want me to help with that?

**Alice Chen**: Actually yeah. If you handle GitHub while I do JIRA, we can knock them both out in parallel. The OAuth handler class is abstracted enough that you just need to swap in GitHub's endpoints.

**Carol Johnson**: I can do that. Send me the docs?

**Alice Chen**: Yeah, I'll drop the GitHub OAuth docs in Slack.

**Carol Johnson**: Perfect. So to recap - I'm shipping the conversation history fix today, starting on task list performance, and picking up GitHub OAuth. You're doing auth persistence and JIRA OAuth.

**Alice Chen**: Yep. Let's plan to sync again Friday to see where we're at.

**Carol Johnson**: Sounds good. One question though - are you coordinating with the mobile team at all? They might hit similar auth issues.

**Alice Chen**: Good call. David mentioned something about notification permissions. Let me ping him.

**Carol Johnson**: Cool. Anything else?

**Alice Chen**: Nope, that's it. Good work on finding that SQLite bug - that was sneaky.

**Carol Johnson**: Thanks! Talk Friday.

---

**Action Items:**
- Carol Johnson: Merge conversation history fix today (SCRUM-42)
- Carol Johnson: Implement virtual list for task performance (SCRUM-44) - end of week
- Carol Johnson: GitHub OAuth integration (SCRUM-48) - parallel with Alice's JIRA work
- Alice Chen: Migrate to OS keychain for token storage (SCRUM-41) - 1 week
- Alice Chen: Fix JIRA OAuth redirect URI handling (SCRUM-46) - this week
- Alice Chen: Coordinate with mobile team on auth issues
- Both: Friday sync to check progress

**Decisions Made:**
- Use OS keychain for secure token storage instead of localStorage
- Implement react-window for task list virtualization
- Register multiple redirect URIs with JIRA to handle port conflicts
- GitHub and JIRA OAuth will use same abstracted handler pattern
- Only fetch minimal task data for list view, full details on click`
  },

  // Desktop Functional
  {
    team_id: TEAM_IDS.func_desktop,
    meeting_id: 'meeting-desktop-func-1',
    title: 'Desktop Platform Marketing & Analytics Review',
    start_time: yesterday.toISOString(),
    ai_summary: `**Desktop Platform Marketing & Analytics Review**
Date: ${yesterday.toLocaleDateString()}
Attendees: Olivia Harris (Brand Manager, Meeting Lead), Leo White (Product Analytics), Nathan Miller (SEO Specialist), Quinn Lewis (Marketing Analytics)

---

**Olivia Harris**: Hey team, let's kick this off. I want to review the analytics first since Leo has some exciting news, then I'll show the updated brand guidelines, and Nathan can share the SEO wins. Leo, you're up.

**Leo White**: Okay so I spent the last week building out our desktop analytics dashboard in Mixpanel and the numbers are really good. Desktop retention is sitting at 85% after 7 days.

**Quinn Lewis**: Wait, 85%? That's incredible. What's industry average?

**Leo White**: For B2B SaaS tools, it's usually around 40-60%. We're crushing it.

**Nathan Miller**: What do you think is driving that?

**Leo White**: I did a cohort analysis. Users who complete the onboarding flow and add at least one integration in their first session have 95% retention. So it's all about getting them integrated quickly.

**Olivia Harris**: That's really valuable. We should make that a focus for the marketing messaging - "Get integrated in 60 seconds" or something like that.

**Quinn Lewis**: I can back that up with data. Looking at our attribution model, desktop conversions are where we're seeing the most value. Desktop users drive 70% of our paid conversions.

**Leo White**: Yeah, and they spend more time in the app. Average session length is 23 minutes on desktop vs 8 minutes on mobile.

**Nathan Miller**: Makes sense. People do deep work on desktop, quick checks on mobile.

**Olivia Harris**: This is all really helpful for positioning. What about feature adoption? Are people actually using the JIRA and GitHub integrations?

**Leo White**: Great question. 68% of active desktop users have connected at least one integration. JIRA is the most popular at 45%, GitHub is 38%, and Slack is 32%.

**Quinn Lewis**: Do people who connect multiple integrations have higher retention?

**Leo White**: Oh yeah. If someone connects 2+ integrations, retention jumps to 92%. They're basically locked in at that point.

**Olivia Harris**: We need to push multiple integrations in onboarding then. Okay, let me show you the brand guidelines update. I'll share my screen.

**Nathan Miller**: Before you do that, can I quickly share the SEO stuff? It ties into brand.

**Olivia Harris**: Sure, go ahead.

**Nathan Miller**: So we're absolutely dominating for "team collaboration desktop app." We're ranking #1 on Google, above Slack, Microsoft Teams, all of them. Also #1 for "developer productivity desktop."

**Quinn Lewis**: That's huge. How much traffic is that bringing in?

**Nathan Miller**: About 2,500 organic visits per month just from those two keywords. And it's growing 15% month-over-month.

**Olivia Harris**: What's the conversion rate on organic traffic?

**Quinn Lewis**: I can answer that. Organic desktop traffic converts at 12%, which is way higher than paid ads at 4%.

**Nathan Miller**: People searching for specific terms are high-intent. They know what they want.

**Olivia Harris**: Okay, so we need to double down on desktop SEO. Nathan, what's your plan?

**Nathan Miller**: I want to optimize 5 more landing pages - one for each major integration. Like "JIRA Desktop Integration" and "GitHub Desktop Client." Target long-tail keywords.

**Leo White**: Can you coordinate with me on that? I can give you data on which integrations people search for most.

**Nathan Miller**: Perfect, yeah. Send me that data.

**Olivia Harris**: Alright, brand guidelines time. So I've updated the entire brand book for desktop. The key changes are around typography - we're using SF Pro for desktop since it's optimized for macOS and Windows. Also standardized the color palette to use system colors where possible so we look native.

**Quinn Lewis**: Will this be consistent with mobile?

**Olivia Harris**: Mostly yeah. The core brand elements - logo, brand voice, color palette - are the same. But desktop has more room for whitespace and larger typography, so it'll feel a bit different.

**Nathan Miller**: As long as it's recognizable, I think that's fine. Can I use these brand assets for the landing pages?

**Olivia Harris**: Yes, everything's in Figma. I'll give you edit access. The component library has all the buttons, forms, everything you need.

**Leo White**: Question - are we measuring brand perception at all? Like do users think of us as a "desktop tool" or a "mobile-first" tool?

**Olivia Harris**: Not yet, but that's a good idea. We could add a survey question in the NPS flow.

**Quinn Lewis**: I can set that up. We send NPS surveys 30 days after signup. I'll add a brand perception question.

**Leo White**: Cool. I'd love to see if there's a correlation between brand perception and retention.

**Olivia Harris**: Same. Okay, let me talk about the brand positioning. I'm proposing we position desktop as the "power user" version. Mobile is for quick tasks and on-the-go, desktop is for deep work and complex workflows.

**Nathan Miller**: I like that. It differentiates them clearly.

**Quinn Lewis**: And it matches the usage data. Desktop users have longer sessions and use more features.

**Olivia Harris**: Exactly. So in marketing copy, we'd say things like "Desktop: Built for focused work" and "Mobile: Your team in your pocket."

**Leo White**: Can we test that messaging? Maybe an A/B test on the homepage?

**Quinn Lewis**: Yeah, I can set that up. We'd measure impact on signup rate and which platform people choose.

**Olivia Harris**: Let's do it. Nathan, can you make two versions of the homepage with different messaging?

**Nathan Miller**: Sure, I'll have that ready next week. What's the success metric?

**Quinn Lewis**: I'd say desktop signups. We want to drive high-intent users to desktop since they convert better.

**Olivia Harris**: Agreed. Alright, let's talk about the timeline. I need to finalize these brand guidelines by end of week. Nathan, you're optimizing 5 landing pages. Quinn, you're setting up the A/B test and adding the NPS question. Leo, you're providing the integration data to Nathan.

**Leo White**: All good on my end. I'll send that data today.

**Nathan Miller**: I'll have the landing pages done in two weeks.

**Quinn Lewis**: A/B test will be live next week.

**Olivia Harris**: Perfect. One last thing - we should coordinate with the mobile functional team. Iris mentioned they're doing a launch campaign and we should make sure our messaging is aligned.

**Nathan Miller**: Yeah, we don't want to contradict each other.

**Olivia Harris**: I'll set up a meeting with them. Alright, I think we're good. Thanks everyone!

---

**Action Items:**
- Olivia Harris: Finalize desktop brand guidelines by end of week
- Olivia Harris: Schedule alignment meeting with mobile functional team
- Leo White: Send integration usage data to Nathan today
- Leo White: Add NPS brand perception question with Quinn
- Nathan Miller: Optimize 5 integration landing pages (2 weeks)
- Nathan Miller: Create two homepage versions for A/B test (next week)
- Quinn Lewis: Set up homepage A/B test (live next week)
- Quinn Lewis: Add brand perception question to NPS survey

**Decisions Made:**
- Desktop positioned as "power user" version for deep work
- Mobile positioned as "quick tasks on-the-go"
- Desktop uses SF Pro typography and system colors for native feel
- Focus marketing on multiple integration adoption (drives 92% retention)
- Double down on desktop SEO - target integration-specific keywords
- Success metric: desktop signups from high-intent organic traffic`
  },

  // Business Development
  {
    team_id: TEAM_IDS.bizdev,
    meeting_id: 'meeting-bizdev-1',
    title: 'Q4 Board Prep & Revenue Strategy Meeting',
    start_time: fourDaysAgo.toISOString(),
    ai_summary: `**Q4 Board Prep & Revenue Strategy Meeting**
Date: ${fourDaysAgo.toLocaleDateString()}
Attendees: Rachel Thompson (CEO, Meeting Lead), Steven Walker (CTO), Tina Young (CFO), Emma Wilson (Senior Account Executive), Grace Taylor (Sales Manager), Frank Rodriguez (Account Executive), Henry Brown (Sales Development Rep)

---

**Rachel Thompson**: Thanks everyone for making time. Board meeting is in two weeks and we need to be crisp on the narrative. Tina, let's start with the numbers.

**Tina Young**: Sure. We're at $1.8M ARR as of yesterday. Q4 started at $1.5M, so we've added $300K this quarter.

**Rachel Thompson**: That's 20% growth in three months. Are we on track for the $2M target?

**Tina Young**: If Emma closes Acme, yes. That's a $250K deal which would put us at $2.05M.

**Rachel Thompson**: Emma, where are we on Acme?

**Emma Wilson**: Final negotiations happening next Tuesday. I'm meeting with their VP of Engineering and CFO. They've already approved the budget, we're just hammering out the contract terms.

**Rachel Thompson**: Confidence level?

**Emma Wilson**: 85%. The only risk is if their legal team pushes back on the data processing addendum. But we've been through three rounds of redlines already, so I think we're good.

**Steven Walker**: What's the deployment timeline if they sign?

**Emma Wilson**: They want to onboard 500 employees. We'd do a phased rollout - 50 users in week one, then scale up over a month.

**Steven Walker**: That's going to hammer our infrastructure. We're already at 70% capacity.

**Rachel Thompson**: Steven, let's come back to infrastructure in a minute. Grace, how's the rest of the pipeline looking?

**Grace Taylor**: We have 12 deals in late stage, total value of about $450K ARR. Realistic close rate is 40%, so call it $180K.

**Frank Rodriguez**: I've got two of those deals. One is a Y Combinator startup that's growing fast - they need to close by end of month for their board meeting.

**Rachel Thompson**: What's the deal size?

**Frank Rodriguez**: $50K ARR. They want 200 seats initially.

**Grace Taylor**: Frank's been crushing it on the YC batch. He's scheduled 30 demos in the last two weeks.

**Rachel Thompson**: That's great momentum. Henry, what's your take from the SDR perspective?

**Henry Brown**: Outbound is working really well. I'm seeing 22% response rate on cold emails, up from 15% last quarter. The key message that's resonating is "no more integration hell."

**Grace Taylor**: Yeah, that message is strong. People are tired of jumping between 10 different tools.

**Emma Wilson**: Acme specifically mentioned that. They're using JIRA, GitHub, Slack, Microsoft Teams, and like five other tools. They want one place to see everything.

**Rachel Thompson**: Good, that validates our positioning. Tina, walk us through what you're showing the board for financials.

**Tina Young**: I'll have three slides. First is revenue growth - $1.5M to $2M in 12 months, that's 33% year-over-year. Second is unit economics - CAC is $3,200, LTV is $18,000, so LTV:CAC ratio of 5.6x. Third is cash position - we have 18 months of runway at current burn.

**Rachel Thompson**: Are they going to ask about profitability?

**Tina Young**: Definitely. I'll say we can be cash-flow positive by Q3 2024 if we maintain current growth rates and don't significantly increase headcount.

**Steven Walker**: Speaking of headcount, we need to hire an engineering leader. I'm maxing out at 40 engineers across mobile and desktop teams.

**Rachel Thompson**: I know, it's on my radar. We should discuss this in the board meeting too. What role exactly?

**Steven Walker**: VP of Engineering. Someone who can own the roadmap, coordinate between teams, and scale the org to 100 engineers.

**Rachel Thompson**: Timeline?

**Steven Walker**: I'd like them to start Q1. Which means we need to start interviews like now.

**Rachel Thompson**: Okay, let's make that part of the board ask. We'll request budget for VP Engineering plus two senior engineering managers.

**Tina Young**: That'll add about $800K annually to the expense run rate.

**Rachel Thompson**: Worth it if we're trying to scale to $10M ARR next year.

**Emma Wilson**: Are we still targeting $10M for next year?

**Rachel Thompson**: That's the plan. It's aggressive but achievable if we nail the product-market fit and enterprise sales motion.

**Grace Taylor**: We'd need to add about 4-5 more account executives too. I can't scale the team alone.

**Rachel Thompson**: Noted. Let's plan for that in the board discussion too. Okay, Steven, tell me about the infrastructure scaling issue.

**Steven Walker**: We're running on AWS, currently spending about $25K/month. If we onboard Acme's 500 users plus Frank's deals, we'll need to provision more capacity. I estimate another $15K/month in cloud costs.

**Tina Young**: That's manageable. I'll budget it.

**Steven Walker**: Bigger issue is the engineering work to actually scale the systems. We have some bottlenecks in the database layer and the real-time sync engine.

**Rachel Thompson**: How long to fix?

**Steven Walker**: Two months with dedicated engineering focus. I'd need to pull Alice and Carol off feature work to do infrastructure improvements.

**Rachel Thompson**: Can we afford to pause features for two months?

**Emma Wilson**: Honestly, from a sales perspective, the features we have now are pretty strong. What I really need is better performance and reliability. Acme is worried about uptime.

**Grace Taylor**: Same. Prospects keep asking about our SLA. We need to get to 99.9% uptime.

**Steven Walker**: We're at 99.5% now. Getting to 99.9% requires redundancy, better monitoring, and fixing these infrastructure issues.

**Rachel Thompson**: Okay, so we pause features in Q1, focus on infrastructure, and come out of it with a rock-solid platform that can handle enterprise scale. Is everyone aligned on that?

**Emma Wilson**: Yes, that would actually help me close more enterprise deals.

**Tina Young**: From a financial perspective, it makes sense. We need the platform to support the revenue growth.

**Rachel Thompson**: Good. I'll position that to the board as "scaling for enterprise." Alright, let me summarize the board narrative: We grew 33% to $2M ARR, our unit economics are strong, we have 18 months of runway, and we're investing in scaling - both the team with a VP of Engineering, and the infrastructure to support enterprise customers. We're targeting $10M ARR next year, which requires aggressive but achievable growth. Does that sound right?

**Tina Young**: That's the story, yep.

**Steven Walker**: Just want to make sure the board understands the infrastructure investment is critical. We can't keep growing without it.

**Rachel Thompson**: I'll make that clear. Emma, anything else from the sales side?

**Emma Wilson**: Just that I need the sales training that Grace is planning. We have new features shipping and I need to understand them to sell effectively.

**Grace Taylor**: Training is scheduled for next week. Two-hour session covering all the Q4 features.

**Rachel Thompson**: Perfect. Frank, Henry - anything from you two?

**Frank Rodriguez**: Nope, just going to keep crushing these demos.

**Henry Brown**: Same here. I'll keep cleaning up the CRM data like Grace asked.

**Grace Taylor**: Yeah, thank you Henry. The duplicate accounts were making reporting a nightmare.

**Rachel Thompson**: Alright, this is a solid plan. Tina, send me the board deck draft by Monday so I can review. Steven, let's sync separately on the VP Engineering job description. Emma, good luck on Tuesday with Acme - you've got this.

**Emma Wilson**: Thanks, I'll send an update right after the meeting.

**Rachel Thompson**: Perfect. Let's close Q4 strong, everyone. See you at the board meeting.

---

**Action Items:**
- Tina Young: Send board deck draft to Rachel by Monday
- Emma Wilson: Close Acme Corp deal - final negotiations Tuesday ($250K ARR)
- Emma Wilson: Send update after Acme meeting
- Grace Taylor: Conduct sales training session next week on Q4 features
- Frank Rodriguez: Continue YC startup outreach, close 2 late-stage deals
- Henry Brown: Complete CRM data cleanup for Salesforce
- Steven Walker: Create VP Engineering job description with Rachel
- Steven Walker: Plan infrastructure scaling work (2-month timeline)
- Rachel Thompson: Prepare board meeting presentation with infrastructure investment narrative

**Decisions Made:**
- Target: Close Q4 at $2M ARR (need Acme deal to hit target)
- Q1 engineering focus: Infrastructure scaling over new features (2 months)
- Hiring plan: VP Engineering + 2 Senior Engineering Managers + 4-5 Account Executives
- Board narrative: "Scaling for enterprise" - 33% growth, strong unit economics, 18-month runway
- Target for 2024: $10M ARR (aggressive but achievable)
- Infrastructure budget increase: +$15K/month in cloud costs
- Sales positioning: "No more integration hell" resonates with enterprise buyers
- SLA improvement goal: 99.5% → 99.9% uptime for enterprise credibility`
  }
];

async function createMeetings() {
  console.log('📅 Creating Team Meetings with Transcripts\n');
  console.log('═'.repeat(80));

  // Get a user_id (meetings need to be created by someone)
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'shail@heyjarvis.ai')
    .single();

  const userId = users?.id;
  if (!userId) {
    console.error('❌ Could not find user. Meetings need a user_id.');
    return;
  }

  console.log(`✓ Using user ID: ${userId}\n`);

  let created = 0;

  for (const meeting of MEETINGS) {
    // Add user_id to meeting
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
        console.log(`✅ Created: ${meeting.title}`);
        created++;
      }
    } catch (error) {
      console.log(`❌ Error with "${meeting.title}":`, error.message);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log(`\n✅ Created ${created} out of ${MEETINGS.length} meetings`);
  console.log('\n' + '═'.repeat(80));
  console.log('\n💬 TESTING GUIDE - Questions to Ask in Team Chat:\n');
  console.log('─'.repeat(80));
  
  console.log('\n**Mobile Engineering Team:**');
  console.log('- "What did David and Bob decide about the Arc Reactor performance issue?"');
  console.log('- "What\'s the status of the notification system?"');
  console.log('- "Why did they choose Fuse.js over ElasticSearch?"');
  console.log('- "When is the calendar integration starting?"');
  
  console.log('\n**Mobile Functional Team:**');
  console.log('- "What did users say in Kelly\'s interviews?"');
  console.log('- "What\'s the mobile launch campaign concept?"');
  console.log('- "What are our retention numbers for mobile?"');
  console.log('- "What\'s Paul\'s TikTok strategy?"');
  
  console.log('\n**Desktop Engineering Team:**');
  console.log('- "How did Carol fix the conversation history bug?"');
  console.log('- "What\'s Alice\'s solution for the auth persistence issue?"');
  console.log('- "What\'s causing the performance problem with large task lists?"');
  console.log('- "How are they handling the JIRA OAuth redirect issues?"');
  
  console.log('\n**Desktop Functional Team:**');
  console.log('- "What are our desktop retention numbers?"');
  console.log('- "Which integrations are most popular?"');
  console.log('- "What\'s our SEO ranking for team collaboration?"');
  console.log('- "How is desktop positioned vs mobile?"');
  
  console.log('\n**Business Development Team:**');
  console.log('- "What\'s our current ARR?"');
  console.log('- "What\'s the status of the Acme deal?"');
  console.log('- "What did Rachel tell the board?"');
  console.log('- "Why are we pausing features in Q1?"');
  console.log('- "What engineering hiring is planned?"');
  
  console.log('\n' + '═'.repeat(80));
  console.log('\n💡 These meetings reference actual tasks in the system!');
  console.log('💡 Restart desktop app to see meetings in team context.');
  console.log('═'.repeat(80));
}

createMeetings()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

