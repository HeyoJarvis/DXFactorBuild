"""
Data models for company intelligence system.

Comprehensive models that capture all the information needed for CRM tool 
recommendations and workflow optimization.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any
from enum import Enum


class CompanySize(str, Enum):
    """Company size categories for tool recommendations."""
    STARTUP = "startup"          # <50 employees
    SMB = "smb"                 # 50-200 employees  
    MID_MARKET = "mid_market"   # 200-1000 employees
    ENTERPRISE = "enterprise"   # 1000+ employees


class TechSophistication(str, Enum):
    """Technology sophistication levels."""
    LOW = "low"         # Basic tools, minimal automation
    MEDIUM = "medium"   # Some automation, standard tools
    HIGH = "high"       # Advanced stack, heavy automation


class SalesComplexity(str, Enum):
    """Sales process complexity levels."""
    TRANSACTIONAL = "transactional"    # Simple, short cycles
    CONSULTATIVE = "consultative"      # Medium complexity
    ENTERPRISE = "enterprise"          # Complex, long cycles


@dataclass
class OrganizationContext:
    """
    Organization context data needed for CRM tool recommendations.
    Maps directly to what the CRM workflow analyzer expects.
    """
    # Basic identifiers
    organization_id: str
    company_name: str
    
    # Industry and market
    industry: str                           # 'Technology', 'Healthcare', etc.
    sub_industry: Optional[str] = None      # 'FinTech', 'MedTech', etc.
    target_market: Optional[str] = None     # 'SMB', 'Enterprise', etc.
    
    # Company size and scale
    company_size: CompanySize = CompanySize.SMB
    employee_count_estimate: Optional[int] = None
    sales_team_size: Optional[int] = None
    
    # Financial context
    avg_deal_size: Optional[int] = None     # Average deal value
    budget_range: Optional[str] = None      # '$50K-$200K', etc.
    revenue_stage: Optional[str] = None     # 'Early', 'Growth', 'Mature'
    
    # Process maturity
    current_conversion_rate: Optional[float] = None  # 0.22 = 22%
    avg_cycle_time: Optional[int] = None             # Days
    tech_sophistication: TechSophistication = TechSophistication.MEDIUM
    
    # Business model
    business_model: Optional[str] = None    # 'B2B SaaS', 'B2C', etc.
    sales_complexity: SalesComplexity = SalesComplexity.CONSULTATIVE
    
    # Current systems
    crm_system: Optional[str] = None        # 'HubSpot', 'Salesforce', etc.


@dataclass
class WorkflowIntelligence:
    """
    Workflow and process intelligence for bottleneck identification.
    """
    # Sales process indicators
    sales_process_complexity: SalesComplexity = SalesComplexity.CONSULTATIVE
    sales_cycle_length_estimate: Optional[int] = None  # Days
    lead_qualification_process: Optional[str] = None   # 'automated', 'manual', 'hybrid'
    
    # Process bottleneck indicators
    manual_process_mentions: List[str] = field(default_factory=list)
    automation_gaps: List[str] = field(default_factory=list)
    coordination_challenges: List[str] = field(default_factory=list)
    
    # Efficiency indicators (for specific tool recommendations)
    scheduling_complexity: Optional[str] = None        # For Calendly recommendations
    document_process_maturity: Optional[str] = None    # For PandaDoc recommendations
    integration_needs: List[str] = field(default_factory=list)  # For Zapier recommendations
    
    # Communication and collaboration
    team_coordination_mentions: List[str] = field(default_factory=list)
    remote_work_indicators: List[str] = field(default_factory=list)
    meeting_management_issues: List[str] = field(default_factory=list)


@dataclass
class TechnologyStack:
    """
    Current technology stack for integration planning.
    """
    # Core business systems
    crm_system: Optional[str] = None                # 'HubSpot', 'Salesforce', 'Pipedrive'
    marketing_automation: Optional[str] = None      # 'HubSpot', 'Marketo', 'Mailchimp'
    email_platform: Optional[str] = None           # 'Gmail', 'Outlook', 'Custom'
    
    # Communication and collaboration
    communication_tools: List[str] = field(default_factory=list)  # ['Slack', 'Teams']
    video_conferencing: List[str] = field(default_factory=list)   # ['Zoom', 'Teams']
    project_management: List[str] = field(default_factory=list)   # ['Asana', 'Monday']
    
    # Sales and marketing tools
    scheduling_tools: List[str] = field(default_factory=list)     # ['Calendly', 'Acuity']
    document_tools: List[str] = field(default_factory=list)       # ['PandaDoc', 'DocuSign']
    automation_tools: List[str] = field(default_factory=list)     # ['Zapier', 'Integromat']
    analytics_tools: List[str] = field(default_factory=list)      # ['Google Analytics', 'Mixpanel']
    
    # Integration capabilities
    api_sophistication: TechSophistication = TechSophistication.MEDIUM
    integration_mentions: List[str] = field(default_factory=list)
    webhook_usage: bool = False
    
    # Website technology
    website_platform: Optional[str] = None          # 'WordPress', 'Webflow', 'Custom'
    cms_system: Optional[str] = None                # 'Contentful', 'Strapi', etc.
    ecommerce_platform: Optional[str] = None       # 'Shopify', 'WooCommerce', etc.


@dataclass
class ProcessMaturity:
    """
    Process maturity indicators for implementation planning.
    """
    # Overall maturity
    process_sophistication: str = "medium"          # 'basic', 'medium', 'advanced'
    documentation_quality: str = "medium"           # 'poor', 'medium', 'excellent'
    automation_level: str = "medium"                # 'low', 'medium', 'high'
    
    # Specific process areas
    sales_process_documented: bool = False
    onboarding_process_defined: bool = False
    support_process_structured: bool = False
    
    # Change management indicators
    change_management_capability: str = "medium"    # 'low', 'medium', 'high'
    training_infrastructure: str = "medium"         # 'basic', 'medium', 'advanced'
    process_optimization_culture: bool = False


@dataclass
class MarketIntelligence:
    """
    Market and competitive intelligence.
    """
    # Market position
    market_position: Optional[str] = None           # 'Leader', 'Challenger', 'Niche'
    competitive_advantages: List[str] = field(default_factory=list)
    key_differentiators: List[str] = field(default_factory=list)
    
    # Target customers
    ideal_customer_segments: List[str] = field(default_factory=list)
    customer_pain_points: List[str] = field(default_factory=list)
    value_propositions: List[str] = field(default_factory=list)
    
    # Growth indicators
    growth_stage: Optional[str] = None              # 'startup', 'growth', 'mature'
    funding_indicators: List[str] = field(default_factory=list)
    expansion_signals: List[str] = field(default_factory=list)


@dataclass
class ContentAnalysis:
    """
    Analysis of website content quality and themes.
    """
    # Content quality
    content_depth: str = "medium"                   # 'shallow', 'medium', 'deep'
    content_freshness: str = "medium"               # 'stale', 'medium', 'fresh'
    seo_optimization: str = "medium"                # 'poor', 'medium', 'excellent'
    
    # Content themes
    primary_themes: List[str] = field(default_factory=list)
    messaging_focus: List[str] = field(default_factory=list)
    brand_personality: Optional[str] = None         # 'professional', 'innovative', etc.
    
    # Technical content analysis
    page_count_estimate: Optional[int] = None
    blog_activity_level: str = "medium"             # 'inactive', 'medium', 'active'
    case_study_presence: bool = False
    testimonial_presence: bool = False


@dataclass
class ScrapingMetadata:
    """
    Metadata about the scraping and analysis process.
    """
    # Scraping details
    scraping_method: str                            # 'aiohttp', 'playwright', 'curl'
    scraping_success: bool = True
    content_length: int = 0
    scraping_duration_seconds: float = 0.0
    
    # Analysis details
    ai_model_used: Optional[str] = None
    analysis_duration_seconds: float = 0.0
    total_processing_time: float = 0.0
    
    # Quality indicators
    confidence_scores: Dict[str, float] = field(default_factory=dict)
    data_completeness: float = 0.0
    reliability_score: float = 0.0
    
    # Timestamps
    scraped_at: datetime = field(default_factory=datetime.now)
    analyzed_at: Optional[datetime] = None
    
    # Error tracking
    errors_encountered: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class CompanyIntelligence:
    """
    Complete company intelligence combining all analysis results.
    """
    # Basic information (required fields first)
    company_name: str
    website_url: str
    organization_context: OrganizationContext
    
    # Optional basic information
    description: Optional[str] = None
    
    # Core intelligence components (with defaults)
    workflow_intelligence: WorkflowIntelligence = field(default_factory=WorkflowIntelligence)
    technology_stack: TechnologyStack = field(default_factory=TechnologyStack)
    process_maturity: ProcessMaturity = field(default_factory=ProcessMaturity)
    market_intelligence: MarketIntelligence = field(default_factory=MarketIntelligence)
    content_analysis: ContentAnalysis = field(default_factory=ContentAnalysis)
    
    # Analysis metadata
    scraping_metadata: ScrapingMetadata = field(default_factory=lambda: ScrapingMetadata(scraping_method="unknown"))
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        def convert_dataclass(obj):
            if hasattr(obj, '__dataclass_fields__'):
                result = {}
                for field_name, field_def in obj.__dataclass_fields__.items():
                    value = getattr(obj, field_name)
                    if isinstance(value, datetime):
                        result[field_name] = value.isoformat()
                    elif isinstance(value, Enum):
                        result[field_name] = value.value
                    elif hasattr(value, '__dataclass_fields__'):
                        result[field_name] = convert_dataclass(value)
                    elif isinstance(value, list):
                        result[field_name] = [convert_dataclass(item) if hasattr(item, '__dataclass_fields__') else item for item in value]
                    elif isinstance(value, dict):
                        result[field_name] = {k: convert_dataclass(v) if hasattr(v, '__dataclass_fields__') else v for k, v in value.items()}
                    else:
                        result[field_name] = value
                return result
            return obj
        
        return convert_dataclass(self)
    
    def get_crm_context(self) -> Dict[str, Any]:
        """
        Extract organization context in the format expected by CRM workflow analyzer.
        """
        return {
            'organization_id': self.organization_context.organization_id,
            'industry': self.organization_context.industry,
            'company_size': self.organization_context.company_size.value,
            'sales_team_size': self.organization_context.sales_team_size or 25,
            'avg_deal_size': self.organization_context.avg_deal_size or 75000,
            'current_conversion_rate': self.organization_context.current_conversion_rate or 0.22,
            'avg_cycle_time': self.organization_context.avg_cycle_time or 65,
            'crm_system': self.technology_stack.crm_system or 'Unknown',
            'tech_sophistication': self.organization_context.tech_sophistication.value,
            'budget_range': self.organization_context.budget_range or '$50K-$200K',
            
            # Additional context for better recommendations
            'business_model': self.organization_context.business_model,
            'sales_complexity': self.organization_context.sales_complexity.value,
            'current_tools': {
                'scheduling': self.technology_stack.scheduling_tools,
                'documents': self.technology_stack.document_tools,
                'automation': self.technology_stack.automation_tools,
                'communication': self.technology_stack.communication_tools
            },
            'process_maturity': {
                'sophistication': self.process_maturity.process_sophistication,
                'automation_level': self.process_maturity.automation_level,
                'documentation_quality': self.process_maturity.documentation_quality
            }
        }
    
    def get_confidence_score(self) -> float:
        """Calculate overall confidence score."""
        scores = list(self.scraping_metadata.confidence_scores.values())
        if not scores:
            return 0.5  # Default medium confidence
        return sum(scores) / len(scores)
    
    def get_data_quality_summary(self) -> Dict[str, Any]:
        """Get summary of data quality and completeness."""
        return {
            'overall_confidence': self.get_confidence_score(),
            'data_completeness': self.scraping_metadata.data_completeness,
            'reliability_score': self.scraping_metadata.reliability_score,
            'scraping_success': self.scraping_metadata.scraping_success,
            'content_length': self.scraping_metadata.content_length,
            'processing_time': self.scraping_metadata.total_processing_time,
            'errors_count': len(self.scraping_metadata.errors_encountered),
            'warnings_count': len(self.scraping_metadata.warnings)
        }
