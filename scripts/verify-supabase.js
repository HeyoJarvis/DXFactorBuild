#!/usr/bin/env node

/**
 * Supabase Connection Verification Script
 * 
 * This script verifies your Supabase connection and checks if the schema is set up correctly.
 * Run this after setting up your Supabase credentials in .env
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const chalk = require('chalk');

class SupabaseVerifier {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    this.results = {
      passed: [],
      failed: [],
      warnings: []
    };
  }

  log(message, type = 'info') {
    const icons = {
      info: 'ℹ️',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    };
    
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      error: chalk.red,
      warning: chalk.yellow
    };
    
    console.log(colors[type](`${icons[type]} ${message}`));
  }

  async run() {
    console.log(chalk.bold.cyan('\n🚀 Supabase Connection Verification\n'));
    console.log('='.repeat(50));
    console.log('');

    // Step 1: Check environment variables
    await this.checkEnvironmentVariables();
    
    if (!this.supabaseUrl || !this.supabaseAnonKey) {
      this.log('Missing required environment variables. Please check your .env file.', 'error');
      this.printSummary();
      process.exit(1);
    }

    // Step 2: Test connection
    await this.testConnection();

    // Step 3: Verify schema
    await this.verifySchema();

    // Step 4: Check sample data
    await this.checkSampleData();

    // Step 5: Test operations
    await this.testOperations();

    // Print summary
    this.printSummary();
  }

  async checkEnvironmentVariables() {
    this.log('Checking environment variables...', 'info');

    const requiredVars = [
      { name: 'SUPABASE_URL', value: this.supabaseUrl },
      { name: 'SUPABASE_ANON_KEY', value: this.supabaseAnonKey }
    ];

    const optionalVars = [
      { name: 'SUPABASE_SERVICE_ROLE_KEY', value: this.supabaseServiceKey }
    ];

    for (const varCheck of requiredVars) {
      if (varCheck.value && varCheck.value !== 'your-project.supabase.co' && !varCheck.value.includes('your_')) {
        this.results.passed.push(`${varCheck.name} is set`);
        this.log(`${varCheck.name}: ${varCheck.value.substring(0, 30)}...`, 'success');
      } else {
        this.results.failed.push(`${varCheck.name} is not set or uses placeholder value`);
        this.log(`${varCheck.name} is missing or invalid`, 'error');
      }
    }

    for (const varCheck of optionalVars) {
      if (varCheck.value && !varCheck.value.includes('your_')) {
        this.results.passed.push(`${varCheck.name} is set`);
        this.log(`${varCheck.name}: Configured`, 'success');
      } else {
        this.results.warnings.push(`${varCheck.name} is not set (optional, needed for migrations)`);
        this.log(`${varCheck.name}: Not set (optional)`, 'warning');
      }
    }

    console.log('');
  }

  async testConnection() {
    this.log('Testing Supabase connection...', 'info');

    try {
      const supabase = createClient(this.supabaseUrl, this.supabaseAnonKey);
      
      // Try a simple query
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);

      if (error) {
        if (error.message.includes('relation') || error.message.includes('does not exist')) {
          this.results.warnings.push('Connection successful but schema not set up yet');
          this.log('Connection successful, but schema needs to be installed', 'warning');
        } else {
          throw error;
        }
      } else {
        this.results.passed.push('Successfully connected to Supabase');
        this.log('Successfully connected to Supabase!', 'success');
      }
    } catch (error) {
      this.results.failed.push(`Connection failed: ${error.message}`);
      this.log(`Connection failed: ${error.message}`, 'error');
    }

    console.log('');
  }

  async verifySchema() {
    this.log('Verifying database schema...', 'info');

    try {
      const supabase = createClient(this.supabaseUrl, this.supabaseAnonKey);

      const tables = [
        'users',
        'teams',
        'companies',
        'sources',
        'signals',
        'feedback',
        'signal_deliveries',
        'chat_conversations',
        'chat_messages',
        'user_sessions',
        'slack_conversations',
        'conversation_contexts'
      ];

      for (const table of tables) {
        try {
          const { error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

          if (error) {
            if (error.message.includes('relation') || error.message.includes('does not exist')) {
              this.results.warnings.push(`Table '${table}' does not exist`);
              this.log(`Table '${table}' not found - needs setup`, 'warning');
            } else {
              throw error;
            }
          } else {
            this.results.passed.push(`Table '${table}' exists`);
            this.log(`Table '${table}' ✓`, 'success');
          }
        } catch (err) {
          this.results.failed.push(`Error checking table '${table}': ${err.message}`);
          this.log(`Error checking '${table}': ${err.message}`, 'error');
        }
      }
    } catch (error) {
      this.results.failed.push(`Schema verification failed: ${error.message}`);
      this.log(`Schema verification failed: ${error.message}`, 'error');
    }

    console.log('');
  }

  async checkSampleData() {
    this.log('Checking sample data...', 'info');

    try {
      const supabase = createClient(this.supabaseUrl, this.supabaseAnonKey);

      // Check for demo company
      const { data: companies, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .limit(5);

      if (!companyError && companies) {
        this.results.passed.push(`Found ${companies.length} companies in database`);
        this.log(`Found ${companies.length} companies`, 'success');
      }

      // Check for sources
      const { data: sources, error: sourceError } = await supabase
        .from('sources')
        .select('*')
        .limit(5);

      if (!sourceError && sources) {
        this.results.passed.push(`Found ${sources.length} sources in database`);
        this.log(`Found ${sources.length} sources`, 'success');
      }

    } catch (error) {
      this.results.warnings.push('Could not check sample data - tables may not exist yet');
      this.log('Could not check sample data (tables may not be set up)', 'warning');
    }

    console.log('');
  }

  async testOperations() {
    this.log('Testing basic operations...', 'info');

    try {
      const supabase = createClient(this.supabaseUrl, this.supabaseAnonKey);

      // Test read operation
      const { data: readTest, error: readError } = await supabase
        .from('sources')
        .select('*')
        .limit(1);

      if (!readError) {
        this.results.passed.push('Read operations working');
        this.log('Read operations: OK', 'success');
      }

      // Note: We won't test write operations without proper auth context
      this.log('Write operations: Skipped (requires authentication)', 'warning');

    } catch (error) {
      this.results.warnings.push('Could not test operations - schema may not be set up');
      this.log('Operations test skipped (schema not ready)', 'warning');
    }

    console.log('');
  }

  printSummary() {
    console.log('='.repeat(50));
    console.log(chalk.bold.cyan('\n📊 Verification Summary\n'));

    console.log(chalk.bold.green(`✅ Passed: ${this.results.passed.length}`));
    this.results.passed.forEach(item => console.log(chalk.green(`   • ${item}`)));

    if (this.results.warnings.length > 0) {
      console.log(chalk.bold.yellow(`\n⚠️  Warnings: ${this.results.warnings.length}`));
      this.results.warnings.forEach(item => console.log(chalk.yellow(`   • ${item}`)));
    }

    if (this.results.failed.length > 0) {
      console.log(chalk.bold.red(`\n❌ Failed: ${this.results.failed.length}`));
      this.results.failed.forEach(item => console.log(chalk.red(`   • ${item}`)));
    }

    console.log('\n' + '='.repeat(50));

    // Next steps
    if (this.results.warnings.some(w => w.includes('schema'))) {
      console.log(chalk.bold.yellow('\n⚡ Next Steps:\n'));
      console.log('1. Go to your Supabase dashboard: https://app.supabase.com');
      console.log('2. Navigate to: SQL Editor');
      console.log('3. Copy contents from: data/storage/supabase-schema-improved.sql');
      console.log('4. Paste and run the SQL script');
      console.log('5. Run this verification script again\n');
    } else if (this.results.failed.length === 0) {
      console.log(chalk.bold.green('\n🎉 All checks passed! Your Supabase is ready to use.\n'));
    }

    process.exit(this.results.failed.length > 0 ? 1 : 0);
  }
}

// Run verification
if (require.main === module) {
  const verifier = new SupabaseVerifier();
  verifier.run().catch(error => {
    console.error(chalk.red('\n❌ Verification failed with error:'), error);
    process.exit(1);
  });
}

module.exports = SupabaseVerifier;

