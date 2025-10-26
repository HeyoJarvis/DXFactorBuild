#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupTeams() {
  console.log('🧹 Cleaning up teams...\n');

  try {
    // First, get all teams
    const { data: teams, error: fetchError } = await supabase
      .from('teams')
      .select('id, name, slug');

    if (fetchError) {
      console.error('❌ Error fetching teams:', fetchError.message);
      return;
    }

    console.log('📋 Current teams:');
    teams.forEach(t => console.log(`  - ${t.name} (${t.slug})`));

    // Teams to KEEP
    const keepTeams = ['Engineering', 'Sales', 'Product', 'Marketing', 'Executive'];
    
    // Teams to DELETE
    const teamsToDelete = teams.filter(t => !keepTeams.includes(t.name));

    console.log('\n🗑️  Teams to delete:');
    teamsToDelete.forEach(t => console.log(`  - ${t.name} (${t.slug})`));

    console.log('\n✅ Teams to keep:');
    const teamsToKeep = teams.filter(t => keepTeams.includes(t.name));
    teamsToKeep.forEach(t => console.log(`  - ${t.name} (${t.slug})`));

    // Delete the unwanted teams
    if (teamsToDelete.length > 0) {
      console.log('\n💥 Deleting teams...');
      
      for (const team of teamsToDelete) {
        const { error: deleteError } = await supabase
          .from('teams')
          .delete()
          .eq('id', team.id);

        if (deleteError) {
          console.error(`  ❌ Failed to delete ${team.name}:`, deleteError.message);
        } else {
          console.log(`  ✅ Deleted ${team.name}`);
        }
      }
    }

    // Verify
    const { data: finalTeams } = await supabase
      .from('teams')
      .select('name, slug')
      .order('name');

    console.log('\n✨ Final teams:');
    finalTeams.forEach(t => console.log(`  - ${t.name}`));

    console.log('\n✅ Cleanup complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  process.exit(0);
}

cleanupTeams();


