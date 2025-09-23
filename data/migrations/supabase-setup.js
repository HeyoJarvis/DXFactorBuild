#!/usr/bin/env node

/**
 * Supabase Setup Script
 * 
 * This script helps set up the HeyJarvis database schema in Supabase
 * and provides initial configuration and seed data.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');

// Setup logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [new winston.transports.Console()]
});

class SupabaseSetup {
  constructor() {
    // Get Supabase credentials from environment
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!this.supabaseUrl || !this.supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }
    
    // Create admin client with service role key
    this.supabase = createClient(this.supabaseUrl, this.supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    this.logger = logger;
  }
  
  async run() {
    try {
      this.logger.info('🚀 Starting Supabase setup for HeyJarvis');
      this.logger.info('=====================================');
      
      // Test connection
      await this.testConnection();
      
      // Check if schema already exists
      const schemaExists = await this.checkSchemaExists();
      
      if (schemaExists) {
        this.logger.warn('⚠️  Database schema already exists');
        const shouldContinue = await this.promptUser('Do you want to continue anyway? This may cause errors. (y/N): ');
        if (!shouldContinue) {
          this.logger.info('Setup cancelled by user');
          return;
        }
      }
      
      // Run schema setup
      await this.setupSchema();
      
      // Verify setup
      await this.verifySetup();
      
      // Create sample data
      await this.createSampleData();
      
      this.logger.info('=====================================');
      this.logger.info('✅ Supabase setup completed successfully!');
      this.logger.info('');
      this.logger.info('🎯 Next steps:');
      this.logger.info('1. Update your .env file with your Supabase credentials');
      this.logger.info('2. Configure Row Level Security policies if needed');
      this.logger.info('3. Set up your first team and sources');
      this.logger.info('4. Start the HeyJarvis application');
      
    } catch (error) {
      this.logger.error('❌ Setup failed:', error.message);
      process.exit(1);
    }
  }
  
  async testConnection() {
    try {
      this.logger.info('Testing Supabase connection...');
      
      const { data, error } = await this.supabase
        .from('pg_tables')
        .select('tablename')
        .limit(1);
      
      if (error) throw error;
      
      this.logger.info('✅ Connection successful');
      
    } catch (error) {
      throw new Error(`Connection failed: ${error.message}`);
    }
  }
  
  async checkSchemaExists() {
    try {
      const { data, error } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'signals');
      
      if (error) throw error;
      
      return data && data.length > 0;
      
    } catch (error) {
      this.logger.warn('Could not check if schema exists:', error.message);
      return false;
    }
  }
  
  async setupSchema() {
    try {
      this.logger.info('Setting up database schema...');
      
      // Read the schema SQL file
      const schemaPath = path.join(__dirname, '../storage/supabase-schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      
      // Split into individual statements (basic approach)
      const statements = schemaSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      this.logger.info(`Executing ${statements.length} SQL statements...`);
      
      // Execute each statement
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        
        if (statement.trim().length === 0) continue;
        
        try {
          const { error } = await this.supabase.rpc('exec_sql', {
            sql: statement + ';'
          });
          
          if (error) {
            // Log warning but continue for non-critical errors
            if (error.message.includes('already exists')) {
              this.logger.warn(`Statement ${i + 1}: ${error.message}`);
            } else {
              throw error;
            }
          }
          
          // Progress indicator
          if ((i + 1) % 10 === 0) {
            this.logger.info(`Progress: ${i + 1}/${statements.length} statements executed`);
          }
          
        } catch (error) {
          this.logger.error(`Statement ${i + 1} failed: ${error.message}`);
          this.logger.error(`Statement: ${statement.substring(0, 100)}...`);
          
          // Continue with non-critical errors
          if (!error.message.includes('critical')) {
            continue;
          }
          throw error;
        }
      }
      
      this.logger.info('✅ Schema setup completed');
      
    } catch (error) {
      // If direct SQL execution fails, provide manual instructions
      this.logger.error('Schema setup failed:', error.message);
      this.logger.info('');
      this.logger.info('📝 Manual setup required:');
      this.logger.info('1. Go to your Supabase dashboard');
      this.logger.info('2. Open the SQL editor');
      this.logger.info('3. Copy and paste the contents of data/storage/supabase-schema.sql');
      this.logger.info('4. Run the SQL script');
      
      throw error;
    }
  }
  
  async verifySetup() {
    try {
      this.logger.info('Verifying database setup...');
      
      // Check key tables exist
      const tables = ['users', 'teams', 'sources', 'signals', 'feedback'];
      
      for (const table of tables) {
        const { data, error } = await this.supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          throw new Error(`Table ${table} verification failed: ${error.message}`);
        }
        
        this.logger.info(`✓ Table '${table}' exists (${data || 0} rows)`);
      }
      
      this.logger.info('✅ Database verification completed');
      
    } catch (error) {
      throw new Error(`Verification failed: ${error.message}`);
    }
  }
  
  async createSampleData() {
    try {
      this.logger.info('Creating sample data...');
      
      // Create sample company
      const { data: company, error: companyError } = await this.supabase
        .from('companies')
        .upsert({
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Demo Company',
          domain: 'demo.com',
          industry: 'Technology',
          size: 'medium'
        })
        .select()
        .single();
      
      if (companyError && !companyError.message.includes('duplicate')) {
        throw companyError;
      }
      
      // Create sample team
      const { data: team, error: teamError } = await this.supabase
        .from('teams')
        .upsert({
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Product Team',
          slug: 'product-team',
          company_id: '550e8400-e29b-41d4-a716-446655440000',
          competitive_context: {
            primary_competitors: ['OpenAI', 'Anthropic', 'Google'],
            our_products: [
              { name: 'AI Assistant', category: 'AI Platform' }
            ],
            focus_areas: ['artificial intelligence', 'competitive analysis']
          }
        })
        .select()
        .single();
      
      if (teamError && !teamError.message.includes('duplicate')) {
        throw teamError;
      }
      
      // Create sample sources
      const sampleSources = [
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: 'TechCrunch',
          type: 'rss',
          category: 'industry',
          url: 'https://techcrunch.com/feed/',
          trust_score: 0.8,
          is_public: true,
          polling_config: {
            interval_minutes: 60,
            timeout_seconds: 30
          }
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: 'Anthropic Blog',
          type: 'rss',
          category: 'official',
          url: 'https://www.anthropic.com/news/feed.xml',
          trust_score: 0.95,
          is_public: true,
          polling_config: {
            interval_minutes: 120,
            timeout_seconds: 30
          }
        }
      ];
      
      for (const source of sampleSources) {
        const { error } = await this.supabase
          .from('sources')
          .upsert(source);
        
        if (error && !error.message.includes('duplicate')) {
          this.logger.warn(`Failed to create source ${source.name}: ${error.message}`);
        }
      }
      
      this.logger.info('✅ Sample data created');
      
    } catch (error) {
      this.logger.warn('Sample data creation failed:', error.message);
      // Don't fail the entire setup for sample data issues
    }
  }
  
  async promptUser(question) {
    // In a real implementation, you'd use readline or similar
    // For now, return false (don't continue)
    return false;
  }
}

// Create RPC function for executing SQL (if it doesn't exist)
async function createExecSqlFunction(supabase) {
  const functionSql = `
    CREATE OR REPLACE FUNCTION exec_sql(sql text)
    RETURNS void AS $$
    BEGIN
      EXECUTE sql;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  
  try {
    await supabase.rpc('exec_sql', { sql: functionSql });
  } catch (error) {
    // Function might already exist or we might not have permission
    // This is okay, we'll try direct execution
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  const setup = new SupabaseSetup();
  setup.run().catch(error => {
    console.error('Setup failed:', error.message);
    process.exit(1);
  });
}

module.exports = SupabaseSetup;
