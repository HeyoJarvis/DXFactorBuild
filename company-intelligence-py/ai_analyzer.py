"""
AI Content Analyzer - Extract structured company intelligence from scraped content.

This analyzer uses AI (Anthropic Claude) to analyze scraped website content and 
extract comprehensive company intelligence including:
- Organization context for CRM tool recommendations
- Workflow intelligence for bottleneck identification  
- Technology stack for integration planning
- Process maturity for implementation planning
- Market intelligence for competitive analysis

The analyzer uses conservative, structured prompts to ensure accuracy and 
avoid hallucination.
"""

import json
import logging
import time
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import asdict

try:
    from anthropic import Anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    logging.warning("Anthropic library not available. AI analysis will be limited.")

from models import (
    CompanyIntelligence, OrganizationContext, WorkflowIntelligence, 
    TechnologyStack, ProcessMaturity, MarketIntelligence, ContentAnalysis,
    CompanySize, TechSophistication, SalesComplexity, ScrapingMetadata
)


class AIContentAnalyzer:
    """
    AI-powered analyzer that extracts structured company intelligence from scraped content.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the AI analyzer with configuration."""
        self.config = config or {}
        
        # AI configuration
        self.api_key = self.config.get('anthropic_api_key') or self.config.get('ANTHROPIC_API_KEY')
        self.model = self.config.get('model', 'claude-3-5-sonnet-20241022')
        self.temperature = self.config.get('temperature', 0.1)  # Low temperature for consistency
        self.max_tokens = self.config.get('max_tokens', 4000)
        
        # Initialize AI client
        self.ai_client = None
        if ANTHROPIC_AVAILABLE and self.api_key:
            self.ai_client = Anthropic(api_key=self.api_key)
        
        # Setup logging
        self.logger = logging.getLogger(__name__)
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
    
    async def analyze_company_content(
        self, 
        scraped_data: Dict[str, Any], 
        scraping_metadata: ScrapingMetadata
    ) -> CompanyIntelligence:
        """
        Main analysis method that converts scraped data into structured company intelligence.
        
        Args:
            scraped_data: Raw data from smart scraper
            scraping_metadata: Metadata about the scraping process
            
        Returns:
            CompanyIntelligence object with all extracted information
        """
        start_time = time.time()
        url = scraped_data.get('url', 'unknown')
        
        self.logger.info(f"Starting AI analysis for: {url}")
        
        if not self.ai_client:
            self.logger.warning("No AI client available. Using fallback analysis.")
            return self._create_fallback_intelligence(scraped_data, scraping_metadata)
        
        try:
            # Prepare content for AI analysis
            analysis_content = self._prepare_content_for_analysis(scraped_data)
            
            # Run AI analysis in parallel for different aspects
            self.logger.info("Running AI analysis for organization context...")
            org_context = await self._analyze_organization_context(analysis_content, url)
            
            self.logger.info("Running AI analysis for workflow intelligence...")
            workflow_intel = await self._analyze_workflow_intelligence(analysis_content)
            
            self.logger.info("Running AI analysis for technology stack...")
            tech_stack = await self._analyze_technology_stack(analysis_content, scraped_data.get('technology_stack', []))
            
            self.logger.info("Running AI analysis for process maturity...")
            process_maturity = await self._analyze_process_maturity(analysis_content)
            
            self.logger.info("Running AI analysis for market intelligence...")
            market_intel = await self._analyze_market_intelligence(analysis_content)
            
            self.logger.info("Running AI analysis for content analysis...")
            content_analysis = await self._analyze_content_quality(analysis_content, scraped_data)
            
            # Calculate confidence scores
            confidence_scores = self._calculate_confidence_scores({
                'organization_context': org_context,
                'workflow_intelligence': workflow_intel,
                'technology_stack': tech_stack,
                'process_maturity': process_maturity,
                'market_intelligence': market_intel,
                'content_analysis': content_analysis
            })
            
            # Update scraping metadata with AI analysis info
            scraping_metadata.ai_model_used = self.model
            scraping_metadata.analysis_duration_seconds = time.time() - start_time
            scraping_metadata.total_processing_time = scraping_metadata.scraping_duration_seconds + scraping_metadata.analysis_duration_seconds
            scraping_metadata.confidence_scores = confidence_scores
            scraping_metadata.analyzed_at = time.time()
            
            # Create comprehensive company intelligence
            company_intelligence = CompanyIntelligence(
                company_name=org_context.company_name,
                website_url=url,
                description=scraped_data.get('meta_data', {}).get('description'),
                organization_context=org_context,
                workflow_intelligence=workflow_intel,
                technology_stack=tech_stack,
                process_maturity=process_maturity,
                market_intelligence=market_intel,
                content_analysis=content_analysis,
                scraping_metadata=scraping_metadata
            )
            
            self.logger.info(f"AI analysis completed in {scraping_metadata.analysis_duration_seconds:.2f}s")
            self.logger.info(f"Overall confidence score: {company_intelligence.get_confidence_score():.2f}")
            
            return company_intelligence
            
        except Exception as e:
            self.logger.error(f"AI analysis failed: {e}")
            scraping_metadata.errors_encountered.append(f"ai_analysis: {str(e)}")
            return self._create_fallback_intelligence(scraped_data, scraping_metadata)
    
    def _prepare_content_for_analysis(self, scraped_data: Dict[str, Any]) -> str:
        """Prepare scraped content for AI analysis by combining relevant sections."""
        content_parts = []
        
        # Add meta data
        meta_data = scraped_data.get('meta_data', {})
        if meta_data.get('title'):
            content_parts.append(f"TITLE: {meta_data['title']}")
        if meta_data.get('description'):
            content_parts.append(f"DESCRIPTION: {meta_data['description']}")
        
        # Add structured content sections
        content_sections = scraped_data.get('content_sections', {})
        for section_name, section_content in content_sections.items():
            if section_content and len(section_content.strip()) > 20:
                content_parts.append(f"{section_name.upper()}: {section_content[:1000]}")  # Limit section length
        
        # Add main text content (limited)
        html_text = scraped_data.get('html_text', '')
        if html_text:
            content_parts.append(f"MAIN_CONTENT: {html_text[:5000]}")  # First 5K characters
        
        # Add navigation structure
        nav_structure = scraped_data.get('navigation_structure', [])
        if nav_structure:
            content_parts.append(f"NAVIGATION: {', '.join(nav_structure[:20])}")  # First 20 nav items
        
        return '\n\n'.join(content_parts)
    
    async def _analyze_organization_context(self, content: str, url: str) -> OrganizationContext:
        """Analyze content to extract organization context for CRM recommendations."""
        
        prompt = f"""
        Analyze this website content to extract organization context for CRM tool recommendations.
        
        CRITICAL INSTRUCTIONS:
        - Only provide information you are absolutely certain about from the content
        - Use "Unknown" for any uncertain information
        - Be extremely conservative with estimates
        - Do NOT make assumptions or educated guesses
        
        Website URL: {url}
        
        Content:
        {content}
        
        Extract the following information in JSON format:
        {{
            "company_name": "exact company name from content",
            "industry": "primary industry (Technology, Healthcare, Finance, etc.) or Unknown",
            "sub_industry": "specific sub-industry or null",
            "target_market": "who they serve (SMB, Enterprise, etc.) or null",
            "company_size": "startup|smb|mid_market|enterprise based on clear indicators",
            "employee_count_estimate": number_or_null,
            "sales_team_size": number_or_null,
            "avg_deal_size": number_or_null,
            "budget_range": "budget range string or null",
            "revenue_stage": "Early|Growth|Mature or null",
            "tech_sophistication": "low|medium|high based on content",
            "business_model": "B2B SaaS|B2C|Marketplace|Services|etc or null",
            "sales_complexity": "transactional|consultative|enterprise",
            "crm_system": "specific CRM mentioned or null",
            "confidence_note": "explanation of confidence level"
        }}
        
        Only return the JSON object. Be conservative and accurate.
        """
        
        try:
            response = await self._call_ai(prompt)
            data = self._parse_json_response(response)
            
            # Create OrganizationContext with validation
            return OrganizationContext(
                organization_id=self._generate_org_id(url),
                company_name=data.get('company_name', 'Unknown Company'),
                industry=data.get('industry', 'Unknown'),
                sub_industry=data.get('sub_industry'),
                target_market=data.get('target_market'),
                company_size=self._parse_company_size(data.get('company_size', 'smb')),
                employee_count_estimate=data.get('employee_count_estimate'),
                sales_team_size=data.get('sales_team_size'),
                avg_deal_size=data.get('avg_deal_size'),
                budget_range=data.get('budget_range'),
                revenue_stage=data.get('revenue_stage'),
                tech_sophistication=self._parse_tech_sophistication(data.get('tech_sophistication', 'medium')),
                business_model=data.get('business_model'),
                sales_complexity=self._parse_sales_complexity(data.get('sales_complexity', 'consultative')),
                crm_system=data.get('crm_system')
            )
            
        except Exception as e:
            self.logger.error(f"Organization context analysis failed: {e}")
            return self._create_fallback_org_context(url)
    
    async def _analyze_workflow_intelligence(self, content: str) -> WorkflowIntelligence:
        """Analyze content to extract workflow intelligence for bottleneck identification."""
        
        prompt = f"""
        Analyze this website content to identify workflow and process intelligence.
        
        CRITICAL INSTRUCTIONS:
        - Only extract information clearly evident from the content
        - Focus on process bottlenecks and automation opportunities
        - Be conservative and accurate
        
        Content:
        {content}
        
        Extract workflow intelligence in JSON format:
        {{
            "sales_process_complexity": "transactional|consultative|enterprise",
            "sales_cycle_length_estimate": days_or_null,
            "lead_qualification_process": "automated|manual|hybrid or null",
            "manual_process_mentions": ["list of manual processes mentioned"],
            "automation_gaps": ["areas lacking automation"],
            "coordination_challenges": ["team handoff issues mentioned"],
            "scheduling_complexity": "simple|medium|complex or null",
            "document_process_maturity": "basic|medium|advanced or null",
            "integration_needs": ["integration needs mentioned"],
            "team_coordination_mentions": ["coordination challenges"],
            "remote_work_indicators": ["remote work mentions"],
            "meeting_management_issues": ["meeting/scheduling issues"]
        }}
        
        Only return the JSON object.
        """
        
        try:
            response = await self._call_ai(prompt)
            data = self._parse_json_response(response)
            
            return WorkflowIntelligence(
                sales_process_complexity=self._parse_sales_complexity(data.get('sales_process_complexity', 'consultative')),
                sales_cycle_length_estimate=data.get('sales_cycle_length_estimate'),
                lead_qualification_process=data.get('lead_qualification_process'),
                manual_process_mentions=data.get('manual_process_mentions', []),
                automation_gaps=data.get('automation_gaps', []),
                coordination_challenges=data.get('coordination_challenges', []),
                scheduling_complexity=data.get('scheduling_complexity'),
                document_process_maturity=data.get('document_process_maturity'),
                integration_needs=data.get('integration_needs', []),
                team_coordination_mentions=data.get('team_coordination_mentions', []),
                remote_work_indicators=data.get('remote_work_indicators', []),
                meeting_management_issues=data.get('meeting_management_issues', [])
            )
            
        except Exception as e:
            self.logger.error(f"Workflow intelligence analysis failed: {e}")
            return WorkflowIntelligence()
    
    async def _analyze_technology_stack(self, content: str, detected_technologies: List[str]) -> TechnologyStack:
        """Analyze content and detected technologies to build technology stack profile.

        Ultra-conservative approach: only report technologies explicitly mentioned in
        the content or detected by the scraper. Never guess.
        """

        safe_content = (content or "")[:3000]
        detected_str = ', '.join(detected_technologies) if detected_technologies else 'None detected by scraper'

        prompt = f"""
        CRITICAL ANTI-HALLUCINATION INSTRUCTIONS:
        - ONLY extract technologies that are EXPLICITLY mentioned in the content below
        - DO NOT guess or infer technologies based on industry/company type
        - When uncertain, use null
        - Prioritize technologies from the "Already Detected" list

        Content:
        {safe_content}

        Already Detected by Scraper (VERIFIED):
        {detected_str}

        Extract ONLY explicitly mentioned technologies in JSON format:
        {{
            "crm_system": "ONLY if explicitly mentioned or null",
            "marketing_automation": "ONLY if explicitly mentioned or null",
            "email_platform": "ONLY if explicitly mentioned or null",
            "communication_tools": ["ONLY explicitly mentioned tools"],
            "video_conferencing": ["ONLY explicitly mentioned tools"],
            "project_management": ["ONLY explicitly mentioned tools"],
            "scheduling_tools": ["ONLY explicitly mentioned tools"],
            "document_tools": ["ONLY explicitly mentioned tools"],
            "automation_tools": ["ONLY explicitly mentioned tools"],
            "analytics_tools": ["ONLY explicitly mentioned tools"],
            "api_sophistication": "low|medium|high ONLY if clear integration mentions exist, else medium",
            "integration_mentions": ["ONLY explicitly mentioned integrations"],
            "webhook_usage": false,
            "website_platform": "ONLY if explicitly mentioned or null",
            "cms_system": "ONLY if explicitly mentioned or null",
            "ecommerce_platform": "ONLY if explicitly mentioned or null"
        }}

        Only return the JSON object. If a field is not clearly supported, use null.
        """

        try:
            response = await self._call_ai(prompt)
            ai_data = self._parse_json_response(response)

            # Verify AI claims and reject anything not supported by content or detection
            verified = self._verify_technology_claims(
                ai_data=ai_data or {},
                detected_technologies=detected_technologies or [],
                content=safe_content or ""
            )

            return TechnologyStack(
                crm_system=verified.get('crm_system'),
                marketing_automation=verified.get('marketing_automation'),
                email_platform=verified.get('email_platform'),
                communication_tools=verified.get('communication_tools', []),
                video_conferencing=verified.get('video_conferencing', []),
                project_management=verified.get('project_management', []),
                scheduling_tools=verified.get('scheduling_tools', []),
                document_tools=verified.get('document_tools', []),
                automation_tools=verified.get('automation_tools', []),
                analytics_tools=verified.get('analytics_tools', []),
                api_sophistication=self._parse_tech_sophistication(verified.get('api_sophistication', 'medium')),
                integration_mentions=verified.get('integration_mentions', []),
                webhook_usage=verified.get('webhook_usage', False),
                website_platform=verified.get('website_platform'),
                cms_system=verified.get('cms_system'),
                ecommerce_platform=verified.get('ecommerce_platform')
            )

        except Exception as e:
            self.logger.error(f"Technology stack analysis failed: {e}")
            # Fallback: Use only technologies detected by the scraper
            return self._create_fallback_tech_stack(detected_technologies or [])
    
    async def _analyze_process_maturity(self, content: str) -> ProcessMaturity:
        """Analyze content to assess process maturity for implementation planning."""
        
        prompt = f"""
        Analyze this content to assess the company's process maturity and change management capability.
        
        Content:
        {content}
        
        Assess process maturity in JSON format:
        {{
            "process_sophistication": "basic|medium|advanced",
            "documentation_quality": "poor|medium|excellent",
            "automation_level": "low|medium|high",
            "sales_process_documented": true_or_false,
            "onboarding_process_defined": true_or_false,
            "support_process_structured": true_or_false,
            "change_management_capability": "low|medium|high",
            "training_infrastructure": "basic|medium|advanced",
            "process_optimization_culture": true_or_false
        }}
        
        Only return the JSON object.
        """
        
        try:
            response = await self._call_ai(prompt)
            data = self._parse_json_response(response)
            
            return ProcessMaturity(
                process_sophistication=data.get('process_sophistication', 'medium'),
                documentation_quality=data.get('documentation_quality', 'medium'),
                automation_level=data.get('automation_level', 'medium'),
                sales_process_documented=data.get('sales_process_documented', False),
                onboarding_process_defined=data.get('onboarding_process_defined', False),
                support_process_structured=data.get('support_process_structured', False),
                change_management_capability=data.get('change_management_capability', 'medium'),
                training_infrastructure=data.get('training_infrastructure', 'medium'),
                process_optimization_culture=data.get('process_optimization_culture', False)
            )
            
        except Exception as e:
            self.logger.error(f"Process maturity analysis failed: {e}")
            return ProcessMaturity()
    
    async def _analyze_market_intelligence(self, content: str) -> MarketIntelligence:
        """Analyze content to extract market and competitive intelligence."""
        
        prompt = f"""
        Analyze this content to extract market intelligence and competitive positioning.
        
        Content:
        {content}
        
        Extract market intelligence in JSON format:
        {{
            "market_position": "Leader|Challenger|Niche or null",
            "competitive_advantages": ["advantages mentioned"],
            "key_differentiators": ["differentiators mentioned"],
            "ideal_customer_segments": ["customer segments they serve"],
            "customer_pain_points": ["pain points they address"],
            "value_propositions": ["value props mentioned"],
            "growth_stage": "startup|growth|mature or null",
            "funding_indicators": ["funding mentions"],
            "expansion_signals": ["growth/expansion mentions"]
        }}
        
        Only return the JSON object.
        """
        
        try:
            response = await self._call_ai(prompt)
            data = self._parse_json_response(response)
            
            return MarketIntelligence(
                market_position=data.get('market_position'),
                competitive_advantages=data.get('competitive_advantages', []),
                key_differentiators=data.get('key_differentiators', []),
                ideal_customer_segments=data.get('ideal_customer_segments', []),
                customer_pain_points=data.get('customer_pain_points', []),
                value_propositions=data.get('value_propositions', []),
                growth_stage=data.get('growth_stage'),
                funding_indicators=data.get('funding_indicators', []),
                expansion_signals=data.get('expansion_signals', [])
            )
            
        except Exception as e:
            self.logger.error(f"Market intelligence analysis failed: {e}")
            return MarketIntelligence()
    
    async def _analyze_content_quality(self, content: str, scraped_data: Dict[str, Any]) -> ContentAnalysis:
        """Analyze content quality and themes."""
        
        # Basic content analysis without AI for now
        content_sections = scraped_data.get('content_sections', {})
        nav_structure = scraped_data.get('navigation_structure', [])
        
        return ContentAnalysis(
            content_depth="medium" if len(content) > 5000 else "shallow",
            content_freshness="medium",  # Would need date analysis
            seo_optimization="medium",   # Would need SEO analysis
            primary_themes=[],           # Could extract with AI
            messaging_focus=[],          # Could extract with AI
            brand_personality=None,      # Could extract with AI
            page_count_estimate=len(nav_structure) if nav_structure else None,
            blog_activity_level="medium",
            case_study_presence='case' in content.lower() or 'study' in content.lower(),
            testimonial_presence='testimonial' in content.lower() or 'review' in content.lower()
        )
    
    async def _call_ai(self, prompt: str) -> str:
        """Make AI API call with error handling."""
        if not self.ai_client:
            raise Exception("AI client not available")
        
        try:
            message = self.ai_client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            return message.content[0].text if message.content else ""
            
        except Exception as e:
            self.logger.error(f"AI API call failed: {e}")
            raise
    
    def _parse_json_response(self, response: str) -> Dict[str, Any]:
        """Parse JSON response from AI with error handling."""
        try:
            # Find JSON in response
            response = response.strip()
            if response.startswith('```json'):
                response = response[7:]
            if response.endswith('```'):
                response = response[:-3]
            
            # Find JSON object
            start = response.find('{')
            end = response.rfind('}') + 1
            
            if start >= 0 and end > start:
                json_str = response[start:end]
                return json.loads(json_str)
            else:
                return json.loads(response)
                
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to parse JSON response: {e}")
            self.logger.debug(f"Response was: {response}")
            return {}
        except Exception as e:
            self.logger.error(f"Error parsing AI response: {e}")
            return {}
    
    def _parse_company_size(self, size_str: str) -> CompanySize:
        """Parse company size string to enum."""
        size_str = size_str.lower() if size_str else 'smb'
        if size_str in ['startup', 'early']:
            return CompanySize.STARTUP
        elif size_str in ['smb', 'small']:
            return CompanySize.SMB
        elif size_str in ['mid_market', 'medium', 'mid-market']:
            return CompanySize.MID_MARKET
        elif size_str in ['enterprise', 'large']:
            return CompanySize.ENTERPRISE
        else:
            return CompanySize.SMB
    
    def _parse_tech_sophistication(self, tech_str: str) -> TechSophistication:
        """Parse tech sophistication string to enum."""
        tech_str = tech_str.lower() if tech_str else 'medium'
        if tech_str in ['low', 'basic']:
            return TechSophistication.LOW
        elif tech_str in ['high', 'advanced']:
            return TechSophistication.HIGH
        else:
            return TechSophistication.MEDIUM
    
    def _parse_sales_complexity(self, complexity_str: str) -> SalesComplexity:
        """Parse sales complexity string to enum."""
        complexity_str = complexity_str.lower() if complexity_str else 'consultative'
        if complexity_str in ['transactional', 'simple']:
            return SalesComplexity.TRANSACTIONAL
        elif complexity_str in ['enterprise', 'complex']:
            return SalesComplexity.ENTERPRISE
        else:
            return SalesComplexity.CONSULTATIVE
    
    def _generate_org_id(self, url: str) -> str:
        """
        Generate unique organization ID from URL.
        
        This ensures each website gets a unique ID regardless of company name conflicts.
        Examples:
        - https://apple.com → apple_com
        - https://www.apple-records.com → apple-records_com
        - https://apple.music.com → apple_music_com
        """
        from urllib.parse import urlparse
        import re
        
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        
        # Remove www. prefix
        if domain.startswith('www.'):
            domain = domain[4:]
        
        # Replace dots with underscores and clean up special characters
        org_id = domain.replace('.', '_')
        org_id = re.sub(r'[^a-z0-9_-]', '_', org_id)
        org_id = re.sub(r'_+', '_', org_id)  # Remove multiple underscores
        org_id = org_id.strip('_')  # Remove leading/trailing underscores
        
        return org_id
    
    def _verify_technology_claims(self, ai_data: Dict[str, Any], detected_technologies: List[str], content: str) -> Dict[str, Any]:
        """Verify AI-claimed technologies against detected tech and content to prevent hallucinations."""
        content_lower = (content or "").lower()
        detected_lower = {t.lower(): t for t in (detected_technologies or [])}

        verified: Dict[str, Any] = dict(ai_data or {})

        # Major single-value claims to verify
        for field in ['crm_system', 'marketing_automation', 'ecommerce_platform', 'website_platform', 'cms_system']:
            value = verified.get(field)
            if not value:
                continue
            value_str = str(value)
            value_lower = value_str.lower()

            in_detected = value_lower in detected_lower
            in_content = value_lower in content_lower

            if in_detected or in_content:
                # Normalize to detected casing if available
                if in_detected:
                    verified[field] = detected_lower[value_lower]
                continue

            self.logger.warning(f"Rejecting unverified technology claim: {field}='{value_str}'")
            verified[field] = None

        # List-based fields - keep only items that are verified
        list_fields = [
            'communication_tools', 'video_conferencing', 'project_management',
            'scheduling_tools', 'document_tools', 'automation_tools', 'analytics_tools',
            'integration_mentions'
        ]
        for field in list_fields:
            items = verified.get(field) or []
            if not isinstance(items, list):
                verified[field] = []
                continue
            cleaned: List[str] = []
            for item in items:
                item_str = str(item)
                item_lower = item_str.lower()
                if item_lower in detected_lower or item_lower in content_lower:
                    cleaned.append(detected_lower.get(item_lower, item_str))
            verified[field] = cleaned

        # webhook_usage only true if mentioned
        webhook_flag = str(verified.get('webhook_usage', '')).lower() == 'true'
        verified['webhook_usage'] = webhook_flag and ('webhook' in content_lower)

        # api_sophistication default to 'medium' unless explicit mentions of API docs/integrations
        api_level = str(verified.get('api_sophistication', 'medium')).lower()
        if not any(k in content_lower for k in ['api', 'integration', 'sdk', 'webhook']):
            api_level = 'medium'
        verified['api_sophistication'] = api_level

        return verified

    def _create_fallback_tech_stack(self, detected_technologies: List[str]) -> TechnologyStack:
        """Create a TechnologyStack using only scraper-detected technologies (no AI claims)."""
        detected_lower = {t.lower(): t for t in (detected_technologies or [])}
        stack = TechnologyStack()

        def present(name: str) -> bool:
            return name in detected_lower

        # Map well-known technologies
        if present('hubspot'):
            stack.crm_system = detected_lower['hubspot']
        if present('salesforce'):
            stack.crm_system = detected_lower['salesforce']
        if present('pipedrive'):
            stack.crm_system = detected_lower['pipedrive']
        if present('google analytics'):
            stack.analytics_tools.append(detected_lower['google analytics'])
        if present('mixpanel'):
            stack.analytics_tools.append(detected_lower['mixpanel'])
        if present('segment'):
            stack.analytics_tools.append(detected_lower['segment'])
        if present('calendly'):
            stack.scheduling_tools.append(detected_lower['calendly'])
        if present('pandadoc'):
            stack.document_tools.append(detected_lower['pandadoc'])
        if present('docusign'):
            stack.document_tools.append(detected_lower['docusign'])
        if present('zapier'):
            stack.automation_tools.append(detected_lower['zapier'])
        if present('slack'):
            stack.communication_tools.append(detected_lower['slack'])

        return stack
    
    def _calculate_confidence_scores(self, analysis_results: Dict[str, Any]) -> Dict[str, float]:
        """Calculate confidence scores for different analysis aspects."""
        # Simple confidence scoring based on data completeness
        scores = {}
        
        # Organization context confidence
        org_context = analysis_results.get('organization_context')
        if org_context:
            filled_fields = sum(1 for field in ['industry', 'company_size', 'business_model', 'tech_sophistication'] 
                              if getattr(org_context, field, None) not in [None, 'Unknown'])
            scores['organization_context'] = min(0.9, filled_fields / 4.0 + 0.3)
        
        # Default confidence scores for other aspects
        scores['workflow_intelligence'] = 0.7
        scores['technology_stack'] = 0.8
        scores['process_maturity'] = 0.6
        scores['market_intelligence'] = 0.6
        scores['content_analysis'] = 0.7
        
        return scores
    
    def _create_fallback_intelligence(self, scraped_data: Dict[str, Any], scraping_metadata: ScrapingMetadata) -> CompanyIntelligence:
        """Create fallback intelligence when AI analysis fails."""
        url = scraped_data.get('url', 'unknown')
        
        # Extract basic info from scraped data
        meta_data = scraped_data.get('meta_data', {})
        company_name = meta_data.get('title', 'Unknown Company')
        if ' - ' in company_name:
            company_name = company_name.split(' - ')[0]
        
        # Create basic organization context
        org_context = OrganizationContext(
            organization_id=self._generate_org_id(url),
            company_name=company_name,
            industry='Unknown',
            company_size=CompanySize.SMB,
            tech_sophistication=TechSophistication.MEDIUM,
            sales_complexity=SalesComplexity.CONSULTATIVE
        )
        
        # Create basic technology stack from detected technologies
        detected_tech = scraped_data.get('technology_stack', [])
        tech_stack = TechnologyStack()
        
        # Map detected technologies to appropriate categories
        for tech in detected_tech:
            tech_lower = tech.lower()
            if 'hubspot' in tech_lower or 'salesforce' in tech_lower:
                tech_stack.crm_system = tech
            elif 'calendly' in tech_lower:
                tech_stack.scheduling_tools.append(tech)
            elif 'pandadoc' in tech_lower or 'docusign' in tech_lower:
                tech_stack.document_tools.append(tech)
            elif 'zapier' in tech_lower:
                tech_stack.automation_tools.append(tech)
        
        return CompanyIntelligence(
            company_name=company_name,
            website_url=url,
            description=meta_data.get('description'),
            organization_context=org_context,
            workflow_intelligence=WorkflowIntelligence(),
            technology_stack=tech_stack,
            process_maturity=ProcessMaturity(),
            market_intelligence=MarketIntelligence(),
            content_analysis=ContentAnalysis(),
            scraping_metadata=scraping_metadata
        )
    
    def _create_fallback_org_context(self, url: str) -> OrganizationContext:
        """Create fallback organization context."""
        return OrganizationContext(
            organization_id=self._generate_org_id(url),
            company_name='Unknown Company',
            industry='Unknown',
            company_size=CompanySize.SMB,
            tech_sophistication=TechSophistication.MEDIUM,
            sales_complexity=SalesComplexity.CONSULTATIVE
        )
