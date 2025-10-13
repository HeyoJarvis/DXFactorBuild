/**
 * 🧪 DETAILED MICROSOFT TEAMS & OUTLOOK TESTING
 * 
 * Run this in the Electron DevTools Console after authenticating with Microsoft
 */

console.log('📋 MICROSOFT TEAMS & OUTLOOK TESTING GUIDE\n');

// Helper to format results
function formatResult(result) {
  if (result.success) {
    console.log('✅ SUCCESS');
    return result;
  } else {
    console.error('❌ FAILED:', result.error);
    return result;
  }
}

// Test functions
window.testMicrosoft = {
  
  // 1. Health Check
  async healthCheck() {
    console.log('\n🏥 1. Health Check');
    const result = await window.electronAPI.microsoft.healthCheck();
    console.log(result);
    return result;
  },

  // 2. Check Scopes
  async checkScopes() {
    console.log('\n🔐 2. Checking Configured Scopes');
    const result = await window.electronAPI.microsoft.test({ action: "check_scopes" });
    formatResult(result);
    if (result.success) {
      console.log('Configured Scopes:', result.configuredScopes);
    }
    return result;
  },

  // 3. List Teams (with detailed IDs)
  async listTeams() {
    console.log('\n👥 3. Listing Teams');
    const result = await window.electronAPI.microsoft.test({ action: "list_teams" });
    formatResult(result);
    
    if (result.success && result.teams) {
      console.log(`Found ${result.teams.length} teams:`);
      result.teams.forEach((team, i) => {
        console.log(`\n  Team ${i + 1}:`);
        console.log(`    Name: ${team.displayName}`);
        console.log(`    ID: ${team.id}`);
        console.log(`    Description: ${team.description || 'N/A'}`);
      });
      
      if (result.teams.length > 0) {
        console.log(`\n📝 To test channels, copy a team ID and run:`);
        console.log(`   testMicrosoft.listChannels('${result.teams[0].id}')`);
      }
    }
    return result;
  },

  // 4. List Channels (with team ID)
  async listChannels(teamId) {
    if (!teamId) {
      console.error('❌ Please provide a teamId. Run testMicrosoft.listTeams() first to get team IDs.');
      return;
    }
    
    console.log(`\n📺 4. Listing Channels for Team: ${teamId}`);
    const result = await window.electronAPI.microsoft.test({ 
      action: "list_channels", 
      teamId 
    });
    formatResult(result);
    
    if (result.success && result.channels) {
      console.log(`Found ${result.channels.length} channels:`);
      result.channels.forEach((channel, i) => {
        console.log(`\n  Channel ${i + 1}:`);
        console.log(`    Name: ${channel.displayName}`);
        console.log(`    ID: ${channel.id}`);
      });
      
      if (result.channels.length > 0) {
        console.log(`\n📝 To read messages, run:`);
        console.log(`   testMicrosoft.readChannelMessages('${teamId}', '${result.channels[0].id}')`);
      }
    } else if (!result.success) {
      console.log('\n⚠️  If error is "Forbidden" or "Insufficient privileges":');
      console.log('   - You need ADMIN CONSENT for Team.ReadBasic.All scope');
      console.log('   - Go to Azure Portal > API Permissions > Grant admin consent');
    }
    return result;
  },

  // 5. Read Channel Messages
  async readChannelMessages(teamId, channelId) {
    if (!teamId || !channelId) {
      console.error('❌ Please provide both teamId and channelId');
      return;
    }
    
    console.log(`\n💬 5. Reading Channel Messages`);
    const result = await window.electronAPI.microsoft.test({ 
      action: "read_channel_messages", 
      teamId, 
      channelId 
    });
    formatResult(result);
    
    if (result.success && result.messages) {
      console.log(`Found ${result.messages.length} messages`);
      result.messages.slice(0, 5).forEach((msg, i) => {
        console.log(`\n  Message ${i + 1}:`);
        console.log(`    From: ${msg.from?.user?.displayName || 'Unknown'}`);
        console.log(`    Text: ${msg.body?.content?.substring(0, 100)}...`);
      });
    }
    return result;
  },

  // 6. List Chats
  async listChats() {
    console.log('\n💬 6. Listing Chats');
    const result = await window.electronAPI.microsoft.test({ action: "list_chats" });
    formatResult(result);
    
    if (result.success && result.chats) {
      console.log(`Found ${result.chats.length} chats`);
      result.chats.slice(0, 5).forEach((chat, i) => {
        console.log(`\n  Chat ${i + 1}:`);
        console.log(`    Topic: ${chat.topic || 'Direct chat'}`);
        console.log(`    ID: ${chat.id}`);
      });
    }
    return result;
  },

  // 7. Read Emails
  async readEmails() {
    console.log('\n📧 7. Reading Unread Emails');
    const result = await window.electronAPI.microsoft.test({ action: "read_emails" });
    formatResult(result);
    
    if (result.success && result.emails) {
      console.log(`Found ${result.emails.length} unread emails`);
      result.emails.slice(0, 5).forEach((email, i) => {
        console.log(`\n  Email ${i + 1}:`);
        console.log(`    From: ${email.from?.emailAddress?.name || 'Unknown'}`);
        console.log(`    Subject: ${email.subject}`);
        console.log(`    Received: ${email.receivedDateTime}`);
      });
    }
    return result;
  },

  // 8. Run All Tests
  async runAll() {
    console.log('🚀 RUNNING ALL TESTS\n');
    console.log('='.repeat(60));
    
    await this.healthCheck();
    await this.checkScopes();
    await this.listTeams();
    await this.readEmails();
    await this.listChats();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All basic tests complete!');
    console.log('\n📝 For channel tests, use the team IDs from listTeams() output');
  }
};

console.log('✅ Test suite loaded!');
console.log('\n📝 Available commands:');
console.log('  testMicrosoft.healthCheck()       - Check authentication');
console.log('  testMicrosoft.checkScopes()       - View configured scopes');
console.log('  testMicrosoft.listTeams()         - List all teams');
console.log('  testMicrosoft.listChannels(teamId) - List channels (needs teamId)');
console.log('  testMicrosoft.readEmails()        - Read unread emails');
console.log('  testMicrosoft.listChats()         - List chats');
console.log('  testMicrosoft.runAll()            - Run all tests');
console.log('\n🎯 Quick start: testMicrosoft.runAll()');

