"""HubSpot API connector for customer data enrichment."""

import aiohttp
import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from ..models.icp_models import CustomerProfile, CustomerSegment

logger = logging.getLogger(__name__)


class HubSpotConnector:
    """Connector for HubSpot API integration."""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.hubapi.com"
        self.rate_limit_delay = 0.1  # HubSpot allows 100 requests/10 seconds
    
    async def get_all_companies(self, limit: int = 100) -> List[CustomerProfile]:
        """Get all companies from HubSpot for ICP generation."""
        
        if not self.api_key:
            logger.warning("No HubSpot API key provided, cannot fetch companies")
            return []
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            properties = [
                "name", "industry", "numberofemployees", "annualrevenue",
                "city", "state", "country", "website", "domain",
                "hs_technologies", "type", "founded_year", "description",
                "hs_object_id", "lifecyclestage", "lead_status", "hubspot_owner_id",
                "notes_last_contacted", "notes_next_activity_date", "total_revenue",
                "hs_analytics_source", "hs_analytics_source_data_1", "hs_analytics_source_data_2"
            ]
            
            companies = []
            after = None
            
            async with aiohttp.ClientSession() as session:
                while len(companies) < limit:
                    # Build URL with pagination
                    url = f"{self.base_url}/crm/v3/objects/companies"
                    params = {
                        "properties": ",".join(properties),
                        "limit": min(100, limit - len(companies))  # HubSpot max 100 per request
                    }
                    if after:
                        params["after"] = after
                    
                    async with session.get(
                        url,
                        headers=headers,
                        params=params,
                        timeout=aiohttp.ClientTimeout(total=30)
                    ) as response:
                        
                        if response.status == 200:
                            data = await response.json()
                            results = data.get('results', [])
                            
                            for company_data in results:
                                try:
                                    company_props = company_data.get('properties', {})
                                    company_id = company_data.get('id', '')
                                    company_name = company_props.get('name', 'Unknown Company')
                                    
                                    # Skip companies without names
                                    if not company_name or company_name == 'Unknown Company':
                                        logger.warning(f"Skipping company without name: {company_id}")
                                        continue
                                    
                                    # Get additional data for each company
                                    contacts = await self._get_company_contacts(company_id)
                                    deals = await self._get_company_deals(company_id)
                                    
                                    # Create enriched profile
                                    profile = await self._create_enriched_profile(company_props, contacts, deals)
                                    if profile:
                                        companies.append(profile)
                                    
                                    # Rate limiting
                                    await asyncio.sleep(self.rate_limit_delay)
                                    
                                except Exception as e:
                                    company_name = company_props.get('name', 'Unknown') if 'company_props' in locals() else 'Unknown'
                                    logger.error(f"Failed to process company {company_name}: {e}")
                                    continue
                            
                            # Check for pagination
                            paging = data.get('paging', {})
                            if 'next' in paging and len(companies) < limit:
                                after = paging['next']['after']
                            else:
                                break
                        else:
                            error_text = await response.text()
                            logger.error(f"Failed to fetch companies from HubSpot: {response.status} - {error_text}")
                            break
            
            logger.info(f"Retrieved {len(companies)} companies from HubSpot")
            return companies
            
        except Exception as e:
            logger.error(f"Failed to get all companies from HubSpot: {e}")
            return []

    async def get_customer_profiles(self, company_names: List[str]) -> List[CustomerProfile]:
        """Get detailed customer profiles from HubSpot."""
        
        if not self.api_key:
            logger.warning("No HubSpot API key provided, creating basic profiles")
            return await self._create_basic_profiles(company_names)
        
        profiles = []
        
        for company_name in company_names:
            try:
                # Search for company in HubSpot
                company_data = await self._search_hubspot_company(company_name)
                
                if company_data:
                    # Get additional data
                    contacts = await self._get_company_contacts(company_data.get('hs_object_id', ''))
                    deals = await self._get_company_deals(company_data.get('hs_object_id', ''))
                    
                    # Create enriched profile
                    profile = await self._create_enriched_profile(company_data, contacts, deals)
                    profiles.append(profile)
                else:
                    # Create basic profile if not found in HubSpot
                    basic_profile = await self._create_basic_profile(company_name)
                    profiles.append(basic_profile)
                    
            except Exception as e:
                logger.error(f"Failed to get HubSpot data for {company_name}: {e}")
                basic_profile = await self._create_basic_profile(company_name)
                profiles.append(basic_profile)
        
        logger.info(f"Retrieved {len(profiles)} customer profiles from HubSpot")
        return profiles
    
    async def _search_hubspot_company(self, company_name: str) -> Optional[Dict[str, Any]]:
        """Search for company in HubSpot by name."""
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            # Search companies endpoint
            search_data = {
                "filterGroups": [
                    {
                        "filters": [
                            {
                                "propertyName": "name",
                                "operator": "CONTAINS_TOKEN",
                                "value": company_name
                            }
                        ]
                    }
                ],
                "properties": [
                    "name", "industry", "numberofemployees", "annualrevenue",
                    "city", "state", "country", "website", "domain",
                    "hs_technologies", "type", "founded_year", "description"
                ],
                "limit": 1
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/crm/v3/objects/companies/search",
                    json=search_data,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    
                    if response.status == 200:
                        data = await response.json()
                        results = data.get('results', [])
                        
                        if results:
                            company = results[0]
                            logger.info(f"✅ Found {company_name} in HubSpot")
                            return company.get('properties', {})
                        else:
                            logger.warning(f"Company {company_name} not found in HubSpot")
                            return None
                    else:
                        error_text = await response.text()
                        logger.error(f"HubSpot search failed for {company_name}: {response.status} - {error_text}")
                        return None
                        
        except Exception as e:
            logger.error(f"HubSpot company search failed: {e}")
            return None
    
    async def _get_company_contacts(self, company_id: str) -> List[Dict[str, Any]]:
        """Get key contacts for a company from HubSpot."""
        
        if not company_id:
            return []
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/crm/v3/objects/companies/{company_id}/associations/contacts",
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    
                    if response.status == 200:
                        data = await response.json()
                        contact_ids = [result['id'] for result in data.get('results', [])]
                        
                        # Get contact details
                        contacts = []
                        for contact_id in contact_ids[:5]:  # Limit to top 5 contacts
                            contact_data = await self._get_contact_details(contact_id)
                            if contact_data:
                                contacts.append(contact_data)
                        
                        return contacts
                    else:
                        logger.warning(f"Failed to get contacts for company {company_id}")
                        return []
                        
        except Exception as e:
            logger.error(f"Failed to get company contacts: {e}")
            return []
    
    async def _get_contact_details(self, contact_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed contact information."""
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            properties = [
                "firstname", "lastname", "email", "jobtitle", 
                "seniority", "department", "phone", "linkedin_url"
            ]
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/crm/v3/objects/contacts/{contact_id}?properties={','.join(properties)}",
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    
                    if response.status == 200:
                        data = await response.json()
                        return data.get('properties', {})
                    else:
                        return None
                        
        except Exception as e:
            logger.error(f"Failed to get contact details: {e}")
            return None
    
    async def _get_company_deals(self, company_id: str) -> List[Dict[str, Any]]:
        """Get deal history for a company."""
        
        if not company_id:
            return []
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/crm/v3/objects/companies/{company_id}/associations/deals",
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    
                    if response.status == 200:
                        data = await response.json()
                        deal_ids = [result['id'] for result in data.get('results', [])]
                        
                        # Get deal details
                        deals = []
                        for deal_id in deal_ids[:10]:  # Limit to 10 most recent deals
                            deal_data = await self._get_deal_details(deal_id)
                            if deal_data:
                                deals.append(deal_data)
                        
                        return deals
                    else:
                        return []
                        
        except Exception as e:
            logger.error(f"Failed to get company deals: {e}")
            return []
    
    async def _get_deal_details(self, deal_id: str) -> Optional[Dict[str, Any]]:
        """Get detailed deal information."""
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            properties = [
                "dealname", "amount", "dealstage", "pipeline",
                "closedate", "createdate", "deal_type"
            ]
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/crm/v3/objects/deals/{deal_id}?properties={','.join(properties)}",
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    
                    if response.status == 200:
                        data = await response.json()
                        return data.get('properties', {})
                    else:
                        return None
                        
        except Exception as e:
            logger.error(f"Failed to get deal details: {e}")
            return None
    
    async def _create_enriched_profile(
        self, 
        company_data: Dict[str, Any], 
        contacts: List[Dict[str, Any]], 
        deals: List[Dict[str, Any]]
    ) -> CustomerProfile:
        """Create enriched customer profile from HubSpot data."""
        
        # Extract decision maker titles from contacts
        decision_maker_titles = []
        key_contacts = []
        
        for contact in contacts:
            title = contact.get('jobtitle', '')
            if title:
                decision_maker_titles.append(title)
                key_contacts.append({
                    'name': f"{contact.get('firstname', '')} {contact.get('lastname', '')}".strip(),
                    'title': title,
                    'email': contact.get('email'),
                    'department': contact.get('department'),
                    'seniority': contact.get('seniority')
                })
        
        # Determine company segment
        employee_count = int(company_data.get('numberofemployees', 0)) if company_data.get('numberofemployees') else 0
        if employee_count >= 1000:
            segment = CustomerSegment.ENTERPRISE
        elif employee_count >= 100:
            segment = CustomerSegment.MID_MARKET
        else:
            segment = CustomerSegment.SMB
        
        # Enhanced business model detection
        description = company_data.get('description', '') or ''
        description = description.lower() if description else ''
        business_model = "B2B"
        if any(term in description for term in ["b2c", "consumer", "retail", "e-commerce"]):
            business_model = "B2C"
        elif any(term in description for term in ["marketplace", "platform", "two-sided"]):
            business_model = "Marketplace"
        
        # Enhanced market position detection
        market_position = "Established"
        if company_data.get('founded_year'):
            founded_year = int(company_data.get('founded_year', 0))
            current_year = datetime.now().year
            if current_year - founded_year < 5:
                market_position = "Startup"
            elif current_year - founded_year < 10:
                market_position = "Growth"
        
        # Calculate enhanced engagement score
        engagement_score = self._calculate_enhanced_engagement_score(deals, contacts, company_data)
        
        return CustomerProfile(
            company_name=company_data.get('name', ''),
            industry=company_data.get('industry', ''),
            employee_count=employee_count,
            annual_revenue=int(company_data.get('total_revenue', 0)) if company_data.get('total_revenue') else (
                int(company_data.get('annualrevenue', 0)) if company_data.get('annualrevenue') else None
            ),
            headquarters_location=f"{company_data.get('city', '')}, {company_data.get('state', '')}".strip(', '),
            
            # Technology stack
            technologies_used=company_data.get('hs_technologies', []),
            
            # Decision makers
            key_contacts=key_contacts,
            decision_maker_titles=list(set(decision_maker_titles)),
            
            # Enhanced business context
            business_model=business_model,
            growth_stage=segment,
            market_position=market_position,
            
            # Deal history and engagement
            deal_history=deals,
            engagement_score=engagement_score,
            
            # Metadata
            data_sources=["hubspot"],
            enrichment_confidence=0.9,  # High confidence for HubSpot data
            last_updated=datetime.now().isoformat()
        )
    
    def _calculate_engagement_score(self, deals: List[Dict[str, Any]], contacts: List[Dict[str, Any]]) -> float:
        """Calculate customer engagement score based on HubSpot data."""
        
        score = 0.0
        
        # Deal-based scoring
        if deals:
            won_deals = len([d for d in deals if d.get('dealstage') == 'closedwon'])
            total_deals = len(deals)
            deal_score = (won_deals / total_deals) if total_deals > 0 else 0
            score += deal_score * 0.6  # 60% weight for deal success
        
        # Contact engagement scoring
        if contacts:
            engaged_contacts = len([c for c in contacts if c.get('email')])
            total_contacts = len(contacts)
            contact_score = (engaged_contacts / total_contacts) if total_contacts > 0 else 0
            score += contact_score * 0.4  # 40% weight for contact engagement
        
        return round(score, 2)
    
    def _calculate_enhanced_engagement_score(self, deals: List[Dict[str, Any]], contacts: List[Dict[str, Any]], company_data: Dict[str, Any]) -> float:
        """Calculate enhanced customer engagement score with more factors."""
        
        score = 0.0
        
        # Deal-based scoring (50% weight)
        if deals:
            won_deals = len([d for d in deals if d.get('dealstage') == 'closedwon'])
            total_deals = len(deals)
            deal_value = sum([float(d.get('amount', 0)) for d in deals if d.get('amount')])
            
            deal_success_rate = (won_deals / total_deals) if total_deals > 0 else 0
            deal_volume_score = min(deal_value / 100000, 1.0)  # Normalize to $100k
            
            score += (deal_success_rate * 0.3) + (deal_volume_score * 0.2)
        
        # Contact engagement (20% weight)
        if contacts:
            engaged_contacts = len([c for c in contacts if c.get('email')])
            senior_contacts = len([c for c in contacts if any(title in (c.get('jobtitle') or '').lower() 
                                                           for title in ['vp', 'director', 'head', 'chief', 'president'])])
            
            contact_engagement = (engaged_contacts / len(contacts)) if contacts else 0
            senior_engagement = (senior_contacts / len(contacts)) if contacts else 0
            
            score += (contact_engagement * 0.1) + (senior_engagement * 0.1)
        
        # Company maturity and stability (15% weight)
        if company_data.get('founded_year'):
            founded_year = int(company_data.get('founded_year', 0))
            company_age = datetime.now().year - founded_year
            maturity_score = min(company_age / 10, 1.0)  # Normalize to 10 years
            score += maturity_score * 0.15
        
        # Lifecycle stage (15% weight)
        lifecycle_stage = (company_data.get('lifecyclestage') or '').lower()
        if lifecycle_stage in ['customer', 'opportunity']:
            score += 0.15
        elif lifecycle_stage in ['qualified', 'lead']:
            score += 0.1
        elif lifecycle_stage in ['subscriber', 'other']:
            score += 0.05
        
        return round(min(score, 1.0), 2)
    
    async def _create_basic_profiles(self, company_names: List[str]) -> List[CustomerProfile]:
        """Create basic profiles when HubSpot is not available."""
        
        profiles = []
        for company_name in company_names:
            profile = await self._create_basic_profile(company_name)
            profiles.append(profile)
        
        return profiles
    
    async def _create_basic_profile(self, company_name: str) -> CustomerProfile:
        """Create basic customer profile."""
        
        return CustomerProfile(
            company_name=company_name,
            industry="Unknown",
            employee_count=1000,
            headquarters_location="United States",
            data_sources=["basic"],
            enrichment_confidence=0.3
        )
