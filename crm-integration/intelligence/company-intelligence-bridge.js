/**
 * Company Intelligence Bridge
 * 
 * Bridges the Python company intelligence system with the JavaScript CRM integration.
 * Handles spawning Python processes, managing analysis results, and providing
 * a clean JavaScript API for company intelligence operations.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { EventEmitter } = require('events');

class CompanyIntelligenceBridge extends EventEmitter {
    constructor(config = {}) {
        super();
        
        // Configuration
        this.config = {
            pythonPath: config.pythonPath || path.join(__dirname, '../../company-intelligence-py'),
            timeout: config.timeout || 120000, // 2 minutes timeout
            retries: config.retries || 2,
            ...config
        };
        
        // State tracking
        this.isAnalyzing = false;
        this.analysisQueue = [];
        
        console.log('🔗 Company Intelligence Bridge initialized');
        console.log(`📁 Python path: ${this.config.pythonPath}`);
    }

    /**
     * Analyze a company website and return comprehensive intelligence
     * @param {string} websiteUrl - The company website URL
     * @param {string} companyName - Optional company name override
     * @returns {Promise<Object>} Company intelligence object
     */
    async analyzeCompany(websiteUrl, companyName = null) {
        console.log(`🔍 Starting company analysis for: ${websiteUrl}`);
        
        // Validate inputs
        if (!websiteUrl || !this._isValidUrl(websiteUrl)) {
            throw new Error(`Invalid website URL: ${websiteUrl}`);
        }

        // Check if analysis is already in progress for this URL
        if (this.isAnalyzing) {
            console.log('⏳ Analysis already in progress, queuing request...');
            return this._queueAnalysis(websiteUrl, companyName);
        }

        try {
            this.isAnalyzing = true;
            this.emit('analysisStarted', { websiteUrl, companyName });

            // Run Python analysis with retries
            const result = await this._runPythonAnalysisWithRetries(websiteUrl, companyName);
            
            this.emit('analysisCompleted', { websiteUrl, result });
            console.log(`✅ Company analysis completed for: ${result.company_name}`);
            
            return result;

        } catch (error) {
            this.emit('analysisError', { websiteUrl, error });
            console.error(`❌ Company analysis failed for ${websiteUrl}:`, error.message);
            throw error;
        } finally {
            this.isAnalyzing = false;
            this._processQueue();
        }
    }

    /**
     * Check if the Python intelligence system is available and working
     * @returns {Promise<boolean>} True if system is healthy
     */
    async healthCheck() {
        try {
            console.log('🏥 Running health check on Python intelligence system...');
            
            // Check if Python path exists
            const pythonPathExists = await this._pathExists(this.config.pythonPath);
            if (!pythonPathExists) {
                throw new Error(`Python path does not exist: ${this.config.pythonPath}`);
            }

            // Check if analyze_company.py exists
            const analyzeScript = path.join(this.config.pythonPath, 'analyze_company.py');
            const scriptExists = await this._pathExists(analyzeScript);
            if (!scriptExists) {
                throw new Error(`analyze_company.py not found at: ${analyzeScript}`);
            }

            // Check if ANTHROPIC_API_KEY is available
            if (!process.env.ANTHROPIC_API_KEY) {
                throw new Error('ANTHROPIC_API_KEY environment variable not set');
            }

            // Test with a simple URL (this will be fast since it's cached or lightweight)
            const testResult = await this._runPythonProcess('--help');
            
            console.log('✅ Python intelligence system is healthy');
            return true;

        } catch (error) {
            console.error('❌ Python intelligence system health check failed:', error.message);
            return false;
        }
    }

    /**
     * Get the organization ID for a given website URL
     * @param {string} websiteUrl - The website URL
     * @returns {string} Organization ID (e.g., "meta_com")
     */
    getOrganizationId(websiteUrl) {
        try {
            const url = new URL(websiteUrl);
            let domain = url.hostname.toLowerCase();
            
            // Remove www. prefix
            if (domain.startsWith('www.')) {
                domain = domain.substring(4);
            }
            
            // Replace dots with underscores and clean up
            const orgId = domain.replace(/\./g, '_').replace(/[^a-z0-9_-]/g, '_');
            return orgId.replace(/_+/g, '_').replace(/^_|_$/g, '');
            
        } catch (error) {
            throw new Error(`Invalid URL for organization ID generation: ${websiteUrl}`);
        }
    }

    /**
     * Find the latest intelligence file for a given website
     * @param {string} websiteUrl - The website URL
     * @returns {Promise<string|null>} Path to the intelligence file or null if not found
     */
    async findLatestIntelligenceFile(websiteUrl) {
        try {
            const orgId = this.getOrganizationId(websiteUrl);
            
            // Check both Python directory and current directory
            const searchDirs = [this.config.pythonPath, process.cwd()];
            
            for (const dir of searchDirs) {
                try {
                    const files = await fs.readdir(dir);
                    
                    // Find files matching the pattern: {orgId}_intelligence_*.json
                    const intelligenceFiles = files
                        .filter(file => file.startsWith(`${orgId}_intelligence_`) && file.endsWith('.json'))
                        .map(file => ({
                            name: file,
                            path: path.join(dir, file),
                            // Extract timestamp from filename
                            timestamp: file.match(/_(\d{8}_\d{6})\.json$/)?.[1] || '0'
                        }))
                        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Most recent first

                    if (intelligenceFiles.length > 0) {
                        return intelligenceFiles[0].path;
                    }
                } catch (dirError) {
                    console.warn(`Could not read directory ${dir}:`, dirError.message);
                }
            }
            
            return null;

        } catch (error) {
            console.error('Error finding intelligence file:', error.message);
            return null;
        }
    }

    /**
     * Load intelligence from file if it exists
     * @param {string} websiteUrl - The website URL
     * @returns {Promise<Object|null>} Intelligence object or null if not found
     */
    async loadExistingIntelligence(websiteUrl) {
        try {
            const filePath = await this.findLatestIntelligenceFile(websiteUrl);
            if (!filePath) {
                return null;
            }

            const content = await fs.readFile(filePath, 'utf8');
            const intelligence = JSON.parse(content);
            
            console.log(`📄 Loaded existing intelligence for ${intelligence.company_name} from ${path.basename(filePath)}`);
            return intelligence;

        } catch (error) {
            console.error('Error loading existing intelligence:', error.message);
            return null;
        }
    }

    // Private methods

    async _runPythonAnalysisWithRetries(websiteUrl, companyName) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.config.retries; attempt++) {
            try {
                console.log(`🔄 Analysis attempt ${attempt}/${this.config.retries} for ${websiteUrl}`);
                
                const args = [websiteUrl];
                if (companyName) {
                    args.push(companyName);
                }
                
                await this._runPythonProcess(...args);
                
                // Load the generated intelligence file
                const intelligence = await this._loadGeneratedIntelligence(websiteUrl);
                if (!intelligence) {
                    throw new Error('No intelligence file generated');
                }
                
                return intelligence;

            } catch (error) {
                lastError = error;
                console.warn(`⚠️ Analysis attempt ${attempt} failed: ${error.message}`);
                
                if (attempt < this.config.retries) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                    console.log(`⏳ Retrying in ${delay}ms...`);
                    await this._sleep(delay);
                }
            }
        }
        
        throw new Error(`Analysis failed after ${this.config.retries} attempts. Last error: ${lastError.message}`);
    }

    async _runPythonProcess(...args) {
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn('python', [
                path.join(this.config.pythonPath, 'analyze_company.py'),
                ...args
            ], {
                cwd: this.config.pythonPath,
                env: { 
                    ...process.env, 
                    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY 
                }
            });

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                // Emit progress events for real-time updates
                this.emit('analysisProgress', { data: data.toString() });
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            // Set timeout
            const timeout = setTimeout(() => {
                pythonProcess.kill('SIGTERM');
                reject(new Error(`Analysis timed out after ${this.config.timeout}ms`));
            }, this.config.timeout);

            pythonProcess.on('close', (code) => {
                clearTimeout(timeout);
                
                if (code === 0) {
                    resolve({ stdout, stderr });
                } else {
                    reject(new Error(`Python process exited with code ${code}. Error: ${stderr}`));
                }
            });

            pythonProcess.on('error', (error) => {
                clearTimeout(timeout);
                reject(new Error(`Failed to start Python process: ${error.message}`));
            });
        });
    }

    async _loadGeneratedIntelligence(websiteUrl) {
        // Wait a bit for file to be written
        await this._sleep(2000);
        
        const filePath = await this.findLatestIntelligenceFile(websiteUrl);
        if (!filePath) {
            console.error(`No intelligence file found for ${websiteUrl}`);
            return null;
        }

        try {
            console.log(`📄 Loading intelligence from: ${filePath}`);
            const content = await fs.readFile(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error('Error reading generated intelligence file:', error.message);
            return null;
        }
    }

    async _queueAnalysis(websiteUrl, companyName) {
        return new Promise((resolve, reject) => {
            this.analysisQueue.push({ websiteUrl, companyName, resolve, reject });
        });
    }

    async _processQueue() {
        if (this.analysisQueue.length === 0) {
            return;
        }

        const { websiteUrl, companyName, resolve, reject } = this.analysisQueue.shift();
        
        try {
            const result = await this.analyzeCompany(websiteUrl, companyName);
            resolve(result);
        } catch (error) {
            reject(error);
        }
    }

    _isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    async _pathExists(path) {
        try {
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = CompanyIntelligenceBridge;
