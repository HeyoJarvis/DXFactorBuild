"""
Company Intelligence Agent - Main orchestrator for the intelligent scraping system.

This agent combines the smart scraper and AI analyzer to provide a complete
company intelligence gathering solution.
"""

import asyncio
import logging
import os
from typing import Dict, List, Optional, Any
from dataclasses import asdict

from smart_scraper import SmartWebsiteScraper
from ai_analyzer import AIContentAnalyzer
from models import CompanyIntelligence


class CompanyIntelligenceAgent:
    """
    Main agent that orchestrates company intelligence gathering.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the company intelligence agent."""
        self.config = config or {}
        
        # Get API key from config or environment
        api_key = (
            self.config.get('anthropic_api_key') or 
            self.config.get('ANTHROPIC_API_KEY') or 
            os.getenv('ANTHROPIC_API_KEY')
        )
        
        if api_key:
            self.config['anthropic_api_key'] = api_key
        
        # Initialize components
        self.scraper = SmartWebsiteScraper(self.config)
        self.analyzer = AIContentAnalyzer(self.config)
        
        # Setup logging
        self.logger = logging.getLogger(__name__)
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
    
    async def gather_intelligence(self, url: str, company_name: Optional[str] = None) -> CompanyIntelligence:
        """
        Main method to gather comprehensive company intelligence.
        
        Args:
            url: Company website URL (primary identifier)
            company_name: Optional company name override (if different from scraped name)
            
        Returns:
            CompanyIntelligence object with all gathered information
        """
        self.logger.info(f"🔍 Starting intelligence gathering for: {url}")
        if company_name:
            self.logger.info(f"📝 Company name override: {company_name}")
        
        try:
            # Step 1: Scrape website content
            self.logger.info("📄 Scraping website content...")
            scraped_data, scraping_metadata = await self.scraper.scrape_website(url)
            
            if not scraping_metadata.scraping_success:
                self.logger.warning("⚠️ Website scraping failed, proceeding with limited data")
            else:
                self.logger.info(f"✅ Scraping successful: {scraping_metadata.content_length} characters")
            
            # Step 2: Analyze content with AI
            self.logger.info("🤖 Analyzing content with AI...")
            company_intelligence = await self.analyzer.analyze_company_content(scraped_data, scraping_metadata)
            
            # Override company name if provided (useful for disambiguation)
            if company_name:
                self.logger.info(f"🏷️ Overriding company name: {company_intelligence.company_name} → {company_name}")
                company_intelligence.company_name = company_name
                company_intelligence.organization_context.company_name = company_name
            
            self.logger.info("✅ Intelligence gathering completed!")
            self.logger.info(f"📊 Overall confidence: {company_intelligence.get_confidence_score():.1%}")
            
            return company_intelligence
            
        except Exception as e:
            self.logger.error(f"❌ Intelligence gathering failed: {e}")
            raise
    
    def get_crm_context(self, intelligence: CompanyIntelligence) -> Dict[str, Any]:
        """
        Extract CRM context in the format expected by the CRM workflow analyzer.
        
        This is the key integration point with your existing CRM system.
        """
        return intelligence.get_crm_context()
    
    def print_intelligence_summary(self, intelligence: CompanyIntelligence) -> None:
        """Print a formatted summary of the gathered intelligence."""
        print("\n" + "="*80)
        print(f"🏢 COMPANY INTELLIGENCE REPORT")
        print("="*80)
        
        # Basic Information
        print(f"\n📋 BASIC INFORMATION")
        print(f"Company: {intelligence.company_name}")
        print(f"Website: {intelligence.website_url}")
        print(f"Industry: {intelligence.organization_context.industry}")
        print(f"Description: {intelligence.description or 'Not available'}")
        
        # Organization Context (for CRM)
        print(f"\n🏗️ ORGANIZATION CONTEXT (for CRM recommendations)")
        org = intelligence.organization_context
        print(f"Company Size: {org.company_size.value}")
        print(f"Business Model: {org.business_model or 'Unknown'}")
        print(f"Sales Complexity: {org.sales_complexity.value}")
        print(f"Tech Sophistication: {org.tech_sophistication.value}")
        print(f"Employee Count: {org.employee_count_estimate or 'Unknown'}")
        print(f"Sales Team Size: {org.sales_team_size or 'Unknown'}")
        print(f"Avg Deal Size: ${org.avg_deal_size:,}" if org.avg_deal_size else "Avg Deal Size: Unknown")
        print(f"Budget Range: {org.budget_range or 'Unknown'}")
        
        # Technology Stack
        print(f"\n💻 TECHNOLOGY STACK")
        tech = intelligence.technology_stack
        print(f"CRM System: {tech.crm_system or 'Unknown'}")
        print(f"Marketing Automation: {tech.marketing_automation or 'Unknown'}")
        if tech.scheduling_tools:
            print(f"Scheduling Tools: {', '.join(tech.scheduling_tools)}")
        if tech.document_tools:
            print(f"Document Tools: {', '.join(tech.document_tools)}")
        if tech.automation_tools:
            print(f"Automation Tools: {', '.join(tech.automation_tools)}")
        if tech.communication_tools:
            print(f"Communication Tools: {', '.join(tech.communication_tools)}")
        
        # Workflow Intelligence
        print(f"\n⚙️ WORKFLOW INTELLIGENCE")
        workflow = intelligence.workflow_intelligence
        print(f"Sales Process Complexity: {workflow.sales_process_complexity.value}")
        print(f"Sales Cycle Length: {workflow.sales_cycle_length_estimate or 'Unknown'} days")
        if workflow.manual_process_mentions:
            print(f"Manual Processes: {', '.join(workflow.manual_process_mentions[:3])}")
        if workflow.automation_gaps:
            print(f"Automation Gaps: {', '.join(workflow.automation_gaps[:3])}")
        if workflow.integration_needs:
            print(f"Integration Needs: {', '.join(workflow.integration_needs[:3])}")
        
        # Process Maturity
        print(f"\n📈 PROCESS MATURITY")
        process = intelligence.process_maturity
        print(f"Process Sophistication: {process.process_sophistication}")
        print(f"Automation Level: {process.automation_level}")
        print(f"Documentation Quality: {process.documentation_quality}")
        print(f"Change Management Capability: {process.change_management_capability}")
        
        # Market Intelligence
        print(f"\n🎯 MARKET INTELLIGENCE")
        market = intelligence.market_intelligence
        print(f"Market Position: {market.market_position or 'Unknown'}")
        print(f"Growth Stage: {market.growth_stage or 'Unknown'}")
        if market.competitive_advantages:
            print(f"Competitive Advantages: {', '.join(market.competitive_advantages[:3])}")
        if market.ideal_customer_segments:
            print(f"Customer Segments: {', '.join(market.ideal_customer_segments[:3])}")
        if market.customer_pain_points:
            print(f"Customer Pain Points: {', '.join(market.customer_pain_points[:3])}")
        
        # Data Quality
        print(f"\n📊 DATA QUALITY")
        quality = intelligence.get_data_quality_summary()
        print(f"Overall Confidence: {quality['overall_confidence']:.1%}")
        print(f"Data Completeness: {quality['data_completeness']:.1%}")
        print(f"Scraping Success: {'✅' if quality['scraping_success'] else '❌'}")
        print(f"Content Length: {quality['content_length']:,} characters")
        print(f"Processing Time: {quality['processing_time']:.1f} seconds")
        
        if quality['errors_count'] > 0:
            print(f"⚠️ Errors: {quality['errors_count']}")
        if quality['warnings_count'] > 0:
            print(f"⚠️ Warnings: {quality['warnings_count']}")
        
        print("\n" + "="*80)
    
    def export_to_json(self, intelligence: CompanyIntelligence, filename: Optional[str] = None) -> str:
        """Export intelligence to JSON file."""
        import json
        from datetime import datetime
        
        if not filename:
            # Use organization_id for consistent filename generation
            org_id = intelligence.organization_context.organization_id
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"{org_id}_intelligence_{timestamp}.json"
        
        data = intelligence.to_dict()
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)
        
        self.logger.info(f"💾 Intelligence exported to: {filename}")
        return filename
