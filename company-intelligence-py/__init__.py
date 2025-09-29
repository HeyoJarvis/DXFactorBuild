"""
Company Intelligence System - Python Edition

A comprehensive website scraper and AI analyzer that extracts detailed company 
intelligence for CRM workflow optimization and tool recommendations.

Features:
- Smart website scraping with multiple fallback methods
- AI-powered content analysis and structured data extraction
- Organization context extraction for CRM tool recommendations
- Workflow intelligence for bottleneck identification
- Technology stack detection for integration planning
"""

__version__ = "1.0.0"
__author__ = "BeachBaby Team"

from .models import CompanyIntelligence, OrganizationContext, WorkflowIntelligence
from .smart_scraper import SmartWebsiteScraper
from .ai_analyzer import AIContentAnalyzer

__all__ = [
    "CompanyIntelligence",
    "OrganizationContext", 
    "WorkflowIntelligence",
    "SmartWebsiteScraper",
    "AIContentAnalyzer"
]

