"""Data models for ICP generation and customer analysis."""

from dataclasses import dataclass, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

from ...lead_generation.models.lead_models import ICPCriteria


class ICPConfidence(str, Enum):
    HIGH = "high"      # 0.8+ confidence
    MEDIUM = "medium"  # 0.6-0.8 confidence  
    LOW = "low"        # <0.6 confidence


class CustomerSegment(str, Enum):
    ENTERPRISE = "enterprise"          # 1000+ employees
    MID_MARKET = "mid_market"         # 100-1000 employees
    SMB = "smb"                       # <100 employees
    STARTUP = "startup"               # Early stage
    GROWTH = "growth"                 # Scaling phase


@dataclass
class CustomerProfile:
    """Individual customer profile with enrichment data."""
    # Basic company info
    company_name: str
    industry: str
    employee_count: int
    annual_revenue: Optional[int] = None
    headquarters_location: str = ""
    
    # Technology stack
    technologies_used: List[str] = None
    marketing_stack: List[str] = None
    sales_stack: List[str] = None
    
    # Decision makers
    key_contacts: List[Dict[str, Any]] = None
    decision_maker_titles: List[str] = None
    
    # Business context
    business_model: str = ""  # B2B, B2C, Marketplace, etc.
    growth_stage: CustomerSegment = CustomerSegment.MID_MARKET
    market_position: str = ""  # Leader, Challenger, Niche
    
    # Engagement history
    deal_history: List[Dict[str, Any]] = None
    engagement_score: float = 0.0
    
    # Enrichment metadata
    data_sources: List[str] = None
    enrichment_confidence: float = 0.0
    last_updated: str = ""
    
    def __post_init__(self):
        if self.technologies_used is None:
            self.technologies_used = []
        if self.marketing_stack is None:
            self.marketing_stack = []
        if self.sales_stack is None:
            self.sales_stack = []
        if self.key_contacts is None:
            self.key_contacts = []
        if self.decision_maker_titles is None:
            self.decision_maker_titles = []
        if self.deal_history is None:
            self.deal_history = []
        if self.data_sources is None:
            self.data_sources = []
        if not self.last_updated:
            self.last_updated = datetime.now().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        data['growth_stage'] = self.growth_stage.value
        return data


@dataclass
class CustomerPatterns:
    """Identified patterns across customer base."""
    # Industry patterns
    primary_industries: List[str]
    sub_verticals: List[str]
    industry_confidence: float
    
    # Size patterns  
    employee_range_min: int
    employee_range_max: int
    revenue_range_min: Optional[int]
    revenue_range_max: Optional[int]
    size_confidence: float
    
    # Geographic patterns
    primary_locations: List[str]
    geographic_confidence: float
    
    # Technology patterns
    common_technologies: List[str]
    technology_confidence: float
    
    # Decision maker patterns
    key_titles: List[str]
    departments: List[str]
    seniority_levels: List[str]
    decision_maker_confidence: float
    
    # Business characteristics
    business_models: List[str]
    growth_stages: List[str]
    market_positions: List[str]
    
    # Behavioral patterns
    pain_points: List[str]
    buying_signals: List[str]
    purchase_triggers: List[str]
    
    # Analysis metadata
    pattern_strength: str
    overall_confidence: float
    customers_analyzed: int
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)


@dataclass  
class ICPGenerationResult:
    """Result of ICP generation process."""
    success: bool
    icp_criteria: ICPCriteria
    customer_patterns: CustomerPatterns
    source_customers: List[str]
    confidence_score: float
    generation_duration_seconds: float
    market_validation_passed: bool
    recommendations: List[str] = None
    warnings: List[str] = None
    
    def __post_init__(self):
        if self.recommendations is None:
            self.recommendations = []
        if self.warnings is None:
            self.warnings = []
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        data = asdict(self)
        data['icp_criteria'] = self.icp_criteria.to_dict()
        data['customer_patterns'] = self.customer_patterns.to_dict()
        return data