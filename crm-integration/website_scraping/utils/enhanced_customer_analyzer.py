"""Enhanced Customer Analysis for Better ICP Generation."""

import json
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime

from ai_engines.anthropic_engine import AnthropicEngine
from ..models.icp_models import CustomerProfile, CustomerPatterns

logger = logging.getLogger(__name__)


class EnhancedCustomerAnalyzer:
    """Enhanced analyzer that focuses on business value and actionable insights."""
    
    def __init__(self, ai_engine: Optional[AnthropicEngine] = None):
        self.ai_engine = ai_engine
        self.logger = logging.getLogger(__name__)
        
        if not self.ai_engine:
            self.logger.warning("No AI engine provided - using basic analysis")
    
    async def analyze_customer_patterns(self, customers: List[CustomerProfile], business_context: str) -> CustomerPatterns:
        """Analyze patterns with focus on business value and actionable insights."""
        
        if not self.ai_engine:
            return self._basic_pattern_analysis(customers)
        
        try:
            return await self._enhanced_ai_analysis(customers, business_context)
        except Exception as e:
            self.logger.error(f"Enhanced AI pattern analysis failed: {e}")
            return self._basic_pattern_analysis(customers)
    
    async def _enhanced_ai_analysis(self, customers: List[CustomerProfile], business_context: str) -> CustomerPatterns:
        """Enhanced AI analysis focusing on business value and actionable insights."""
        
        # Segment customers by value/success
        high_value_customers = []
        medium_value_customers = []
        low_value_customers = []
        
        for customer in customers:
            # Calculate value score based on multiple factors
            value_score = self._calculate_customer_value_score(customer)
            
            if value_score >= 0.7:
                high_value_customers.append(customer)
            elif value_score >= 0.4:
                medium_value_customers.append(customer)
            else:
                low_value_customers.append(customer)
        
        # Focus analysis on high-value customers
        primary_customers = high_value_customers if high_value_customers else customers[:10]  # Top 10 if no high-value
        
        self.logger.info(f"Analyzing {len(primary_customers)} high-value customers out of {len(customers)} total")
        
        prompt = f"""
You are a business intelligence analyst creating an Ideal Customer Profile (ICP) for a company.
Your goal is to identify the characteristics of customers who are most likely to buy and be successful.

BUSINESS CONTEXT: {business_context}

HIGH-VALUE CUSTOMER DATA (Focus your analysis on these):
{json.dumps([self._customer_summary(c) for c in primary_customers], indent=2)}

TOTAL CUSTOMER BASE: {len(customers)} companies
HIGH-VALUE CUSTOMERS: {len(high_value_customers)}
MEDIUM-VALUE CUSTOMERS: {len(medium_value_customers)}

ANALYSIS INSTRUCTIONS:
1. Focus on HIGH-VALUE customers - these are your best customers who buy and succeed
2. Look for specific, actionable patterns that can be used for targeting
3. Identify business problems and outcomes, not just demographics
4. Consider what makes these customers different from non-buyers

Analyze and return JSON in this exact format:
{{
    "industry_patterns": {{
        "primary_industries": ["Specific Industry 1", "Specific Industry 2"],
        "sub_verticals": ["Specific Sub-vertical 1", "Specific Sub-vertical 2"],
        "industry_confidence": 0.8
    }},
    "size_patterns": {{
        "employee_range_min": 50,
        "employee_range_max": 500,
        "revenue_range_min": 10000000,
        "revenue_range_max": 100000000,
        "size_confidence": 0.7
    }},
    "geographic_patterns": {{
        "primary_locations": ["Location 1", "Location 2"],
        "geographic_confidence": 0.6
    }},
    "technology_patterns": {{
        "common_technologies": ["Tech 1", "Tech 2"],
        "technology_confidence": 0.5
    }},
    "decision_maker_patterns": {{
        "key_titles": ["Title 1", "Title 2"],
        "departments": ["Department 1", "Department 2"],
        "seniority_levels": ["Senior", "Executive"],
        "decision_maker_confidence": 0.8
    }},
    "business_characteristics": {{
        "business_models": ["B2B", "SaaS"],
        "growth_stages": ["Growth", "Expansion"],
        "market_positions": ["Market Leader", "Challenger"]
    }},
    "pain_points": [
        "Specific business problem 1",
        "Specific business problem 2",
        "Specific business problem 3"
    ],
    "buying_signals": [
        "Specific trigger 1",
        "Specific trigger 2", 
        "Specific trigger 3"
    ],
    "purchase_triggers": [
        "Event that drives purchase 1",
        "Event that drives purchase 2"
    ],
    "pattern_strength": "Strong",
    "overall_confidence": 0.8,
    "customers_analyzed": {len(customers)}
}}

Focus on ACTIONABLE insights that can be used for lead generation and sales targeting.
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
            
            # Helper function to safely get nested values
            def safe_get(data, *keys, default=None):
                try:
                    for key in keys:
                        data = data[key]
                    return data
                except (KeyError, TypeError):
                    return default
            
            # Convert to CustomerPatterns object with safe extraction
            return CustomerPatterns(
                primary_industries=safe_get(patterns_data, "industry_patterns", "primary_industries", default=[]),
                sub_verticals=safe_get(patterns_data, "industry_patterns", "sub_verticals", default=[]),
                industry_confidence=safe_get(patterns_data, "industry_patterns", "industry_confidence", default=0.5),
                
                employee_range_min=safe_get(patterns_data, "size_patterns", "employee_range_min", default=1),
                employee_range_max=safe_get(patterns_data, "size_patterns", "employee_range_max", default=1000),
                revenue_range_min=safe_get(patterns_data, "size_patterns", "revenue_range_min"),
                revenue_range_max=safe_get(patterns_data, "size_patterns", "revenue_range_max"),
                size_confidence=safe_get(patterns_data, "size_patterns", "size_confidence", default=0.5),
                
                primary_locations=safe_get(patterns_data, "geographic_patterns", "primary_locations", default=[]),
                geographic_confidence=safe_get(patterns_data, "geographic_patterns", "geographic_confidence", default=0.5),
                
                common_technologies=safe_get(patterns_data, "technology_patterns", "common_technologies", default=[]),
                technology_confidence=safe_get(patterns_data, "technology_patterns", "technology_confidence", default=0.5),
                
                key_titles=safe_get(patterns_data, "decision_maker_patterns", "key_titles", default=[]),
                departments=safe_get(patterns_data, "decision_maker_patterns", "departments", default=[]),
                seniority_levels=safe_get(patterns_data, "decision_maker_patterns", "seniority_levels", default=[]),
                decision_maker_confidence=safe_get(patterns_data, "decision_maker_patterns", "decision_maker_confidence", default=0.5),
                
                business_models=safe_get(patterns_data, "business_characteristics", "business_models", default=[]),
                growth_stages=safe_get(patterns_data, "business_characteristics", "growth_stages", default=[]),
                market_positions=safe_get(patterns_data, "business_characteristics", "market_positions", default=[]),
                
                pain_points=safe_get(patterns_data, "pain_points", default=[]),
                buying_signals=safe_get(patterns_data, "buying_signals", default=[]),
                purchase_triggers=safe_get(patterns_data, "purchase_triggers", default=[]),
                
                pattern_strength=safe_get(patterns_data, "pattern_strength", default="Medium"),
                overall_confidence=safe_get(patterns_data, "overall_confidence", default=0.6),
                customers_analyzed=safe_get(patterns_data, "customers_analyzed", default=len(customers))
            )
            
        except Exception as e:
            self.logger.error(f"Enhanced AI pattern analysis parsing failed: {e}")
            return self._basic_pattern_analysis(customers)
    
    def _calculate_customer_value_score(self, customer: CustomerProfile) -> float:
        """Calculate a value score for a customer based on multiple factors."""
        score = 0.0
        
        # Engagement score (40% weight)
        score += customer.engagement_score * 0.4
        
        # Deal history (30% weight)
        if customer.deal_history:
            deal_score = min(len(customer.deal_history) / 5.0, 1.0)  # Normalize to max 5 deals
            score += deal_score * 0.3
        
        # Company size (15% weight) - prefer mid-market
        if 100 <= customer.employee_count <= 1000:
            score += 0.15
        elif customer.employee_count > 0:
            score += 0.05
        
        # Revenue (15% weight)
        if customer.annual_revenue and customer.annual_revenue > 1000000:  # $1M+
            revenue_score = min(customer.annual_revenue / 100000000, 1.0)  # Normalize to $100M
            score += revenue_score * 0.15
        
        return min(score, 1.0)
    
    def _customer_summary(self, customer: CustomerProfile) -> Dict[str, Any]:
        """Create a concise summary of customer for AI analysis."""
        return {
            "company_name": customer.company_name,
            "industry": customer.industry,
            "employee_count": customer.employee_count,
            "annual_revenue": customer.annual_revenue,
            "location": customer.headquarters_location,
            "business_model": customer.business_model,
            "growth_stage": customer.growth_stage.value if hasattr(customer.growth_stage, 'value') else str(customer.growth_stage),
            "key_contacts": [c.get('title', '') for c in customer.key_contacts] if customer.key_contacts else [],
            "decision_maker_titles": customer.decision_maker_titles,
            "technologies_used": customer.technologies_used,
            "engagement_score": customer.engagement_score,
            "deal_count": len(customer.deal_history) if customer.deal_history else 0,
            "value_score": self._calculate_customer_value_score(customer)
        }
    
    def _basic_pattern_analysis(self, customers: List[CustomerProfile]) -> CustomerPatterns:
        """Enhanced fallback analysis when AI is not available."""
        
        # Calculate value scores and focus on top customers
        customer_scores = [(c, self._calculate_customer_value_score(c)) for c in customers]
        customer_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Focus on top 50% of customers by value
        top_customers = [c for c, score in customer_scores[:len(customers)//2 + 1]]
        
        # Extract patterns from top customers
        industries = [c.industry for c in top_customers if c.industry and c.industry != "Unknown"]
        locations = [c.headquarters_location for c in top_customers if c.headquarters_location]
        titles = []
        for c in top_customers:
            if c.decision_maker_titles:
                titles.extend(c.decision_maker_titles)
        
        # Calculate more meaningful ranges
        employee_counts = [c.employee_count for c in top_customers if c.employee_count > 0]
        revenues = [c.annual_revenue for c in top_customers if c.annual_revenue and c.annual_revenue > 0]
        
        # Calculate confidence based on data quality
        confidence = min(0.8, len(top_customers) / 10.0)  # Higher confidence with more data
        
        return CustomerPatterns(
            primary_industries=list(set(industries))[:5],
            sub_verticals=[],
            industry_confidence=confidence,
            
            employee_range_min=min(employee_counts) if employee_counts else 1,
            employee_range_max=max(employee_counts) if employee_counts else 1000,
            revenue_range_min=min(revenues) if revenues else None,
            revenue_range_max=max(revenues) if revenues else None,
            size_confidence=confidence,
            
            primary_locations=list(set(locations))[:5],
            geographic_confidence=confidence,
            
            common_technologies=[],
            technology_confidence=0.3,
            
            key_titles=list(set(titles))[:10],
            departments=["Executive", "Operations", "Marketing"],
            seniority_levels=["Senior", "Executive", "C-Level"],
            decision_maker_confidence=confidence,
            
            business_models=["B2B"],
            growth_stages=["Growth", "Expansion"],
            market_positions=["Established"],
            
            pain_points=[
                "Need for operational efficiency",
                "Digital transformation challenges", 
                "Growth scaling issues"
            ],
            buying_signals=[
                "Expansion initiatives",
                "Technology upgrades",
                "Process improvement projects"
            ],
            purchase_triggers=[
                "Business growth",
                "Competitive pressure",
                "Operational challenges"
            ],
            
            pattern_strength="Medium" if len(top_customers) >= 5 else "Limited",
            overall_confidence=confidence,
            customers_analyzed=len(customers)
        )
