/**
 * Intelligence Types and Utilities
 * 
 * Provides TypeScript-like type definitions and utility functions
 * for working with company intelligence data in JavaScript.
 */

/**
 * Company Size Enum
 */
const CompanySize = {
    STARTUP: 'startup',
    SMB: 'smb',
    MID_MARKET: 'mid_market',
    ENTERPRISE: 'enterprise'
};

/**
 * Tech Sophistication Enum
 */
const TechSophistication = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high'
};

/**
 * Sales Complexity Enum
 */
const SalesComplexity = {
    TRANSACTIONAL: 'transactional',
    CONSULTATIVE: 'consultative',
    ENTERPRISE: 'enterprise'
};

/**
 * Business Model Types
 */
const BusinessModel = {
    B2B_SAAS: 'B2B SaaS',
    B2C: 'B2C',
    B2B_SERVICES: 'B2B Services',
    MARKETPLACE: 'Marketplace',
    ECOMMERCE: 'E-commerce',
    CONSULTING: 'Consulting',
    AGENCY: 'Agency'
};

/**
 * Industry Categories
 */
const Industries = {
    TECHNOLOGY: 'Technology',
    HEALTHCARE: 'Healthcare',
    FINANCE: 'Finance',
    EDUCATION: 'Education',
    RETAIL: 'Retail',
    MANUFACTURING: 'Manufacturing',
    REAL_ESTATE: 'Real Estate',
    CONSULTING: 'Consulting',
    MARKETING: 'Marketing',
    LEGAL: 'Legal'
};

/**
 * Market Position Types
 */
const MarketPosition = {
    LEADER: 'Leader',
    CHALLENGER: 'Challenger',
    NICHE: 'Niche',
    FOLLOWER: 'Follower'
};

/**
 * Utility functions for working with intelligence data
 */
class IntelligenceUtils {
    
    /**
     * Check if a company is enterprise-level
     * @param {Object} context - Company context
     * @returns {boolean}
     */
    static isEnterprise(context) {
        return context?.companySize === CompanySize.ENTERPRISE ||
               context?.organization_context?.company_size === CompanySize.ENTERPRISE;
    }

    /**
     * Check if a company is tech-sophisticated
     * @param {Object} context - Company context
     * @returns {boolean}
     */
    static isTechSophisticated(context) {
        const techLevel = context?.techSophistication || 
                         context?.organization_context?.tech_sophistication;
        return techLevel === TechSophistication.HIGH;
    }

    /**
     * Check if a company has complex sales processes
     * @param {Object} context - Company context
     * @returns {boolean}
     */
    static hasComplexSales(context) {
        const salesComplexity = context?.salesComplexity || 
                               context?.organization_context?.sales_complexity;
        return salesComplexity === SalesComplexity.ENTERPRISE || 
               salesComplexity === SalesComplexity.CONSULTATIVE;
    }

    /**
     * Get automation readiness score (0-100)
     * @param {Object} context - Company context
     * @returns {number}
     */
    static getAutomationReadiness(context) {
        let score = 50; // Base score

        // Company size factor
        const companySize = context?.companySize || context?.organization_context?.company_size;
        switch (companySize) {
            case CompanySize.ENTERPRISE:
                score += 30;
                break;
            case CompanySize.MID_MARKET:
                score += 20;
                break;
            case CompanySize.SMB:
                score += 10;
                break;
            case CompanySize.STARTUP:
                score += 5;
                break;
        }

        // Tech sophistication factor
        const techLevel = context?.techSophistication || 
                         context?.organization_context?.tech_sophistication;
        switch (techLevel) {
            case TechSophistication.HIGH:
                score += 20;
                break;
            case TechSophistication.MEDIUM:
                score += 10;
                break;
            case TechSophistication.LOW:
                score -= 10;
                break;
        }

        // Process maturity factor
        const processMaturity = context?.processMaturity || context?.process_maturity;
        if (processMaturity) {
            if (processMaturity.automation_level === 'high') score += 15;
            if (processMaturity.process_sophistication === 'advanced') score += 10;
            if (processMaturity.change_management_capability === 'high') score += 10;
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Get CRM readiness score (0-100)
     * @param {Object} context - Company context
     * @returns {number}
     */
    static getCRMReadiness(context) {
        let score = 40; // Base score

        // Existing CRM system
        const existingCRM = context?.crmSystem || 
                           context?.organization_context?.crm_system ||
                           context?.technologyStack?.crmSystem ||
                           context?.technology_stack?.crm_system;
        
        if (existingCRM && existingCRM !== 'Unknown' && existingCRM !== null) {
            score += 30; // Already has CRM experience
        } else {
            score += 10; // Greenfield opportunity
        }

        // Sales complexity
        const salesComplexity = context?.salesComplexity || 
                               context?.organization_context?.sales_complexity;
        if (salesComplexity === SalesComplexity.ENTERPRISE) {
            score += 25; // High need for CRM
        } else if (salesComplexity === SalesComplexity.CONSULTATIVE) {
            score += 15;
        }

        // Company size
        const companySize = context?.companySize || context?.organization_context?.company_size;
        if (companySize === CompanySize.ENTERPRISE || companySize === CompanySize.MID_MARKET) {
            score += 20;
        }

        // Business model
        const businessModel = context?.businessModel || context?.organization_context?.business_model;
        if (businessModel && businessModel.includes('B2B')) {
            score += 15;
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Get recommended tool categories based on company context
     * @param {Object} context - Company context
     * @returns {Array<string>}
     */
    static getRecommendedToolCategories(context) {
        const categories = [];

        // Always recommend based on automation gaps
        const automationGaps = context?.automationGaps || 
                              context?.workflow_intelligence?.automation_gaps || [];
        
        if (automationGaps.length > 0) {
            categories.push('automation');
        }

        // CRM recommendations
        const crmReadiness = this.getCRMReadiness(context);
        if (crmReadiness > 60) {
            categories.push('crm');
        }

        // Communication tools for remote/distributed teams
        const remoteIndicators = context?.workflow_intelligence?.remote_work_indicators || [];
        if (remoteIndicators.length > 0) {
            categories.push('communication');
        }

        // Document management for complex processes
        if (this.hasComplexSales(context)) {
            categories.push('document_management');
        }

        // Analytics for data-driven companies
        if (this.isTechSophisticated(context)) {
            categories.push('analytics');
        }

        // Integration tools for companies with existing tech stack
        const existingTools = this._countExistingTools(context);
        if (existingTools > 2) {
            categories.push('integration');
        }

        return categories;
    }

    /**
     * Generate contextual reasoning for a tool recommendation
     * @param {string} toolName - Name of the tool
     * @param {Object} context - Company context
     * @returns {string}
     */
    static generateToolReasoning(toolName, context) {
        const companyName = context?.companyName || context?.company_name || 'your company';
        const companySize = context?.companySize || context?.organization_context?.company_size;
        const industry = context?.industry || context?.organization_context?.industry;
        const businessModel = context?.businessModel || context?.organization_context?.business_model;

        let reasoning = `Recommended for ${companyName}`;

        // Add company size context
        if (companySize) {
            reasoning += ` (${companySize} company)`;
        }

        // Add industry context
        if (industry && industry !== 'Unknown') {
            reasoning += ` in ${industry}`;
        }

        // Add business model context
        if (businessModel) {
            reasoning += ` with ${businessModel} model`;
        }

        // Add category-specific reasoning
        const toolCategory = toolName.toLowerCase();
        
        if (toolCategory.includes('automation')) {
            const automationGaps = context?.automationGaps || 
                                  context?.workflow_intelligence?.automation_gaps || [];
            if (automationGaps.length > 0) {
                reasoning += `. Addresses automation gaps in: ${automationGaps.slice(0, 2).join(', ')}`;
            } else {
                reasoning += `. High automation readiness (${this.getAutomationReadiness(context)}%)`;
            }
        } else if (toolCategory.includes('crm')) {
            const existingCRM = context?.crmSystem || context?.technologyStack?.crmSystem;
            if (existingCRM && existingCRM !== 'Unknown') {
                reasoning += `. Can enhance existing ${existingCRM} setup`;
            } else {
                reasoning += `. High CRM readiness (${this.getCRMReadiness(context)}%) with ${context?.salesComplexity || 'consultative'} sales process`;
            }
        } else if (toolCategory.includes('document')) {
            const salesComplexity = context?.salesComplexity || context?.organization_context?.sales_complexity;
            reasoning += `. ${salesComplexity} sales process requires robust document management`;
        } else if (toolCategory.includes('analytics')) {
            const techLevel = context?.techSophistication || context?.organization_context?.tech_sophistication;
            reasoning += `. ${techLevel} tech sophistication enables advanced analytics implementation`;
        } else if (toolCategory.includes('integration')) {
            const integrationNeeds = context?.integrationNeeds || context?.workflow_intelligence?.integration_needs || [];
            if (integrationNeeds.length > 0) {
                reasoning += `. Needs integration with: ${integrationNeeds.slice(0, 2).join(', ')}`;
            } else {
                reasoning += `. Multiple existing tools require integration`;
            }
        } else if (toolCategory.includes('communication')) {
            const teamSize = context?.organization_context?.employee_count_estimate;
            if (teamSize) {
                reasoning += `. Team coordination for ${teamSize}+ employees`;
            } else {
                reasoning += `. Improves team coordination and communication`;
            }
        } else {
            // Generic fallback
            const automationGaps = context?.automationGaps || 
                                  context?.workflow_intelligence?.automation_gaps || [];
            if (automationGaps.length > 0) {
                reasoning += `. Addresses workflow gaps in: ${automationGaps.slice(0, 2).join(', ')}`;
            }
        }

        return reasoning;
    }

    /**
     * Validate company context structure
     * @param {Object} context - Company context to validate
     * @returns {Object} Validation result with isValid and errors
     */
    static validateContext(context) {
        const errors = [];

        if (!context) {
            return { isValid: false, errors: ['Context is null or undefined'] };
        }

        // Check required fields
        if (!context.company_name && !context.companyName) {
            errors.push('Missing company name');
        }

        if (!context.website_url && !context.websiteUrl) {
            errors.push('Missing website URL');
        }

        if (!context.organization_context && !context.organizationId) {
            errors.push('Missing organization context');
        }

        // Check organization context structure
        const orgContext = context.organization_context || context;
        if (orgContext) {
            if (!orgContext.organization_id && !orgContext.organizationId) {
                errors.push('Missing organization ID');
            }

            if (!orgContext.company_size && !orgContext.companySize) {
                errors.push('Missing company size');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Private helper methods

    static _countExistingTools(context) {
        let count = 0;
        const techStack = context?.technologyStack || context?.technology_stack;
        
        if (!techStack) return 0;

        // Count non-null/non-empty tools
        Object.values(techStack).forEach(value => {
            if (value && value !== 'Unknown' && value !== null) {
                if (Array.isArray(value)) {
                    count += value.length;
                } else {
                    count += 1;
                }
            }
        });

        return count;
    }
}

module.exports = {
    CompanySize,
    TechSophistication,
    SalesComplexity,
    BusinessModel,
    Industries,
    MarketPosition,
    IntelligenceUtils
};
