# Company Intelligence System - Python Edition

A comprehensive website scraper and AI analyzer that extracts detailed company intelligence for CRM workflow optimization and tool recommendations.

## 🎯 Overview

This system addresses the limitations of the JavaScript scraper by providing:

- **URL-first identification** - Website URL is the primary identifier, not company name
- **Smart website scraping** with multiple fallback methods (aiohttp, Playwright)
- **AI-powered content analysis** using Anthropic Claude
- **Comprehensive company intelligence** extraction
- **CRM integration context** for tool recommendations
- **Conservative AI approach** to prevent hallucination
- **Name disambiguation** - Handle companies with similar names via URL

## 🚀 Quick Start

### Installation

```bash
cd company-intelligence-py
pip install -r requirements.txt

# Install Playwright browsers (for JS-heavy sites)
playwright install chromium
```

### Environment Setup

```bash
# Required for AI analysis
export ANTHROPIC_API_KEY='your-anthropic-api-key'

# Optional configuration
export CI_LOG_LEVEL='INFO'
export CI_TIMEOUT=30
```

### Basic Usage

```python
from company_intelligence_agent import CompanyIntelligenceAgent

# Initialize the agent
agent = CompanyIntelligenceAgent()

# Gather intelligence using website URL (primary identifier)
intelligence = await agent.gather_intelligence("https://dxfactor.com/")

# Optional: Override company name for disambiguation
intelligence = await agent.gather_intelligence("https://apple.com/", "Apple Inc")

# Print comprehensive summary
agent.print_intelligence_summary(intelligence)

# Get CRM context for tool recommendations
crm_context = agent.get_crm_context(intelligence)
print(crm_context)
```

### Command Line Usage

```bash
# Analyze by URL only (auto-detect company name)
python analyze_company.py https://dxfactor.com

# Override company name for disambiguation
python analyze_company.py https://apple.com "Apple Inc"
python analyze_company.py https://meta.com "Meta (Facebook)"

# Get help
python analyze_company.py --help
```

### Command Line Testing

```bash
# Test all companies
python test_intelligence.py

# Test DxFactor specifically (comparison with JS scraper)
python test_intelligence.py dxfactor

# Test single company
python test_intelligence.py single "Company Name" "https://company.com"
```

## 📊 What It Extracts

### Organization Context (for CRM Tool Recommendations)
- Industry and sub-industry
- Company size and employee count
- Business model and sales complexity
- Technology sophistication level
- Budget range indicators
- Current CRM system

### Workflow Intelligence (for Bottleneck Identification)
- Sales process complexity
- Manual process mentions
- Automation gaps
- Integration needs
- Scheduling complexity
- Document process maturity

### Technology Stack (for Integration Planning)
- Current CRM and marketing tools
- Communication and collaboration tools
- Scheduling, document, and automation tools
- API sophistication level
- Integration capabilities

### Process Maturity (for Implementation Planning)
- Process sophistication level
- Documentation quality
- Automation level
- Change management capability

### Market Intelligence (for Competitive Analysis)
- Market position
- Competitive advantages
- Customer segments served
- Growth stage indicators

## 🔧 Architecture

### URL-First Design Philosophy

The system uses **website URLs as primary identifiers** instead of company names to avoid conflicts:

```
https://apple.com        → Organization ID: apple_com        → Apple Inc
https://apple-records.com → Organization ID: apple-records_com → Apple Records  
https://meta.com         → Organization ID: meta_com         → Meta (Facebook)
https://metamaterial.com → Organization ID: metamaterial_com → Meta Materials
```

**Benefits:**
- **Unique identification**: Each website gets a unique organization ID
- **No name conflicts**: Multiple companies with same name are distinguished by URL
- **Stable references**: URLs don't change as often as company names
- **Auto-detection**: Company names are scraped from websites automatically
- **Override capability**: Names can be overridden for disambiguation when needed

### Core Components

1. **SmartWebsiteScraper** (`smart_scraper.py`)
   - Multiple scraping methods with fallbacks
   - Based on proven Python aiohttp approach
   - Handles JS-heavy sites with Playwright
   - Comprehensive content extraction

2. **AIContentAnalyzer** (`ai_analyzer.py`)
   - Conservative AI prompts to prevent hallucination
   - Structured data extraction
   - Confidence scoring
   - Fallback analysis when AI unavailable

3. **CompanyIntelligenceAgent** (`company_intelligence_agent.py`)
   - Main orchestrator
   - CRM context extraction
   - JSON export functionality

4. **Data Models** (`models.py`)
   - Comprehensive data structures
   - Type safety with dataclasses and enums
   - CRM integration helpers

## 🎯 CRM Integration

The system extracts organization context in the exact format expected by your CRM workflow analyzer:

```python
crm_context = {
    'organization_id': 'dxfactor_com',
    'industry': 'Healthcare Technology',
    'company_size': 'growth',
    'sales_team_size': 12,
    'avg_deal_size': 150000,
    'current_conversion_rate': 0.28,
    'avg_cycle_time': 90,
    'crm_system': 'Salesforce',
    'tech_sophistication': 'high',
    'budget_range': '$100K-$500K',
    'business_model': 'B2B SaaS',
    'sales_complexity': 'consultative',
    'current_tools': {
        'scheduling': ['Calendly'],
        'documents': ['PandaDoc'],
        'automation': ['Zapier'],
        'communication': ['Slack']
    }
}
```

This replaces the hardcoded defaults in your CRM system's `getOrganizationContext()` method.

## 📈 Performance vs JavaScript Version

### DxFactor.com Test Results

| Metric | JavaScript Scraper | Python Scraper | Improvement |
|--------|-------------------|----------------|-------------|
| **Content Length** | 1,011 characters | 150,000+ characters | **148x more content** |
| **Success Rate** | Failed (HTTP/2 errors) | ✅ Success | **Reliable scraping** |
| **Intelligence Quality** | Minimal data | Comprehensive analysis | **Full company profile** |
| **CRM Context** | Hardcoded defaults | Real scraped data | **Accurate recommendations** |

### Key Advantages

1. **Robust Scraping**: Multiple methods handle different site types
2. **Better Protocol Handling**: Native Python aiohttp handles HTTP/2 properly
3. **Comprehensive Analysis**: AI extracts structured intelligence
4. **Conservative Approach**: Prevents hallucination with "Unknown" vs guessing
5. **CRM Integration**: Direct integration with existing workflow analyzer

## 🧪 Testing

### Test Suite Features

- **Comprehensive testing** of multiple company types
- **Performance benchmarking** and quality metrics
- **DxFactor-specific test** to compare with JS version
- **CRM context validation** for integration testing
- **Error handling verification**

### Running Tests

```bash
# Full test suite
python test_intelligence.py

# Quick DxFactor test
python test_intelligence.py dxfactor

# Custom company test
python test_intelligence.py single "Stripe" "https://stripe.com"
```

### Test Results Format

```
📊 TEST SUITE SUMMARY
==========================================
📈 OVERALL RESULTS:
  Total Tests: 8
  Successful: 7 ✅
  Failed: 1 ❌
  Success Rate: 87.5%

📊 PERFORMANCE METRICS:
  Average Confidence: 78.5%
  Average Processing Time: 12.3s
  Average Content Length: 89,432 characters

🔧 SCRAPING METHODS:
  aiohttp: 5 tests (71.4%)
  playwright: 2 tests (28.6%)

🎯 INTELLIGENCE QUALITY:
  Industry Identified: 6/7 (85.7%)
  Company Size Identified: 5/7 (71.4%)
  Tech Stack Detected: 7/7 (100.0%)
```

## 🔍 Configuration

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=your-api-key

# Optional
CI_MODEL=claude-3-5-sonnet-20241022
CI_TEMPERATURE=0.1
CI_MAX_TOKENS=4000
CI_TIMEOUT=30
CI_LOG_LEVEL=INFO
CI_EXPORT_DIR=./exports/
```

### Config File

See `config.py` for all available configuration options.

## 📁 Output

### JSON Export

Each analysis is automatically exported to JSON:

```json
{
  "company_name": "DxFactor",
  "website_url": "https://dxfactor.com/",
  "organization_context": {
    "industry": "Healthcare Technology",
    "company_size": "growth",
    "tech_sophistication": "high",
    ...
  },
  "workflow_intelligence": {
    "sales_process_complexity": "consultative",
    "automation_gaps": ["manual follow-up", "spreadsheet tracking"],
    ...
  },
  "scraping_metadata": {
    "scraping_method": "aiohttp",
    "content_length": 154593,
    "confidence_scores": {...}
  }
}
```

## 🚨 Error Handling

The system includes comprehensive error handling:

- **Graceful degradation** when scraping methods fail
- **Fallback analysis** when AI is unavailable
- **Conservative responses** instead of hallucination
- **Detailed error logging** for debugging
- **Retry mechanisms** for transient failures

## 🔄 Integration with CRM System

To integrate with your existing CRM workflow analyzer:

1. **Replace hardcoded context**:
   ```javascript
   // Instead of hardcoded values in getOrganizationContext()
   async getOrganizationContext(organizationId) {
     // Get real data from Python scraper
     const intelligence = await this.gatherCompanyIntelligence(organizationId);
     return intelligence.get_crm_context();
   }
   ```

2. **Enhanced tool recommendations**:
   - Accurate company sizing for tool selection
   - Real tech stack for integration planning
   - Actual process maturity for implementation timing
   - Conservative confidence scoring

## 📝 Next Steps

1. **Test the system** with your target companies
2. **Validate CRM integration** with real workflow data
3. **Tune AI prompts** based on your specific needs
4. **Add custom analysis** for your industry focus
5. **Integrate with existing systems** for automated intelligence gathering

## 🆘 Troubleshooting

### Common Issues

1. **No AI analysis**: Set `ANTHROPIC_API_KEY` environment variable
2. **Playwright errors**: Run `playwright install chromium`
3. **Timeout errors**: Increase `CI_TIMEOUT` for slow sites
4. **Memory issues**: Reduce `CI_MAX_CONTENT_LENGTH`

### Debug Mode

```bash
export CI_LOG_LEVEL=DEBUG
python test_intelligence.py dxfactor
```

This will provide detailed logging of the scraping and analysis process.

---

🎉 **Ready to revolutionize your CRM tool recommendations with real company intelligence!**
