const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkAllUsers() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Get all unique user_ids
  const { data: sessions, error } = await supabase
    .from('conversation_sessions')
    .select('user_id, workflow_type')
    .order('started_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  const users = [...new Set(sessions.map(s => s.user_id))];
  console.log('👥 Users in database:', users);
  console.log();

  // Check what desktop-user has
  const desktopUserSessions = sessions.filter(s => s.user_id === 'desktop-user');
  console.log(`🖥️  desktop-user has ${desktopUserSessions.length} sessions`);
  
  if (desktopUserSessions.length > 0) {
    console.log('Sessions:');
    desktopUserSessions.forEach(s => {
      console.log(`  - ${s.workflow_type}`);
    });
  }
}

checkAllUsers().catch(console.error);

