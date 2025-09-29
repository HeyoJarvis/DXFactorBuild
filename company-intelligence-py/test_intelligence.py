"""
Test suite for the Company Intelligence System.

This script tests the intelligent scraper with various companies to ensure
it works better than the JavaScript version and provides comprehensive
company intelligence.
"""

import asyncio
import logging
import os
import sys
from typing import List, Tuple, Optional

from company_intelligence_agent import CompanyIntelligenceAgent


# Test companies with different characteristics
# Format: (Optional_Company_Name, Website_URL)
# The website URL is the primary identifier - company name is optional for disambiguation
TEST_COMPANIES = [
    # The problematic one that JS scraper couldn't handle well
    ("DxFactor", "https://dxfactor.com/"),
    
    # Well-structured sites for comparison
    ("Slack", "https://slack.com/"),
    ("HubSpot", "https://hubspot.com/"),
    
    # Different company types
    ("Stripe", "https://stripe.com/"),
    ("Zoom", "https://zoom.us/"),
    ("Calendly", "https://calendly.com/"),
    
    # Smaller/different companies
    ("Zapier", "https://zapier.com/"),
    ("PandaDoc", "https://pandadoc.com/"),
    
    # Test cases for name disambiguation (same company name, different websites)
    # These would be handled correctly by URL-based identification
    # ("Apple Inc", "https://apple.com/"),           # Apple Computer
    # ("Apple Records", "https://apple-records.com/"), # Apple Music Label (hypothetical)
    # ("Meta", "https://meta.com/"),                 # Facebook/Meta
    # ("Meta Materials", "https://metamaterial.com/"), # Different Meta company
]


class IntelligenceTestSuite:
    """Test suite for company intelligence gathering."""
    
    def __init__(self):
        """Initialize the test suite."""
        self.agent = CompanyIntelligenceAgent()
        self.results = []
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
    
    async def test_single_company(self, company_name: Optional[str], url: str) -> dict:
        """Test intelligence gathering for a single company."""
        print(f"\n{'='*60}")
        print(f"🔍 TESTING: {company_name or 'Auto-detected from website'}")
        print(f"🌐 URL: {url}")
        print(f"{'='*60}")
        
        try:
            # Gather intelligence
            intelligence = await self.agent.gather_intelligence(url, company_name)
            
            # Print summary
            self.agent.print_intelligence_summary(intelligence)
            
            # Get CRM context (this is what the CRM system would use)
            crm_context = self.agent.get_crm_context(intelligence)
            print(f"\n🔧 CRM CONTEXT (for tool recommendations):")
            for key, value in crm_context.items():
                if isinstance(value, dict):
                    print(f"  {key}:")
                    for sub_key, sub_value in value.items():
                        print(f"    {sub_key}: {sub_value}")
                else:
                    print(f"  {key}: {value}")
            
            # Export to JSON
            filename = self.agent.export_to_json(intelligence)
            
            # Collect test results
            quality = intelligence.get_data_quality_summary()
            result = {
                'company_name': company_name or intelligence.company_name,
                'url': url,
                'success': True,
                'confidence': quality['overall_confidence'],
                'content_length': quality['content_length'],
                'processing_time': quality['processing_time'],
                'scraping_method': intelligence.scraping_metadata.scraping_method,
                'errors': quality['errors_count'],
                'warnings': quality['warnings_count'],
                'filename': filename,
                'industry_identified': intelligence.organization_context.industry != 'Unknown',
                'company_size_identified': intelligence.organization_context.company_size.value != 'smb',
                'tech_stack_detected': len(intelligence.technology_stack.crm_system or '') > 0,
                'crm_context': crm_context
            }
            
            print(f"\n✅ SUCCESS: {company_name or intelligence.company_name} analysis completed")
            return result
            
        except Exception as e:
            print(f"\n❌ FAILED: {company_name} - {str(e)}")
            self.logger.error(f"Test failed for {company_name}: {e}")
            
            return {
                'company_name': company_name or 'Unknown',
                'url': url,
                'success': False,
                'error': str(e),
                'confidence': 0.0,
                'content_length': 0,
                'processing_time': 0.0
            }
    
    async def run_all_tests(self, companies: List[Tuple[str, str]] = None) -> List[dict]:
        """Run tests for all companies."""
        companies = companies or TEST_COMPANIES
        
        print(f"\n🚀 STARTING COMPANY INTELLIGENCE TEST SUITE")
        print(f"📊 Testing {len(companies)} companies...")
        
        # Check for API key
        if not os.getenv('ANTHROPIC_API_KEY'):
            print("\n⚠️ WARNING: No ANTHROPIC_API_KEY found in environment variables")
            print("AI analysis will be limited. Set your API key for full functionality:")
            print("export ANTHROPIC_API_KEY='your-api-key-here'")
        
        results = []
        
        for company_name, url in companies:
            try:
                result = await self.test_single_company(company_name, url)
                results.append(result)
                
                # Brief pause between tests
                await asyncio.sleep(2)
                
            except KeyboardInterrupt:
                print("\n⏹️ Test suite interrupted by user")
                break
            except Exception as e:
                print(f"\n💥 Unexpected error testing {company_name}: {e}")
                results.append({
                    'company_name': company_name,
                    'url': url,
                    'success': False,
                    'error': f"Unexpected error: {str(e)}"
                })
        
        # Print summary
        self.print_test_summary(results)
        
        return results
    
    def print_test_summary(self, results: List[dict]) -> None:
        """Print a summary of all test results."""
        print(f"\n{'='*80}")
        print(f"📊 TEST SUITE SUMMARY")
        print(f"{'='*80}")
        
        successful_tests = [r for r in results if r.get('success', False)]
        failed_tests = [r for r in results if not r.get('success', False)]
        
        print(f"\n📈 OVERALL RESULTS:")
        print(f"  Total Tests: {len(results)}")
        print(f"  Successful: {len(successful_tests)} ✅")
        print(f"  Failed: {len(failed_tests)} ❌")
        print(f"  Success Rate: {len(successful_tests)/len(results)*100:.1f}%")
        
        if successful_tests:
            avg_confidence = sum(r.get('confidence', 0) for r in successful_tests) / len(successful_tests)
            avg_processing_time = sum(r.get('processing_time', 0) for r in successful_tests) / len(successful_tests)
            avg_content_length = sum(r.get('content_length', 0) for r in successful_tests) / len(successful_tests)
            
            print(f"\n📊 PERFORMANCE METRICS (successful tests):")
            print(f"  Average Confidence: {avg_confidence:.1%}")
            print(f"  Average Processing Time: {avg_processing_time:.1f}s")
            print(f"  Average Content Length: {avg_content_length:,.0f} characters")
            
            # Scraping method breakdown
            methods = {}
            for result in successful_tests:
                method = result.get('scraping_method', 'unknown')
                methods[method] = methods.get(method, 0) + 1
            
            print(f"\n🔧 SCRAPING METHODS:")
            for method, count in methods.items():
                print(f"  {method}: {count} tests ({count/len(successful_tests)*100:.1f}%)")
            
            # Intelligence quality
            industry_identified = sum(1 for r in successful_tests if r.get('industry_identified', False))
            size_identified = sum(1 for r in successful_tests if r.get('company_size_identified', False))
            tech_detected = sum(1 for r in successful_tests if r.get('tech_stack_detected', False))
            
            print(f"\n🎯 INTELLIGENCE QUALITY:")
            print(f"  Industry Identified: {industry_identified}/{len(successful_tests)} ({industry_identified/len(successful_tests)*100:.1f}%)")
            print(f"  Company Size Identified: {size_identified}/{len(successful_tests)} ({size_identified/len(successful_tests)*100:.1f}%)")
            print(f"  Tech Stack Detected: {tech_detected}/{len(successful_tests)} ({tech_detected/len(successful_tests)*100:.1f}%)")
        
        if failed_tests:
            print(f"\n❌ FAILED TESTS:")
            for result in failed_tests:
                print(f"  {result['company_name']}: {result.get('error', 'Unknown error')}")
        
        print(f"\n{'='*80}")
    
    async def test_dxfactor_specifically(self) -> dict:
        """Test DxFactor specifically to compare with JS version."""
        print(f"\n🎯 SPECIAL TEST: DxFactor (JS scraper comparison)")
        print(f"This test specifically checks if our Python scraper works better")
        print(f"than the JavaScript version that was failing.")
        
        result = await self.test_single_company("DxFactor", "https://dxfactor.com/")
        
        if result.get('success'):
            print(f"\n🎉 PYTHON SCRAPER SUCCESS!")
            print(f"✅ Content Length: {result['content_length']:,} characters")
            print(f"✅ Confidence: {result['confidence']:.1%}")
            print(f"✅ Method: {result['scraping_method']}")
            print(f"✅ Processing Time: {result['processing_time']:.1f}s")
            
            if result['content_length'] > 1000:
                print(f"🚀 MUCH BETTER than JS version (which got ~1,011 characters)")
            
        else:
            print(f"\n😞 Python scraper also failed for DxFactor")
            print(f"❌ Error: {result.get('error')}")
        
        return result


async def main():
    """Main test function."""
    test_suite = IntelligenceTestSuite()
    
    # Parse command line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == 'dxfactor':
            # Test DxFactor specifically
            await test_suite.test_dxfactor_specifically()
        elif sys.argv[1] == 'single' and len(sys.argv) > 3:
            # Test single company
            company_name = sys.argv[2]
            url = sys.argv[3]
            await test_suite.test_single_company(company_name, url)
        else:
            print("Usage:")
            print("  python test_intelligence.py                    # Run all tests")
            print("  python test_intelligence.py dxfactor           # Test DxFactor specifically")
            print("  python test_intelligence.py single 'Name' 'URL' # Test single company")
    else:
        # Run all tests
        await test_suite.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
