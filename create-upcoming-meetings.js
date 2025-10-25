/**
 * Create Upcoming Team Meetings for Calendar View
 * Future meetings with dates in the next 2 weeks
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

// Calculate future dates
const today = new Date();

const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(14, 0, 0, 0); // 2 PM

const twoDaysLater = new Date(today);
twoDaysLater.setDate(twoDaysLater.getDate() + 2);
twoDaysLater.setHours(10, 30, 0, 0); // 10:30 AM

const threeDaysLater = new Date(today);
threeDaysLater.setDate(threeDaysLater.getDate() + 3);
threeDaysLater.setHours(15, 0, 0, 0); // 3 PM

const fourDaysLater = new Date(today);
fourDaysLater.setDate(fourDaysLater.getDate() + 4);
fourDaysLater.setHours(11, 0, 0, 0); // 11 AM

const fiveDaysLater = new Date(today);
fiveDaysLater.setDate(fiveDaysLater.getDate() + 5);
fiveDaysLater.setHours(13, 0, 0, 0); // 1 PM

const oneWeekLater = new Date(today);
oneWeekLater.setDate(oneWeekLater.getDate() + 7);
oneWeekLater.setHours(10, 0, 0, 0); // 10 AM

const tenDaysLater = new Date(today);
tenDaysLater.setDate(tenDaysLater.getDate() + 10);
tenDaysLater.setHours(14, 30, 0, 0); // 2:30 PM

const twoWeeksLater = new Date(today);
twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
twoWeeksLater.setHours(9, 0, 0, 0); // 9 AM

// Helper to calculate end time (meetings are 30 min or 1 hour)
const addMinutes = (date, minutes) => {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
};

const UPCOMING_MEETINGS = [
  // Mobile Engineering Team
  {
    team_id: TEAM_IDS.eng_mobile,
    meeting_id: 'upcoming-mobile-eng-1',
    title: 'Sprint Retrospective & Planning',
    start_time: tomorrow.toISOString(),
    end_time: addMinutes(tomorrow, 60).toISOString(),
    attendees: ['David Kim', 'Bob Martinez'],
    metadata: {
      platform: 'Google Meet',
      organizer: 'David Kim'
    }
  },
  {
    team_id: TEAM_IDS.eng_mobile,
    meeting_id: 'upcoming-mobile-eng-2',
    title: 'Arc Reactor Performance Review',
    start_time: fourDaysLater.toISOString(),
    end_time: addMinutes(fourDaysLater, 30).toISOString(),
    attendees: ['Bob Martinez', 'David Kim'],
    metadata: {
      platform: 'Zoom',
      organizer: 'Bob Martinez'
    }
  },
  {
    team_id: TEAM_IDS.eng_mobile,
    meeting_id: 'upcoming-mobile-eng-3',
    title: 'Mobile Architecture Deep Dive',
    start_time: oneWeekLater.toISOString(),
    end_time: addMinutes(oneWeekLater, 90).toISOString(),
    attendees: ['David Kim', 'Bob Martinez'],
    metadata: {
      platform: 'Google Meet',
      organizer: 'David Kim'
    }
  },

  // Mobile Functional Team
  {
    team_id: TEAM_IDS.func_mobile,
    meeting_id: 'upcoming-mobile-func-1',
    title: 'Dark Mode Beta User Testing Debrief',
    start_time: twoDaysLater.toISOString(),
    end_time: addMinutes(twoDaysLater, 45).toISOString(),
    attendees: ['Kelly Davis', 'Iris Anderson', 'Jack Lee'],
    metadata: {
      platform: 'Zoom',
      organizer: 'Kelly Davis'
    }
  },
  {
    team_id: TEAM_IDS.func_mobile,
    meeting_id: 'upcoming-mobile-func-2',
    title: 'Launch Campaign Creative Review',
    start_time: fiveDaysLater.toISOString(),
    end_time: addMinutes(fiveDaysLater, 60).toISOString(),
    attendees: ['Maya Garcia', 'Paul Clark', 'Jack Lee', 'Iris Anderson'],
    metadata: {
      platform: 'Google Meet',
      organizer: 'Maya Garcia'
    }
  },
  {
    team_id: TEAM_IDS.func_mobile,
    meeting_id: 'upcoming-mobile-func-3',
    title: 'Q1 Mobile Roadmap Finalization',
    start_time: tenDaysLater.toISOString(),
    end_time: addMinutes(tenDaysLater, 60).toISOString(),
    attendees: ['Iris Anderson', 'Jack Lee', 'Maya Garcia', 'Kelly Davis', 'Paul Clark'],
    metadata: {
      platform: 'Google Meet',
      organizer: 'Iris Anderson'
    }
  },

  // Desktop Engineering Team
  {
    team_id: TEAM_IDS.eng_desktop,
    meeting_id: 'upcoming-desktop-eng-1',
    title: 'OAuth Integration Sync',
    start_time: tomorrow.toISOString(),
    end_time: addMinutes(tomorrow, 30).toISOString(),
    attendees: ['Alice Chen', 'Carol Johnson'],
    metadata: {
      platform: 'Zoom',
      organizer: 'Alice Chen'
    }
  },
  {
    team_id: TEAM_IDS.eng_desktop,
    meeting_id: 'upcoming-desktop-eng-2',
    title: 'Performance Optimization Results',
    start_time: threeDaysLater.toISOString(),
    end_time: addMinutes(threeDaysLater, 45).toISOString(),
    attendees: ['Carol Johnson', 'Alice Chen'],
    metadata: {
      platform: 'Google Meet',
      organizer: 'Carol Johnson'
    }
  },
  {
    team_id: TEAM_IDS.eng_desktop,
    meeting_id: 'upcoming-desktop-eng-3',
    title: 'Desktop Platform Code Review',
    start_time: oneWeekLater.toISOString(),
    end_time: addMinutes(oneWeekLater, 60).toISOString(),
    attendees: ['Alice Chen', 'Carol Johnson'],
    metadata: {
      platform: 'Google Meet',
      organizer: 'Alice Chen'
    }
  },

  // Desktop Functional Team
  {
    team_id: TEAM_IDS.func_desktop,
    meeting_id: 'upcoming-desktop-func-1',
    title: 'Landing Page A/B Test Results',
    start_time: twoDaysLater.toISOString(),
    end_time: addMinutes(twoDaysLater, 45).toISOString(),
    attendees: ['Nathan Miller', 'Quinn Lewis', 'Olivia Harris'],
    metadata: {
      platform: 'Zoom',
      organizer: 'Nathan Miller'
    }
  },
  {
    team_id: TEAM_IDS.func_desktop,
    meeting_id: 'upcoming-desktop-func-2',
    title: 'Brand Guidelines Implementation Review',
    start_time: fiveDaysLater.toISOString(),
    end_time: addMinutes(fiveDaysLater, 30).toISOString(),
    attendees: ['Olivia Harris', 'Nathan Miller', 'Leo White'],
    metadata: {
      platform: 'Google Meet',
      organizer: 'Olivia Harris'
    }
  },
  {
    team_id: TEAM_IDS.func_desktop,
    meeting_id: 'upcoming-desktop-func-3',
    title: 'Desktop Analytics Deep Dive',
    start_time: oneWeekLater.toISOString(),
    end_time: addMinutes(oneWeekLater, 60).toISOString(),
    attendees: ['Leo White', 'Quinn Lewis', 'Olivia Harris', 'Nathan Miller'],
    metadata: {
      platform: 'Google Meet',
      organizer: 'Leo White'
    }
  },

  // Business Development Team
  {
    team_id: TEAM_IDS.bizdev,
    meeting_id: 'upcoming-bizdev-1',
    title: 'Acme Corp Deal Closing Celebration',
    start_time: threeDaysLater.toISOString(),
    end_time: addMinutes(threeDaysLater, 30).toISOString(),
    attendees: ['Emma Wilson', 'Rachel Thompson', 'Grace Taylor', 'Tina Young'],
    metadata: {
      platform: 'Google Meet',
      organizer: 'Emma Wilson'
    }
  },
  {
    team_id: TEAM_IDS.bizdev,
    meeting_id: 'upcoming-bizdev-2',
    title: 'Board Meeting Preparation',
    start_time: fiveDaysLater.toISOString(),
    end_time: addMinutes(fiveDaysLater, 90).toISOString(),
    attendees: ['Rachel Thompson', 'Tina Young', 'Steven Walker', 'Emma Wilson', 'Grace Taylor'],
    metadata: {
      platform: 'Zoom',
      organizer: 'Rachel Thompson'
    }
  },
  {
    team_id: TEAM_IDS.bizdev,
    meeting_id: 'upcoming-bizdev-3',
    title: 'Q1 Sales Kickoff Planning',
    start_time: oneWeekLater.toISOString(),
    end_time: addMinutes(oneWeekLater, 60).toISOString(),
    attendees: ['Grace Taylor', 'Emma Wilson', 'Frank Rodriguez', 'Henry Brown'],
    metadata: {
      platform: 'Google Meet',
      organizer: 'Grace Taylor'
    }
  },
  {
    team_id: TEAM_IDS.bizdev,
    meeting_id: 'upcoming-bizdev-4',
    title: 'Board Meeting (External)',
    start_time: twoWeeksLater.toISOString(),
    end_time: addMinutes(twoWeeksLater, 120).toISOString(),
    attendees: ['Rachel Thompson', 'Tina Young', 'Steven Walker', 'Board Members'],
    metadata: {
      platform: 'Google Meet',
      organizer: 'Rachel Thompson',
      importance_score: 95
    },
    is_important: true
  }
];

async function createUpcomingMeetings() {
  console.log('📅 Creating Upcoming Team Meetings for Calendar\n');
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

  for (const meeting of UPCOMING_MEETINGS) {
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
        const meetingDate = new Date(meeting.start_time);
        console.log(`✅ ${meetingDate.toLocaleDateString()} ${meetingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${meeting.title}`);
        created++;
      }
    } catch (error) {
      console.log(`❌ Error with "${meeting.title}":`, error.message);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log(`\n✅ Created ${created} out of ${UPCOMING_MEETINGS.length} upcoming meetings`);
  console.log('\n📊 Summary by Team:');
  
  // Count by team
  const byTeam = {};
  UPCOMING_MEETINGS.forEach(m => {
    const teamName = Object.keys(TEAM_IDS).find(key => TEAM_IDS[key] === m.team_id);
    byTeam[teamName] = (byTeam[teamName] || 0) + 1;
  });
  
  Object.entries(byTeam).forEach(([team, count]) => {
    console.log(`  - ${team}: ${count} meetings`);
  });

  console.log('\n' + '═'.repeat(80));
  console.log('\n💡 These meetings will show up in the Team Calendar on the right side!');
  console.log('💡 Restart desktop app to see upcoming meetings.');
  console.log('═'.repeat(80));
}

createUpcomingMeetings()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

