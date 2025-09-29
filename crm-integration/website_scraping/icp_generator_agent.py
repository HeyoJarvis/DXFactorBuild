"""
ICP Generator Agent - Intelligent Customer Profile Generation

Analyzes existing customers to create data-driven ICPs for lead mining.
"""

import asyncio
import logging
import os
import json
import aiohttp
from typing import Dict, List, Any, Optional
from datetime import datetime
from bs4 import BeautifulSoup

from ai_engines.anthropic_engine import AnthropicEngine
from ai_engines.base_engine import AIEngineConfig
from .models.icp_models import CustomerProfile, CustomerPatterns, ICPGenerationResult, ICPConfidence, CustomerSegment
from .utils.customer_analyzer import CustomerAnalyzer
from .utils.enhanced_customer_analyzer import EnhancedCustomerAnalyzer
from ..lead_generation.models.lead_models import ICPCriteria

logger = logging.getLogger(__name__)


class ICPGeneratorAgent:
    """
    AI agent for generating Ideal Customer Profiles from existing customer data.
    
    Follows the contract: run(state: dict) -> dict
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the ICP Generator Agent."""
        self.config = config or {}
        self.logger = logging.getLogger(__name__)
        
        # Initialize AI engine for analysis
        self._initialize_ai_engine()
        
        # Initialize analysis utilities
        self._initialize_utilities()
        
        # Configuration
        self.min_customers_for_analysis = self.config.get('min_customers_for_analysis', 2)
        self.confidence_threshold = self.config.get('confidence_threshold', 0.7)
        
        self.logger.info("ICPGeneratorAgent initialized successfully")
    
    def _initialize_ai_engine(self):
        """Initialize AI engine for customer analysis."""
        try:
            api_key = self.config.get('anthropic_api_key') or os.getenv('ANTHROPIC_API_KEY')
            if api_key:
                config = AIEngineConfig(
                    api_key=api_key,
                    model="claude-3-5-sonnet-20241022",
                    temperature=0.2,  # Low temperature for consistent analysis
                    max_tokens=3000
                )
                self.ai_engine = AnthropicEngine(config)
                self.logger.info("AI engine initialized for ICP generation")
            else:
                self.ai_engine = None
                self.logger.warning("No AI engine - using basic ICP generation")
        except Exception as e:
            self.logger.error(f"Failed to initialize AI engine: {e}")
            self.ai_engine = None
    
    def _initialize_utilities(self):
        """Initialize analysis utilities."""
        self.customer_analyzer = CustomerAnalyzer(self.ai_engine)
        self.enhanced_analyzer = EnhancedCustomerAnalyzer(self.ai_engine)
        self.logger.info("Customer analysis utilities initialized")
    
    async def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main ICP generation workflow.
        
        Expected state:
        {
            'business_context': 'cipio.ai uses CLAUDE for scraping',
            'existing_customers': ['Coke', 'Build-a-Bear'],
            'product_description': 'AI scraping platform',
            'user_request': 'Generate ICP from my customers',
            'session_id': 'session_123'
        }
        """
        start_time = datetime.now()
        self.logger.info("Starting ICP generation process")
        
        try:
            # NEW: support explicit generation methods
            method = (state.get('generation_method') or '').lower()
            if not method:
                # infer from state
                if state.get('website_url'): method = 'website'
                elif state.get('chat_description') or state.get('conversation_history'): method = 'chat'
            
            if method == 'website':
                website_url = state.get('website_url', '')
                self.logger.info(f"Generating ICP from website: {website_url}")
                icp_from_website = await self._generate_icp_from_website(website_url, state)
                self.logger.info(f"Generated ICP: {icp_from_website.to_dict() if icp_from_website else 'None'}")
                result = self._wrap_success(icp_from_website, state, start_time, source_customers=[])
                self.logger.info(f"Wrapped result keys: {result.keys() if result else 'None'}")
                return result
            
            if method == 'chat':
                icp_from_chat = await self._generate_icp_from_chat(
                    state.get('chat_description', ''),
                    state.get('conversation_history', []) or state.get('conversation', []) or []
                )
                return self._wrap_success(icp_from_chat, state, start_time, source_customers=[])
            
            # Existing customer-based / HubSpot flow
            # Step 1: Check if user wants to fetch from HubSpot
            user_request = state.get('user_request', '').lower()
            if 'hubspot' in user_request and ('my' in user_request or 'all' in user_request):
                self.logger.info("User requesting ICP from HubSpot customer data")
                customer_profiles = await self._fetch_hubspot_customers(state)
                if len(customer_profiles) < self.min_customers_for_analysis:
                    return self._create_error_response(
                        state, 
                        f"Need at least {self.min_customers_for_analysis} customers for ICP analysis. Found {len(customer_profiles)} companies in HubSpot. Please ensure your HubSpot account has customer data or provide specific customer names."
                    )
            else:
                # Extract customer list from state (traditional method)
                customer_list = self._extract_customer_list(state)
                if len(customer_list) < self.min_customers_for_analysis:
                    return self._create_error_response(
                        state, 
                        f"Need at least {self.min_customers_for_analysis} customers for ICP analysis. You provided: {customer_list}"
                    )
                
                # Step 2: Create customer profiles (basic for now, HubSpot enrichment in Phase 2)
                customer_profiles = await self._create_customer_profiles(customer_list, state)
            
            # Step 3: Analyze patterns using enhanced AI analysis
            # Build comprehensive business context
            enhanced_business_context = self._build_enhanced_business_context(state, customer_profiles)
            
            customer_patterns = await self.enhanced_analyzer.analyze_customer_patterns(
                customer_profiles, 
                enhanced_business_context
            )
            
            # Step 4: Generate ICP criteria from patterns
            icp_criteria = await self._generate_icp_from_patterns(customer_patterns, state)
            
            # Step 5: Create result with recommendations
            generation_duration = (datetime.now() - start_time).total_seconds()
            
            # Get source customer names
            source_customers = [profile.company_name for profile in customer_profiles] if customer_profiles else []
            
            return self._wrap_success(icp_criteria, state, start_time, source_customers)
            
        except Exception as e:
            self.logger.error(f"ICP generation failed: {e}")
            return self._create_error_response(state, str(e))
    
    def _wrap_success(self, icp_criteria: ICPCriteria, state: Dict[str, Any], start_time: datetime, source_customers: List[str]):
        """Normalize success response shape for all methods."""
        generation_duration = (datetime.now() - start_time).total_seconds()
        # Minimal patterns placeholder for downstream
        patterns = {
            "primary_industries": icp_criteria.industries,
            "key_titles": icp_criteria.job_titles,
            "primary_locations": icp_criteria.locations,
            "employee_range_min": icp_criteria.company_size_min,
            "employee_range_max": icp_criteria.company_size_max,
            "common_technologies": icp_criteria.technologies or []
        }
        result_state = state.copy()
        result_state.update({
            "icp_generated": True,
            "icp_criteria": icp_criteria.to_dict(),
            "customer_patterns": patterns,
            "icp_confidence": 0.8,
            "source_customers_count": len(source_customers),
            "icp_generation_success": True,
            "icp_result": {
                "recommendations": self._generate_recommendations(
                    CustomerPatterns(
                        primary_industries=patterns["primary_industries"],
                        sub_verticals=[],
                        industry_confidence=0.8,
                        employee_range_min=patterns["employee_range_min"],
                        employee_range_max=patterns["employee_range_max"],
                        revenue_range_min=icp_criteria.revenue_min or 0,
                        revenue_range_max=icp_criteria.revenue_max or 0,
                        size_confidence=0.8,
                        primary_locations=patterns["primary_locations"],
                        geographic_confidence=0.8,
                        common_technologies=patterns["common_technologies"],
                        technology_confidence=0.7,
                        key_titles=patterns["key_titles"],
                        departments=[],
                        seniority_levels=[],
                        decision_maker_confidence=0.7,
                        business_models=[],
                        growth_stages=[],
                        market_positions=[],
                        pain_points=[],
                        buying_signals=[],
                        purchase_triggers=[],
                        pattern_strength="medium",
                        overall_confidence=0.8,
                        customers_analyzed=len(source_customers)
                    ),
                    icp_criteria
                )
            },
            "next_recommended_action": "lead_mining",
            "generation_completed_at": datetime.now().isoformat()
        })
        return result_state
    
    def _extract_customer_list(self, state: Dict[str, Any]) -> List[str]:
        """Extract customer names from various input formats."""
        
        # Check different possible input formats
        customers = []
        
        # Direct list
        if 'existing_customers' in state:
            customers.extend(state['existing_customers'])
        
        # From user request parsing
        if 'customer_names' in state:
            customers.extend(state['customer_names'])
        
        # Parse from user_request text using AI (will be handled in async context)
        user_request = state.get('user_request', '')
        
        # Manual parsing for common examples
        user_request_lower = user_request.lower()
        if 'coke' in user_request_lower or 'coca-cola' in user_request_lower:
            customers.append('Coca-Cola')
        if 'build-a-bear' in user_request_lower:
            customers.append('Build-A-Bear Workshop')
        
        # Clean and deduplicate
        cleaned_customers = []
        for customer in customers:
            if isinstance(customer, str) and customer.strip():
                cleaned_customers.append(customer.strip())
        
        return list(set(cleaned_customers))  # Remove duplicates
    
    async def _fetch_hubspot_customers(self, state: Dict[str, Any]) -> List[CustomerProfile]:
        """Fetch all customer profiles from HubSpot."""
        try:
            from .connectors.hubspot_connector import HubSpotConnector
            
            # Get HubSpot API key from environment or config
            hubspot_api_key = os.getenv('HUBSPOT_API_KEY')
            if not hubspot_api_key:
                self.logger.warning("No HubSpot API key found in environment variables")
                return []
            
            # Initialize HubSpot connector
            hubspot = HubSpotConnector(hubspot_api_key)
            
            # Fetch all companies (limit to 50 for ICP analysis to avoid overwhelming the system)
            self.logger.info("Fetching companies from HubSpot...")
            customer_profiles = await hubspot.get_all_companies(limit=50)
            
            self.logger.info(f"Successfully fetched {len(customer_profiles)} customer profiles from HubSpot")
            return customer_profiles
            
        except Exception as e:
            self.logger.error(f"Failed to fetch customers from HubSpot: {e}")
            return []
    
    def _build_enhanced_business_context(self, state: Dict[str, Any], customer_profiles: List[CustomerProfile]) -> str:
        """Build comprehensive business context for better ICP analysis."""
        
        context_parts = []
        
        # Add user's business context
        business_context = state.get('business_context', '')
        if business_context:
            context_parts.append(f"Business Context: {business_context}")
        
        # Add product/service description
        product_description = state.get('product_description', '')
        if product_description:
            context_parts.append(f"Product/Service: {product_description}")
        
        # Analyze what we can learn from the customer data
        if customer_profiles:
            # Industry distribution
            industries = [c.industry for c in customer_profiles if c.industry and c.industry != "Unknown"]
            if industries:
                industry_counts = {}
                for industry in industries:
                    industry_counts[industry] = industry_counts.get(industry, 0) + 1
                top_industries = sorted(industry_counts.items(), key=lambda x: x[1], reverse=True)[:3]
                context_parts.append(f"Customer Industries: {', '.join([f'{ind} ({count})' for ind, count in top_industries])}")
            
            # Size distribution
            sizes = [c.employee_count for c in customer_profiles if c.employee_count > 0]
            if sizes:
                avg_size = sum(sizes) / len(sizes)
                context_parts.append(f"Average Customer Size: {avg_size:.0f} employees (range: {min(sizes)}-{max(sizes)})")
            
            # Revenue patterns
            revenues = [c.annual_revenue for c in customer_profiles if c.annual_revenue]
            if revenues:
                avg_revenue = sum(revenues) / len(revenues)
                context_parts.append(f"Average Customer Revenue: ${avg_revenue/1000000:.1f}M")
            
            # Geographic concentration
            locations = [c.headquarters_location for c in customer_profiles if c.headquarters_location]
            if locations:
                location_counts = {}
                for loc in locations:
                    # Extract state/country from location
                    if ',' in loc:
                        state_country = loc.split(',')[-1].strip()
                        location_counts[state_country] = location_counts.get(state_country, 0) + 1
                top_locations = sorted(location_counts.items(), key=lambda x: x[1], reverse=True)[:3]
                context_parts.append(f"Geographic Focus: {', '.join([f'{loc} ({count})' for loc, count in top_locations])}")
        
        # Add user request for context
        user_request = state.get('user_request', '')
        if user_request:
            context_parts.append(f"User Goal: {user_request}")
        
        return " | ".join(context_parts)
    
    async def _extract_customers_from_text(self, user_request: str) -> List[str]:
        """Use AI to extract customer names from user request."""
        
        prompt = f"""
        Extract company names from this user request:
        
        "{user_request}"
        
        Look for:
        - Explicit company names mentioned
        - Brand names
        - Well-known companies
        
        Return JSON array of company names:
        ["Company Name 1", "Company Name 2"]
        
        If no companies found, return empty array: []
        """
        
        try:
            response = await self.ai_engine.generate(prompt)
            
            # Extract JSON array from response
            response_text = response.content.strip()
            if "[" in response_text and "]" in response_text:
                start_idx = response_text.find("[")
                end_idx = response_text.rfind("]") + 1
                json_text = response_text[start_idx:end_idx]
            else:
                json_text = "[]"
            
            return json.loads(json_text)
            
        except Exception as e:
            self.logger.error(f"Customer extraction from text failed: {e}")
            return []
    
    async def _create_customer_profiles(self, customer_list: List[str], state: Dict[str, Any]) -> List[CustomerProfile]:
        """Create customer profiles from company names."""
        
        profiles = []
        
        for company_name in customer_list:
            # For Phase 1, create basic profiles using AI knowledge
            # Phase 2 will enhance with HubSpot data
            profile = await self._create_basic_customer_profile(company_name, state)
            if profile:
                profiles.append(profile)
        
        self.logger.info(f"Created {len(profiles)} customer profiles")
        return profiles
    
    async def _create_basic_customer_profile(self, company_name: str, state: Dict[str, Any]) -> Optional[CustomerProfile]:
        """Create basic customer profile using AI knowledge."""
        
        if not self.ai_engine:
            # Basic fallback profile
            return CustomerProfile(
                company_name=company_name,
                industry="Unknown",
                employee_count=1000,
                headquarters_location="United States"
            )
        
        prompt = f"""
        Create a customer profile for this company based on general knowledge:
        
        Company: {company_name}
        Business Context: {state.get('business_context', '')}
        
        Provide what you know about this company:
        {{
            "company_name": "{company_name}",
            "industry": "Primary industry",
            "employee_count": estimated_employee_count,
            "annual_revenue": estimated_revenue_or_null,
            "headquarters_location": "City, Country",
            "business_model": "B2B|B2C|Marketplace",
            "market_position": "Leader|Challenger|Niche",
            "technologies_likely_used": ["CRM", "Marketing Automation"],
            "typical_decision_makers": ["VP Marketing", "CMO"]
        }}
        
        Be realistic and only include information you're confident about.
        """
        
        try:
            response = await self.ai_engine.generate(prompt)
            
            # Parse JSON response
            response_text = response.content.strip()
            if "{" in response_text and "}" in response_text:
                start_idx = response_text.find("{")
                end_idx = response_text.rfind("}") + 1
                json_text = response_text[start_idx:end_idx]
            else:
                json_text = response_text
            
            data = json.loads(json_text)
            
            # Determine customer segment
            employee_count = data.get("employee_count", 1000)
            if employee_count >= 1000:
                segment = CustomerSegment.ENTERPRISE
            elif employee_count >= 100:
                segment = CustomerSegment.MID_MARKET
            else:
                segment = CustomerSegment.SMB
            
            return CustomerProfile(
                company_name=data.get("company_name", company_name),
                industry=data.get("industry", "Unknown"),
                employee_count=employee_count,
                annual_revenue=data.get("annual_revenue"),
                headquarters_location=data.get("headquarters_location", "United States"),
                business_model=data.get("business_model", "B2B"),
                growth_stage=segment,
                market_position=data.get("market_position", "Unknown"),
                technologies_used=data.get("technologies_likely_used", []),
                decision_maker_titles=data.get("typical_decision_makers", []),
                data_sources=["ai_knowledge"],
                enrichment_confidence=0.6  # Medium confidence for AI-generated data
            )
            
        except Exception as e:
            self.logger.error(f"AI profile creation failed for {company_name}: {e}")
            return CustomerProfile(
                company_name=company_name,
                industry="Unknown",
                employee_count=1000,
                headquarters_location="United States",
                data_sources=["fallback"],
                enrichment_confidence=0.3
            )
    
    async def _generate_icp_from_patterns(self, patterns: CustomerPatterns, state: Dict[str, Any]) -> ICPCriteria:
        """Generate structured ICP criteria from customer patterns."""
        
        # Create ICP criteria based on identified patterns
        icp = ICPCriteria(
            # Company characteristics from patterns
            company_size_min=patterns.employee_range_min,
            company_size_max=patterns.employee_range_max,
            industries=patterns.primary_industries + patterns.sub_verticals,
            locations=patterns.primary_locations,
            
            # Decision makers from patterns
            job_titles=patterns.key_titles,
            
            # Technology and business context
            technologies=patterns.common_technologies,
            company_keywords=self._generate_company_keywords(patterns),
            
            # Revenue if available
            revenue_min=patterns.revenue_range_min,
            revenue_max=patterns.revenue_range_max,
            
            # Exclusions (will be enhanced in Phase 2)
            exclude_domains=[],
            exclude_companies=[]
        )
        
        self.logger.info(f"✅ Generated ICP targeting {len(icp.industries)} industries, {len(icp.job_titles)} titles")
        return icp
    
    def _generate_company_keywords(self, patterns: CustomerPatterns) -> List[str]:
        """Generate company keywords from patterns."""
        
        keywords = []
        
        # Add business model keywords
        keywords.extend(patterns.business_models)
        
        # Add growth stage keywords
        keywords.extend(patterns.growth_stages)
        
        # Add market position keywords
        keywords.extend(patterns.market_positions)
        
        # Add pain point keywords
        for pain_point in patterns.pain_points[:3]:
            # Extract key terms (with null safety)
            pain_point_text = (pain_point or '').lower()
            if "digital" in pain_point_text:
                keywords.append("Digital transformation")
            if "brand" in pain_point_text:
                keywords.append("Brand management")
            if "customer" in pain_point_text:
                keywords.append("Customer-focused")
        
        return list(set(keywords))[:10]  # Top 10 unique keywords
    
    def _generate_recommendations(self, patterns: CustomerPatterns, icp: ICPCriteria) -> List[str]:
        """Generate actionable recommendations based on ICP."""
        
        recommendations = []
        
        # Confidence-based recommendations
        if patterns.overall_confidence >= 0.8:
            recommendations.append("High confidence ICP - ready for immediate lead mining")
        elif patterns.overall_confidence >= 0.6:
            recommendations.append("Medium confidence ICP - consider adding more customer data")
        else:
            recommendations.append("Low confidence ICP - recommend gathering more customer examples")
        
        # Industry-specific recommendations
        if len(patterns.primary_industries) == 1:
            recommendations.append(f"Highly focused on {patterns.primary_industries[0]} - consider expanding to adjacent industries")
        elif len(patterns.primary_industries) > 5:
            recommendations.append("Very broad industry targeting - consider focusing on top 3 industries for better results")
        
        # Size-based recommendations
        size_ratio = patterns.employee_range_max / patterns.employee_range_min if patterns.employee_range_min > 0 else 1
        if size_ratio > 50:
            recommendations.append("Very broad company size range - consider segmenting by size for better targeting")
        
        # Technology recommendations
        if len(patterns.common_technologies) >= 3:
            recommendations.append("Strong technology pattern identified - use tech stack for targeted outreach")
        
        return recommendations
    
    def _create_error_response(self, state: Dict[str, Any], error: str) -> Dict[str, Any]:
        """Create standardized error response."""
        error_state = state.copy()
        error_state.update({
            "icp_generation_success": False,
            "icp_generation_error": error,
            "icp_generated": False,
            "generation_completed_at": datetime.now().isoformat()
        })
        return error_state
    
    async def _generate_icp_from_website(self, url: str, state: Dict[str, Any]) -> ICPCriteria:
        """Generate ICPCriteria directly from a website URL using AI summarization."""
        if not self.ai_engine:
            return ICPCriteria(industries=["Unknown"], locations=["United States"], job_titles=["Chief Marketing Officer"])  # fallback

        # First, fetch the website content
        self.logger.info(f"Starting website ICP generation for: {url}")
        website_content = await self._fetch_website_content(url)
        if not website_content:
            self.logger.error(f"Failed to fetch content from {url}")
            return ICPCriteria(industries=["Technology"], locations=["United States"], job_titles=["Decision Maker"])

        self.logger.info(f"Successfully fetched content, analyzing with AI...")

        prompt = f"""
        You are an ICP generator. Analyze this website content and infer the IDEAL CUSTOMER PROFILE.

        Website URL: {url}
        Website Content:
        {website_content[:8000]}  # Limit content to avoid token limits

        Based on the content, product positioning, value propositions, and target messaging,
        determine who their ideal customers would be.

        Return STRICT JSON with keys:
        {{
          "industries": ["..."],
          "job_titles": ["..."],
          "company_size_min": number,
          "company_size_max": number,
          "locations": ["..."],
          "technologies": ["..."],
          "revenue_min": number | null,
          "revenue_max": number | null
        }}
        Only return JSON.
        """
        resp = await self.ai_engine.generate(prompt)
        text = resp.content.strip()
        self.logger.info(f"AI Response: {text[:500]}...")
        try:
            data = json.loads(text[text.find('{'): text.rfind('}')+1]) if '{' in text else json.loads(text)
            self.logger.info(f"Parsed ICP data: {data}")
        except Exception as e:
            self.logger.error(f"Failed to parse AI response: {e}")
            data = {}
        return ICPCriteria(
            industries=data.get('industries', []) or ["Unknown"],
            job_titles=data.get('job_titles', []) or ["Decision Maker"],
            company_size_min=data.get('company_size_min', 50),
            company_size_max=data.get('company_size_max', 5000),
            locations=data.get('locations', []) or ["United States"],
            technologies=data.get('technologies', []) or [],
            revenue_min=data.get('revenue_min'),
            revenue_max=data.get('revenue_max')
        )

    async def _fetch_website_content(self, url: str) -> Optional[str]:
        """Fetch and extract text content from a website."""
        try:
            # Ensure URL has protocol
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url

            self.logger.info(f"Fetching website content from: {url}")

            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status != 200:
                        self.logger.error(f"Failed to fetch {url}: status {response.status}")
                        return None

                    html = await response.text()
                    self.logger.info(f"Fetched {len(html)} characters of HTML")

                    # Parse HTML and extract text
                    soup = BeautifulSoup(html, 'html.parser')

                    # Remove script and style elements
                    for script in soup(["script", "style"]):
                        script.decompose()

                    # Get text
                    text = soup.get_text()

                    # Break into lines and remove leading/trailing space
                    lines = (line.strip() for line in text.splitlines())
                    # Break multi-headlines into a line each
                    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                    # Drop blank lines
                    text = ' '.join(chunk for chunk in chunks if chunk)

                    self.logger.info(f"Extracted {len(text)} characters of text content")
                    return text[:10000]  # Limit to 10k characters

        except asyncio.TimeoutError:
            self.logger.error(f"Timeout fetching {url}")
            return None
        except Exception as e:
            self.logger.error(f"Error fetching website content from {url}: {e}")
            return None

    async def _generate_icp_from_chat(self, description: str, conversation: List[Dict[str, Any]]) -> ICPCriteria:
        """Generate ICPCriteria using chat description and conversation context."""
        if not self.ai_engine:
            return ICPCriteria(industries=["General"], locations=["United States"], job_titles=["Founder", "Head of Growth"])
        convo_snippets = []
        for msg in conversation[-8:]:
            if isinstance(msg, dict) and 'text' in msg:
                convo_snippets.append(msg['text'])
            elif isinstance(msg, str):
                convo_snippets.append(msg)
        convo_text = "\n".join(convo_snippets)
        prompt = f"""
        Based on the following conversation and optional business description, generate an IDEAL CUSTOMER PROFILE in STRICT JSON format.
        Description: {description}
        Conversation:
        {convo_text}
        JSON keys: industries, job_titles, company_size_min, company_size_max, locations, technologies, revenue_min, revenue_max
        """
        resp = await self.ai_engine.generate(prompt)
        text = resp.content.strip()
        try:
            data = json.loads(text[text.find('{'): text.rfind('}')+1]) if '{' in text else json.loads(text)
        except Exception:
            data = {}
        return ICPCriteria(
            industries=data.get('industries', []) or ["General"],
            job_titles=data.get('job_titles', []) or ["Founder"],
            company_size_min=data.get('company_size_min', 10),
            company_size_max=data.get('company_size_max', 5000),
            locations=data.get('locations', []) or ["United States"],
            technologies=data.get('technologies', []) or [],
            revenue_min=data.get('revenue_min'),
            revenue_max=data.get('revenue_max')
        )
