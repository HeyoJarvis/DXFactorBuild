/**
 * 🧪 TEAMS & OUTLOOK MONITORING TEST SUITE
 * 
 * Complete end-to-end testing for automatic task creation from Teams and Outlook
 * 
 * Usage: Paste this entire file into DevTools Console after launching the app
 */

console.log('%c🚀 Teams & Outlook Monitoring Test Suite', 'font-size: 16px; font-weight: bold; color: #0078d4;');
console.log('%cLoaded! Use window.monitoringTests to run tests', 'color: #107c10;');

window.monitoringTests = {
  
  /**
   * Test 1: Check if monitoring services are available
   */
  async checkAvailability() {
    console.log('\n%c📋 TEST 1: Check Availability', 'font-weight: bold;');
    
    const hasAPI = !!window.electronAPI?.microsoft;
    console.log(`  ✓ API Available: ${hasAPI}`);
    
    if (!hasAPI) {
      console.error('  ❌ Microsoft API not available');
      return false;
    }
    
    const hasMonitoring = window.electronAPI.microsoft.startTeamsMonitoring && 
                          window.electronAPI.microsoft.startEmailMonitoring;
    console.log(`  ✓ Monitoring Functions: ${hasMonitoring}`);
    
    return hasAPI && hasMonitoring;
  },
  
  /**
   * Test 2: Start Teams monitoring
   */
  async startTeamsMonitoring() {
    console.log('\n%c📋 TEST 2: Start Teams Monitoring', 'font-weight: bold;');
    
    try {
      const result = await window.electronAPI.microsoft.startTeamsMonitoring();
      
      if (result.success) {
        console.log('  ✅ Teams monitoring started!');
        console.log('  Stats:', result.stats);
        return true;
      } else {
        console.error('  ❌ Failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('  ❌ Error:', error.message);
      return false;
    }
  },
  
  /**
   * Test 3: Start Email monitoring
   */
  async startEmailMonitoring() {
    console.log('\n%c📋 TEST 3: Start Email Monitoring', 'font-weight: bold;');
    
    try {
      const result = await window.electronAPI.microsoft.startEmailMonitoring();
      
      if (result.success) {
        console.log('  ✅ Email monitoring started!');
        console.log('  Stats:', result.stats);
        return true;
      } else {
        console.error('  ❌ Failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('  ❌ Error:', error.message);
      return false;
    }
  },
  
  /**
   * Test 4: Check monitoring stats
   */
  async checkStats() {
    console.log('\n%c📋 TEST 4: Check Monitoring Stats', 'font-weight: bold;');
    
    try {
      const result = await window.electronAPI.microsoft.getMonitoringStats();
      
      if (result.success) {
        console.log('  ✅ Stats retrieved!');
        console.log('\n  📊 Teams Stats:');
        if (result.teams) {
          console.table(result.teams);
        } else {
          console.log('    Not initialized');
        }
        
        console.log('\n  📊 Email Stats:');
        if (result.email) {
          console.table(result.email);
        } else {
          console.log('    Not initialized');
        }
        
        return true;
      } else {
        console.error('  ❌ Failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('  ❌ Error:', error.message);
      return false;
    }
  },
  
  /**
   * Test 5: Test basic Teams reading (prerequisite for monitoring)
   */
  async testTeamsReading() {
    console.log('\n%c📋 TEST 5: Test Teams Reading', 'font-weight: bold;');
    
    try {
      // List teams
      const teamsResult = await window.electronAPI.microsoft.test({ action: "list_teams" });
      
      if (!teamsResult.success) {
        console.error('  ❌ Failed to list teams:', teamsResult.error);
        return false;
      }
      
      console.log(`  ✅ Found ${teamsResult.teams.length} teams`);
      
      if (teamsResult.teams.length > 0) {
        const firstTeam = teamsResult.teams[0];
        console.log(`  Testing with team: ${firstTeam.displayName}`);
        
        // List channels
        const channelsResult = await window.electronAPI.microsoft.test({ 
          action: "list_channels",
          teamId: firstTeam.id
        });
        
        if (channelsResult.success) {
          console.log(`  ✅ Found ${channelsResult.channels.length} channels`);
          return true;
        } else {
          console.error('  ❌ Failed to list channels:', channelsResult.error);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('  ❌ Error:', error.message);
      return false;
    }
  },
  
  /**
   * Test 6: Test Outlook reading (prerequisite for monitoring)
   */
  async testOutlookReading() {
    console.log('\n%c📋 TEST 6: Test Outlook Reading', 'font-weight: bold;');
    
    try {
      const result = await window.electronAPI.microsoft.test({ action: "read_emails" });
      
      if (result.success) {
        console.log(`  ✅ Found ${result.emails.length} unread emails`);
        
        if (result.emails.length > 0) {
          console.log('\n  Sample emails:');
          result.emails.slice(0, 3).forEach((email, i) => {
            console.log(`    ${i + 1}. ${email.subject}`);
            console.log(`       From: ${email.from?.emailAddress?.address}`);
          });
        }
        
        return true;
      } else {
        console.error('  ❌ Failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('  ❌ Error:', error.message);
      return false;
    }
  },
  
  /**
   * Test 7: Stop monitoring
   */
  async stopAllMonitoring() {
    console.log('\n%c📋 TEST 7: Stop All Monitoring', 'font-weight: bold;');
    
    try {
      // Stop Teams
      const teamsResult = await window.electronAPI.microsoft.stopTeamsMonitoring();
      console.log(`  Teams: ${teamsResult.success ? '✅ Stopped' : '❌ Failed'}`);
      
      // Stop Email
      const emailResult = await window.electronAPI.microsoft.stopEmailMonitoring();
      console.log(`  Email: ${emailResult.success ? '✅ Stopped' : '❌ Failed'}`);
      
      return teamsResult.success && emailResult.success;
    } catch (error) {
      console.error('  ❌ Error:', error.message);
      return false;
    }
  },
  
  /**
   * Run all tests
   */
  async runAll() {
    console.log('\n%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #0078d4;');
    console.log('%c🧪 RUNNING COMPLETE TEST SUITE', 'font-size: 14px; font-weight: bold; color: #0078d4;');
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #0078d4;');
    
    const results = {
      availability: await this.checkAvailability(),
      teamsReading: await this.testTeamsReading(),
      outlookReading: await this.testOutlookReading(),
      startTeams: await this.startTeamsMonitoring(),
      startEmail: await this.startEmailMonitoring(),
      stats: await this.checkStats()
    };
    
    console.log('\n%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #107c10;');
    console.log('%c📊 TEST RESULTS', 'font-size: 14px; font-weight: bold; color: #107c10;');
    console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #107c10;');
    console.table(results);
    
    const passedTests = Object.values(results).filter(r => r === true).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`\n%c${passedTests}/${totalTests} tests passed`, 'font-size: 14px; font-weight: bold;');
    
    if (passedTests === totalTests) {
      console.log('%c✅ ALL TESTS PASSED! Monitoring is active.', 'font-size: 14px; color: #107c10; font-weight: bold;');
      console.log('\n%c📝 What happens next:', 'font-weight: bold;');
      console.log('  • Teams: Checks every 3 minutes for new messages');
      console.log('  • Email: Checks every 5 minutes for unread emails');
      console.log('  • AI detects work requests automatically');
      console.log('  • Tasks are created and you\'ll see notifications');
      console.log('\n%cCheck stats anytime with: monitoringTests.checkStats()', 'color: #0078d4;');
    } else {
      console.log('%c⚠️ SOME TESTS FAILED', 'font-size: 14px; color: #d13438; font-weight: bold;');
      console.log('\n%cTroubleshooting:', 'font-weight: bold;');
      if (!results.availability) {
        console.log('  • Restart the app and try again');
      }
      if (!results.teamsReading || !results.outlookReading) {
        console.log('  • Make sure you\'ve authenticated with Microsoft 365');
        console.log('  • Check that admin consent was granted for Teams scopes');
      }
      if (!results.startTeams || !results.startEmail) {
        console.log('  • Make sure you\'re logged in to HeyJarvis');
        console.log('  • Check console logs for error details');
      }
    }
    
    return results;
  },
  
  /**
   * Quick start (most common usage)
   */
  async quickStart() {
    console.log('%c🚀 QUICK START', 'font-size: 14px; font-weight: bold; color: #0078d4;');
    console.log('\nStarting monitoring services...\n');
    
    await this.startTeamsMonitoring();
    await this.startEmailMonitoring();
    await this.checkStats();
    
    console.log('\n%c✅ Monitoring started!', 'font-weight: bold; color: #107c10;');
    console.log('\nRun monitoringTests.checkStats() anytime to see progress');
  }
};

// Quick reference
console.log('\n%c📚 QUICK REFERENCE', 'font-weight: bold; color: #0078d4;');
console.log('  monitoringTests.quickStart()       - Start both monitoring services');
console.log('  monitoringTests.runAll()           - Run complete test suite');
console.log('  monitoringTests.checkStats()       - Check current stats');
console.log('  monitoringTests.stopAllMonitoring() - Stop all monitoring');
console.log('\n%c💡 TIP: Run monitoringTests.quickStart() to get started!', 'color: #0078d4;');

