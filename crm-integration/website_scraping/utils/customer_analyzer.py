"""Customer analysis utilities for pattern recognition."""

import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from ai_engines.anthropic_engine import AnthropicEngine
from ..models.icp_models import CustomerProfile, CustomerPatterns

logger = logging.getLogger(__name__)


class CustomerAnalyzer:
    """Analyzes customer data to identify patterns for ICP generation."""
    
    def __init__(self, ai_engine: Optional[AnthropicEngine] = None):
        self.ai_engine = ai_engine
        self.logger = logging.getLogger(__name__)
        
        if not self.ai_engine:
            self.logger.warning("No AI engine provided - using basic analysis")
    
    async def analyze_customer_patterns(self, customers: List[CustomerProfile], business_context: str) -> CustomerPatterns:
        """Analyze patterns across customer base."""
        
        if not self.ai_engine:
            return self._basic_pattern_analysis(customers)
        
        try:
            return await self._ai_pattern_analysis(customers, business_context)
        except Exception as e:
            self.logger.error(f"AI pattern analysis failed: {e}")
            return self._basic_pattern_analysis(customers)
    
    async def _ai_pattern_analysis(self, customers: List[CustomerProfile], business_context: str) -> CustomerPatterns:
        """Use AI to identify deep patterns in customer data."""
        
        customer_data = [customer.to_dict() for customer in customers]
        
        prompt = f"""
        Analyze these existing customers to identify patterns for ICP generation:
        
        Business Context: {business_context}
        
        Customer Data:
        {json.dumps(customer_data, indent=2)}
        
        Perform deep pattern analysis to identify:
        
        1. INDUSTRY PATTERNS:
           - What industries are represented?
           - Any sub-verticals or niches?
           - Industry growth trends?
        
        2. COMPANY SIZE PATTERNS:
           - Employee count ranges
           - Revenue patterns
           - Company maturity levels
        
        3. GEOGRAPHIC PATTERNS:
           - Location concentrations
           - Market preferences
           - Regional characteristics
        
        4. TECHNOLOGY PATTERNS:
           - Common technology stacks
           - Digital maturity levels
           - Technology adoption patterns
        
        5. DECISION MAKER PATTERNS:
           - Key job titles and departments
           - Seniority levels
           - Decision-making structures
        
        6. BUSINESS CHARACTERISTICS:
           - Business models (B2B, B2C, etc.)
           - Growth stages
           - Market positions
        
        7. BEHAVIORAL PATTERNS:
           - Common pain points
           - Buying triggers and signals
           - Purchase decision factors
        
        Return structured JSON analysis:
        {{
            "industry_patterns": {{
                "primary_industries": ["Consumer Goods", "Retail"],
                "sub_verticals": ["Food & Beverage", "Fashion"],
                "industry_confidence": 0.9
            }},
            "size_patterns": {{
                "employee_range_min": 1000,
                "employee_range_max": 50000,
                "revenue_range_min": 100000000,
                "revenue_range_max": 10000000000,
                "size_confidence": 0.85
            }},
            "geographic_patterns": {{
                "primary_locations": ["United States", "Global"],
                "geographic_confidence": 0.8
            }},
            "technology_patterns": {{
                "common_technologies": ["Salesforce", "HubSpot", "Adobe"],
                "technology_confidence": 0.75
            }},
            "decision_maker_patterns": {{
                "key_titles": ["VP Marketing", "CMO", "Director Digital"],
                "departments": ["Marketing", "Digital", "Brand"],
                "seniority_levels": ["VP", "C-Suite", "Director"],
                "decision_maker_confidence": 0.9
            }},
            "business_characteristics": {{
                "business_models": ["B2C", "Consumer Brand"],
                "growth_stages": ["Established", "Large Enterprise"],
                "market_positions": ["Market Leader", "Premium Brand"]
            }},
            "pain_points": [
                "Brand management complexity",
                "Customer engagement optimization",
                "Digital transformation needs"
            ],
            "buying_signals": [
                "Marketing technology upgrades",
                "Digital transformation initiatives",
                "Customer experience improvements"
            ],
            "purchase_triggers": [
                "Competitive pressure",
                "Technology refresh cycles",
                "Growth initiatives"
            ],
            "pattern_strength": "Strong - clear patterns across customers",
            "overall_confidence": 0.85,
            "customers_analyzed": {len(customers)}
        }}
        """
        
        try:
            response = await self.ai_engine.generate(prompt)
            
            # Extract JSON from response
            response_text = response.content.strip()
            if "{" in response_text and "}" in response_text:
                start_idx = response_text.find("{")
                end_idx = response_text.rfind("}") + 1
                json_text = response_text[start_idx:end_idx]
            else:
                json_text = response_text
            
            patterns_data = json.loads(json_text)
            
            # Convert to CustomerPatterns object
            return CustomerPatterns(
                primary_industries=patterns_data["industry_patterns"]["primary_industries"],
                sub_verticals=patterns_data["industry_patterns"]["sub_verticals"],
                industry_confidence=patterns_data["industry_patterns"]["industry_confidence"],
                
                employee_range_min=patterns_data["size_patterns"]["employee_range_min"],
                employee_range_max=patterns_data["size_patterns"]["employee_range_max"],
                revenue_range_min=patterns_data["size_patterns"].get("revenue_range_min"),
                revenue_range_max=patterns_data["size_patterns"].get("revenue_range_max"),
                size_confidence=patterns_data["size_patterns"]["size_confidence"],
                
                primary_locations=patterns_data["geographic_patterns"]["primary_locations"],
                geographic_confidence=patterns_data["geographic_patterns"]["geographic_confidence"],
                
                common_technologies=patterns_data["technology_patterns"]["common_technologies"],
                technology_confidence=patterns_data["technology_patterns"]["technology_confidence"],
                
                key_titles=patterns_data["decision_maker_patterns"]["key_titles"],
                departments=patterns_data["decision_maker_patterns"]["departments"],
                seniority_levels=patterns_data["decision_maker_patterns"]["seniority_levels"],
                decision_maker_confidence=patterns_data["decision_maker_patterns"]["decision_maker_confidence"],
                
                business_models=patterns_data["business_characteristics"]["business_models"],
                growth_stages=patterns_data["business_characteristics"]["growth_stages"],
                market_positions=patterns_data["business_characteristics"]["market_positions"],
                
                pain_points=patterns_data["pain_points"],
                buying_signals=patterns_data["buying_signals"],
                purchase_triggers=patterns_data["purchase_triggers"],
                
                pattern_strength=patterns_data["pattern_strength"],
                overall_confidence=patterns_data["overall_confidence"],
                customers_analyzed=patterns_data["customers_analyzed"]
            )
            
        except Exception as e:
            self.logger.error(f"AI pattern analysis parsing failed: {e}")
            return self._basic_pattern_analysis(customers)
    
    def _basic_pattern_analysis(self, customers: List[CustomerProfile]) -> CustomerPatterns:
        """Fallback basic pattern analysis without AI."""
        
        # Extract basic patterns
        industries = list(set(c.industry for c in customers if c.industry))
        locations = list(set(c.headquarters_location for c in customers if c.headquarters_location))
        
        employee_counts = [c.employee_count for c in customers if c.employee_count and c.employee_count > 0]
        min_employees = min(employee_counts) if employee_counts else 100
        max_employees = max(employee_counts) if employee_counts else 1000
        
        # Extract technologies
        all_technologies = []
        for customer in customers:
            all_technologies.extend(customer.technologies_used)
        common_tech = list(set(all_technologies))
        
        return CustomerPatterns(
            primary_industries=industries[:3],
            sub_verticals=[],
            industry_confidence=0.6,
            
            employee_range_min=min_employees,
            employee_range_max=max_employees,
            revenue_range_min=None,
            revenue_range_max=None,
            size_confidence=0.6,
            
            primary_locations=locations[:3],
            geographic_confidence=0.6,
            
            common_technologies=common_tech[:5],
            technology_confidence=0.5,
            
            key_titles=["VP Sales", "Director Marketing"],
            departments=["Sales", "Marketing"],
            seniority_levels=["VP", "Director"],
            decision_maker_confidence=0.5,
            
            business_models=["B2B"],
            growth_stages=["Established"],
            market_positions=["Unknown"],
            
            pain_points=["General business challenges"],
            buying_signals=["Technology needs"],
            purchase_triggers=["Growth initiatives"],
            
            pattern_strength="Basic - limited AI analysis",
            overall_confidence=0.5,
            customers_analyzed=len(customers)
        )
    
    async def _ai_pattern_analysis(self, customers: List[CustomerProfile], business_context: str) -> CustomerPatterns:
        """Use AI to identify deep patterns in customer data."""
        
        customer_data = [customer.to_dict() for customer in customers]
        
        prompt = f"""
        Analyze these existing customers to identify patterns for ICP generation:
        
        Business Context: {business_context}
        
        Customer Data:
        {json.dumps(customer_data, indent=2)}
        
        Perform deep pattern analysis to identify:
        
        1. INDUSTRY PATTERNS:
           - What industries are represented?
           - Any sub-verticals or niches?
           - Industry growth trends?
        
        2. COMPANY SIZE PATTERNS:
           - Employee count ranges
           - Revenue patterns
           - Company maturity levels
        
        3. GEOGRAPHIC PATTERNS:
           - Location concentrations
           - Market preferences
           - Regional characteristics
        
        4. TECHNOLOGY PATTERNS:
           - Common technology stacks
           - Digital maturity levels
           - Technology adoption patterns
        
        5. DECISION MAKER PATTERNS:
           - Key job titles and departments
           - Seniority levels
           - Decision-making structures
        
        6. BUSINESS CHARACTERISTICS:
           - Business models (B2B, B2C, etc.)
           - Growth stages
           - Market positions
        
        7. BEHAVIORAL PATTERNS:
           - Common pain points
           - Buying triggers and signals
           - Purchase decision factors
        
        Return structured JSON analysis:
        {{
            "industry_patterns": {{
                "primary_industries": ["Consumer Goods", "Retail"],
                "sub_verticals": ["Food & Beverage", "Fashion"],
                "industry_confidence": 0.9
            }},
            "size_patterns": {{
                "employee_range_min": 1000,
                "employee_range_max": 50000,
                "revenue_range_min": 100000000,
                "revenue_range_max": 10000000000,
                "size_confidence": 0.85
            }},
            "geographic_patterns": {{
                "primary_locations": ["United States", "Global"],
                "geographic_confidence": 0.8
            }},
            "technology_patterns": {{
                "common_technologies": ["Salesforce", "HubSpot", "Adobe"],
                "technology_confidence": 0.75
            }},
            "decision_maker_patterns": {{
                "key_titles": ["VP Marketing", "CMO", "Director Digital"],
                "departments": ["Marketing", "Digital", "Brand"],
                "seniority_levels": ["VP", "C-Suite", "Director"],
                "decision_maker_confidence": 0.9
            }},
            "business_characteristics": {{
                "business_models": ["B2C", "Consumer Brand"],
                "growth_stages": ["Established", "Large Enterprise"],
                "market_positions": ["Market Leader", "Premium Brand"]
            }},
            "pain_points": [
                "Brand management complexity",
                "Customer engagement optimization",
                "Digital transformation needs"
            ],
            "buying_signals": [
                "Marketing technology upgrades",
                "Digital transformation initiatives",
                "Customer experience improvements"
            ],
            "purchase_triggers": [
                "Competitive pressure",
                "Technology refresh cycles",
                "Growth initiatives"
            ],
            "pattern_strength": "Strong - clear patterns across customers",
            "overall_confidence": 0.85,
            "customers_analyzed": {len(customers)}
        }}
        """
        
        try:
            response = await self.ai_engine.generate(prompt)
            
            # Extract JSON from response
            response_text = response.content.strip()
            if "{" in response_text and "}" in response_text:
                start_idx = response_text.find("{")
                end_idx = response_text.rfind("}") + 1
                json_text = response_text[start_idx:end_idx]
            else:
                json_text = response_text
            
            patterns_data = json.loads(json_text)
            
            # Convert to CustomerPatterns object
            return CustomerPatterns(
                primary_industries=patterns_data["industry_patterns"]["primary_industries"],
                sub_verticals=patterns_data["industry_patterns"]["sub_verticals"],
                industry_confidence=patterns_data["industry_patterns"]["industry_confidence"],
                
                employee_range_min=patterns_data["size_patterns"]["employee_range_min"],
                employee_range_max=patterns_data["size_patterns"]["employee_range_max"],
                revenue_range_min=patterns_data["size_patterns"].get("revenue_range_min"),
                revenue_range_max=patterns_data["size_patterns"].get("revenue_range_max"),
                size_confidence=patterns_data["size_patterns"]["size_confidence"],
                
                primary_locations=patterns_data["geographic_patterns"]["primary_locations"],
                geographic_confidence=patterns_data["geographic_patterns"]["geographic_confidence"],
                
                common_technologies=patterns_data["technology_patterns"]["common_technologies"],
                technology_confidence=patterns_data["technology_patterns"]["technology_confidence"],
                
                key_titles=patterns_data["decision_maker_patterns"]["key_titles"],
                departments=patterns_data["decision_maker_patterns"]["departments"],
                seniority_levels=patterns_data["decision_maker_patterns"]["seniority_levels"],
                decision_maker_confidence=patterns_data["decision_maker_patterns"]["decision_maker_confidence"],
                
                business_models=patterns_data["business_characteristics"]["business_models"],
                growth_stages=patterns_data["business_characteristics"]["growth_stages"],
                market_positions=patterns_data["business_characteristics"]["market_positions"],
                
                pain_points=patterns_data["pain_points"],
                buying_signals=patterns_data["buying_signals"],
                purchase_triggers=patterns_data["purchase_triggers"],
                
                pattern_strength=patterns_data["pattern_strength"],
                overall_confidence=patterns_data["overall_confidence"],
                customers_analyzed=patterns_data["customers_analyzed"]
            )
            
        except Exception as e:
            self.logger.error(f"AI pattern analysis parsing failed: {e}")
            return self._basic_pattern_analysis(customers)
    
    def _basic_pattern_analysis(self, customers: List[CustomerProfile]) -> CustomerPatterns:
        """Fallback basic pattern analysis without AI."""
        
        # Extract basic patterns
        industries = list(set(c.industry for c in customers if c.industry))
        locations = list(set(c.headquarters_location for c in customers if c.headquarters_location))
        
        employee_counts = [c.employee_count for c in customers if c.employee_count and c.employee_count > 0]
        min_employees = min(employee_counts) if employee_counts else 100
        max_employees = max(employee_counts) if employee_counts else 1000
        
        # Extract technologies
        all_technologies = []
        for customer in customers:
            all_technologies.extend(customer.technologies_used)
        common_tech = list(set(all_technologies))
        
        return CustomerPatterns(
            primary_industries=industries[:3],
            sub_verticals=[],
            industry_confidence=0.6,
            
            employee_range_min=min_employees,
            employee_range_max=max_employees,
            revenue_range_min=None,
            revenue_range_max=None,
            size_confidence=0.6,
            
            primary_locations=locations[:3],
            geographic_confidence=0.6,
            
            common_technologies=common_tech[:5],
            technology_confidence=0.5,
            
            key_titles=["VP Sales", "Director Marketing"],
            departments=["Sales", "Marketing"],
            seniority_levels=["VP", "Director"],
            decision_maker_confidence=0.5,
            
            business_models=["B2B"],
            growth_stages=["Established"],
            market_positions=["Unknown"],
            
            pain_points=["General business challenges"],
            buying_signals=["Technology needs"],
            purchase_triggers=["Growth initiatives"],
            
            pattern_strength="Basic - limited AI analysis",
            overall_confidence=0.5,
            customers_analyzed=len(customers)
        )
