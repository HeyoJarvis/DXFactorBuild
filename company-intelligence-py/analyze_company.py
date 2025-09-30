#!/usr/bin/env python3
"""
Simple CLI tool for analyzing companies by website URL.

This demonstrates the URL-first approach where the website is the primary identifier
and company names are auto-detected or optionally overridden.

Usage:
    python analyze_company.py https://dxfactor.com
    python analyze_company.py https://apple.com "Apple Inc"
    python analyze_company.py --help
"""

import asyncio
import sys
import argparse
from typing import Optional

from company_intelligence_agent import CompanyIntelligenceAgent


async def analyze_company_by_url(url: str, company_name: Optional[str] = None):
    """
    Analyze a company using just their website URL.
    
    Args:
        url: Company website URL (primary identifier)
        company_name: Optional name override for disambiguation
    """
    print(f"\n🔍 ANALYZING COMPANY")
    print(f"🌐 Website: {url}")
    if company_name:
        print(f"🏷️ Name Override: {company_name}")
    print(f"{'='*60}")
    
    # Initialize the intelligence agent
    agent = CompanyIntelligenceAgent()
    
    try:
        # Gather intelligence (URL is primary, name is optional)
        intelligence = await agent.gather_intelligence(url, company_name)
        
        # Print comprehensive report
        agent.print_intelligence_summary(intelligence)
        
        # Show CRM context
        crm_context = agent.get_crm_context(intelligence)
        print(f"\n🔧 CRM INTEGRATION CONTEXT:")
        print(f"Organization ID: {crm_context['organization_id']}")
        print(f"Industry: {crm_context['industry']}")
        print(f"Company Size: {crm_context['company_size']}")
        print(f"Business Model: {crm_context['business_model']}")
        print(f"CRM System: {crm_context['crm_system']}")
        print(f"Tech Sophistication: {crm_context['tech_sophistication']}")
        
        # Export to JSON
        filename = agent.export_to_json(intelligence)
        print(f"\n💾 Full analysis exported to: {filename}")
        
        return intelligence
        
    except Exception as e:
        print(f"\n❌ Analysis failed: {e}")
        return None


def main():
    """Main CLI function."""
    parser = argparse.ArgumentParser(
        description="Analyze companies by website URL",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python analyze_company.py https://dxfactor.com
  python analyze_company.py https://apple.com "Apple Inc"
  python analyze_company.py https://meta.com
  python analyze_company.py https://metamaterial.com "Meta Materials"

The website URL is the primary identifier. Company names are auto-detected
from the website content, but can be overridden for disambiguation.
        """
    )
    
    parser.add_argument(
        'url',
        help='Company website URL (primary identifier)'
    )
    
    parser.add_argument(
        'company_name',
        nargs='?',
        help='Optional company name override for disambiguation'
    )
    
    parser.add_argument(
        '--export-only',
        action='store_true',
        help='Only export JSON, skip detailed output'
    )
    
    args = parser.parse_args()
    
    # Validate URL
    if not args.url.startswith(('http://', 'https://')):
        args.url = 'https://' + args.url
    
    # Run analysis
    try:
        intelligence = asyncio.run(analyze_company_by_url(args.url, args.company_name))
        
        if intelligence:
            print(f"\n✅ Analysis completed successfully!")
            print(f"📊 Confidence: {intelligence.get_confidence_score():.1%}")
            print(f"🏢 Company: {intelligence.company_name}")
            print(f"🆔 Organization ID: {intelligence.organization_context.organization_id}")
        else:
            print(f"\n❌ Analysis failed")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print(f"\n⏹️ Analysis interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()


