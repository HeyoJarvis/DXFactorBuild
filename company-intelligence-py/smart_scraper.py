"""
Smart Website Scraper - Multi-method website content extraction.

This scraper uses multiple methods to ensure reliable content extraction:
1. aiohttp (fast, lightweight) - Primary method
2. Playwright (handles JS-heavy sites) - Fallback for dynamic content  
3. Multiple URL variations - Try different URL formats
4. Robust error handling and retry logic

Based on the proven approach from the existing ICP generator but enhanced
for comprehensive company intelligence extraction.
"""

import asyncio
import logging
import re
import time
from typing import Dict, List, Optional, Any, Tuple
from urllib.parse import urljoin, urlparse
from dataclasses import asdict

import aiohttp
from bs4 import BeautifulSoup, Comment
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from models import ScrapingMetadata


class SmartWebsiteScraper:
    """
    Intelligent website scraper with multiple extraction methods and fallbacks.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the smart scraper with configuration."""
        self.config = config or {}
        
        # Scraping configuration
        self.timeout = self.config.get('timeout', 30)
        self.max_content_length = self.config.get('max_content_length', 500000)  # 500KB
        self.max_retries = self.config.get('max_retries', 3)
        self.retry_delay = self.config.get('retry_delay', 2)
        
        # User agents for different methods
        self.user_agents = {
            'aiohttp': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'playwright': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'python_aiohttp': 'Python/3.11 aiohttp/3.8.5'  # Like the working Python scraper
        }
        
        # Setup logging
        self.logger = logging.getLogger(__name__)
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
    
    async def scrape_website(self, url: str) -> Tuple[Dict[str, Any], ScrapingMetadata]:
        """
        Main scraping method that tries multiple approaches and returns structured data.
        
        Returns:
            Tuple of (extracted_data, scraping_metadata)
        """
        start_time = time.time()
        normalized_url = self._normalize_url(url)
        
        self.logger.info(f"Starting intelligent scraping for: {normalized_url}")
        
        # Initialize metadata
        metadata = ScrapingMetadata(
            scraping_method="unknown",
            scraping_success=False,
            content_length=0,
            scraping_duration_seconds=0.0
        )
        
        # Try different scraping methods in order of preference
        html_content = None
        scraping_method = None
        
        try:
            # Method 1: aiohttp (fast, works for most sites)
            try:
                self.logger.info("Attempting aiohttp scraping...")
                html_content, method_metadata = await self._scrape_with_aiohttp(normalized_url)
                scraping_method = "aiohttp"
                self.logger.info(f"aiohttp successful: {len(html_content)} characters")
            except Exception as aiohttp_error:
                self.logger.warning(f"aiohttp failed: {aiohttp_error}")
                metadata.errors_encountered.append(f"aiohttp: {str(aiohttp_error)}")
            
            # Method 2: Playwright (handles JS-heavy sites)
            if not html_content:
                try:
                    self.logger.info("Attempting Playwright scraping...")
                    html_content, method_metadata = await self._scrape_with_playwright(normalized_url)
                    scraping_method = "playwright"
                    self.logger.info(f"Playwright successful: {len(html_content)} characters")
                except Exception as playwright_error:
                    self.logger.warning(f"Playwright failed: {playwright_error}")
                    metadata.errors_encountered.append(f"playwright: {str(playwright_error)}")
            
            # Method 3: Try URL variations if main URL failed
            if not html_content:
                self.logger.info("Trying URL variations...")
                for variation_url in self._generate_url_variations(normalized_url):
                    try:
                        self.logger.info(f"Trying URL variation: {variation_url}")
                        html_content, method_metadata = await self._scrape_with_aiohttp(variation_url)
                        scraping_method = f"aiohttp_variation"
                        normalized_url = variation_url  # Update to successful URL
                        self.logger.info(f"URL variation successful: {len(html_content)} characters")
                        break
                    except Exception as variation_error:
                        self.logger.debug(f"URL variation {variation_url} failed: {variation_error}")
                        continue
            
            if not html_content:
                raise Exception("All scraping methods failed")
            
            # Extract structured data from HTML
            self.logger.info("Extracting structured data from HTML...")
            extracted_data = self._extract_structured_data(html_content, normalized_url)
            
            # Update metadata
            metadata.scraping_method = scraping_method
            metadata.scraping_success = True
            metadata.content_length = len(html_content)
            metadata.scraping_duration_seconds = time.time() - start_time
            metadata.total_processing_time = metadata.scraping_duration_seconds
            
            self.logger.info(f"Scraping completed successfully in {metadata.scraping_duration_seconds:.2f}s")
            
            return extracted_data, metadata
            
        except Exception as e:
            # Update metadata with failure info
            metadata.scraping_success = False
            metadata.scraping_duration_seconds = time.time() - start_time
            metadata.total_processing_time = metadata.scraping_duration_seconds
            metadata.errors_encountered.append(f"final_error: {str(e)}")
            
            self.logger.error(f"All scraping methods failed for {normalized_url}: {e}")
            
            # Return empty data but with metadata about the failure
            return {
                'url': normalized_url,
                'html_text': '',
                'meta_data': {},
                'structured_data': [],
                'content_sections': {},
                'technology_stack': [],
                'contact_info': {},
                'navigation_structure': []
            }, metadata
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((aiohttp.ClientError, asyncio.TimeoutError))
    )
    async def _scrape_with_aiohttp(self, url: str) -> Tuple[str, Dict[str, Any]]:
        """
        Scrape using aiohttp - based on the working Python ICP generator approach.
        """
        timeout = aiohttp.ClientTimeout(total=self.timeout)
        
        async with aiohttp.ClientSession(timeout=timeout) as session:
            headers = {
                'User-Agent': self.user_agents['python_aiohttp'],  # Use the working user agent
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
            
            async with session.get(url, headers=headers) as response:
                if response.status != 200:
                    raise aiohttp.ClientError(f"HTTP {response.status}: {response.reason}")
                
                html = await response.text()
                
                if len(html) > self.max_content_length:
                    self.logger.warning(f"Content truncated from {len(html)} to {self.max_content_length} characters")
                    html = html[:self.max_content_length]
                
                return html, {
                    'method': 'aiohttp',
                    'status_code': response.status,
                    'content_length': len(html),
                    'content_type': response.headers.get('content-type', 'unknown')
                }
    
    async def _scrape_with_playwright(self, url: str) -> Tuple[str, Dict[str, Any]]:
        """
        Scrape using Playwright for JavaScript-heavy sites.
        """
        async with async_playwright() as p:
            # Launch browser with options for better compatibility
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--disable-web-security'
                ]
            )
            
            try:
                page = await browser.new_page()
                
                # Set user agent and viewport
                await page.set_user_agent(self.user_agents['playwright'])
                await page.set_viewport_size({"width": 1920, "height": 1080})
                
                # Navigate to page with timeout
                try:
                    await page.goto(url, wait_until='networkidle', timeout=self.timeout * 1000)
                except PlaywrightTimeoutError:
                    # Try with domcontentloaded if networkidle times out
                    await page.goto(url, wait_until='domcontentloaded', timeout=self.timeout * 1000)
                
                # Wait a bit for dynamic content to load
                await page.wait_for_timeout(2000)
                
                # Get HTML content
                html = await page.content()
                
                if len(html) > self.max_content_length:
                    self.logger.warning(f"Content truncated from {len(html)} to {self.max_content_length} characters")
                    html = html[:self.max_content_length]
                
                return html, {
                    'method': 'playwright',
                    'content_length': len(html),
                    'page_title': await page.title()
                }
                
            finally:
                await browser.close()
    
    def _normalize_url(self, url: str) -> str:
        """Normalize URL by ensuring it has a proper scheme."""
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        return url.rstrip('/')
    
    def _generate_url_variations(self, url: str) -> List[str]:
        """Generate URL variations to try if the main URL fails."""
        variations = []
        parsed = urlparse(url)
        
        # Try with/without www
        if parsed.hostname.startswith('www.'):
            # Remove www
            no_www = url.replace('www.', '', 1)
            variations.append(no_www)
        else:
            # Add www
            with_www = url.replace('://', '://www.', 1)
            variations.append(with_www)
        
        # Try http if https failed (and vice versa)
        if parsed.scheme == 'https':
            http_version = url.replace('https://', 'http://', 1)
            variations.append(http_version)
        else:
            https_version = url.replace('http://', 'https://', 1)
            variations.append(https_version)
        
        return variations
    
    def _extract_structured_data(self, html: str, url: str) -> Dict[str, Any]:
        """
        Extract structured data from HTML content.
        This is the comprehensive extraction that feeds into AI analysis.
        """
        soup = BeautifulSoup(html, 'html.parser')
        
        # Remove unwanted elements
        for element in soup(['script', 'style', 'nav', 'footer', 'header', '.cookie-banner', '.popup']):
            element.decompose()
        
        # Remove comments
        for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
            comment.extract()
        
        return {
            'url': url,
            'html_text': self._extract_clean_text(soup),
            'meta_data': self._extract_meta_tags(soup),
            'structured_data': self._extract_json_ld(soup),
            'content_sections': self._extract_content_sections(soup),
            'technology_stack': self._detect_technologies(html),
            'contact_info': self._extract_contact_information(soup),
            'navigation_structure': self._extract_navigation_structure(soup)
        }
    
    def _extract_clean_text(self, soup: BeautifulSoup) -> str:
        """
        Extract clean text content - based on the working Python ICP generator.
        """
        # Get text content
        text = soup.get_text()
        
        # Break into lines and remove leading/trailing space
        lines = (line.strip() for line in text.splitlines())
        
        # Break multi-headlines into a line each
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        
        # Drop blank lines and join
        clean_text = ' '.join(chunk for chunk in chunks if chunk)
        
        # Limit text length for AI processing
        max_text_length = 50000  # 50K characters should be enough
        if len(clean_text) > max_text_length:
            clean_text = clean_text[:max_text_length] + "... [truncated]"
        
        return clean_text
    
    def _extract_meta_tags(self, soup: BeautifulSoup) -> Dict[str, str]:
        """Extract meta tags and structured metadata."""
        meta_data = {}
        
        # Basic meta tags
        title_tag = soup.find('title')
        if title_tag:
            meta_data['title'] = title_tag.get_text().strip()
        
        # Meta description
        description_tag = soup.find('meta', attrs={'name': 'description'})
        if description_tag:
            meta_data['description'] = description_tag.get('content', '').strip()
        
        # Open Graph tags
        og_tags = soup.find_all('meta', attrs={'property': lambda x: x and x.startswith('og:')})
        for tag in og_tags:
            property_name = tag.get('property', '').replace('og:', '')
            content = tag.get('content', '').strip()
            if content:
                meta_data[f'og_{property_name}'] = content
        
        # Twitter Card tags
        twitter_tags = soup.find_all('meta', attrs={'name': lambda x: x and x.startswith('twitter:')})
        for tag in twitter_tags:
            name = tag.get('name', '').replace('twitter:', '')
            content = tag.get('content', '').strip()
            if content:
                meta_data[f'twitter_{name}'] = content
        
        # Other useful meta tags
        for meta_name in ['keywords', 'author', 'robots', 'viewport']:
            tag = soup.find('meta', attrs={'name': meta_name})
            if tag:
                meta_data[meta_name] = tag.get('content', '').strip()
        
        return meta_data
    
    def _extract_json_ld(self, soup: BeautifulSoup) -> List[Dict[str, Any]]:
        """Extract JSON-LD structured data."""
        json_ld_data = []
        
        json_ld_scripts = soup.find_all('script', type='application/ld+json')
        for script in json_ld_scripts:
            try:
                import json
                data = json.loads(script.string)
                json_ld_data.append(data)
            except (json.JSONDecodeError, TypeError):
                continue
        
        return json_ld_data
    
    def _extract_content_sections(self, soup: BeautifulSoup) -> Dict[str, str]:
        """Extract different content sections for AI analysis."""
        sections = {}
        
        # Hero/main content
        hero_selectors = ['[class*="hero"]', '[class*="banner"]', '[class*="jumbotron"]', 'main', '[role="main"]']
        for selector in hero_selectors:
            element = soup.select_one(selector)
            if element:
                sections['hero_section'] = element.get_text().strip()
                break
        
        # About section
        about_selectors = ['[class*="about"]', '[id*="about"]', 'section:contains("About")', '[class*="company"]']
        for selector in about_selectors:
            try:
                element = soup.select_one(selector)
                if element:
                    sections['about_section'] = element.get_text().strip()
                    break
            except:
                continue
        
        # Products/Services
        product_selectors = ['[class*="product"]', '[class*="service"]', '[class*="solution"]', '[class*="feature"]']
        for selector in product_selectors:
            element = soup.select_one(selector)
            if element:
                sections['products_services'] = element.get_text().strip()
                break
        
        # Pricing section
        pricing_selectors = ['[class*="pricing"]', '[class*="price"]', '[class*="plan"]', '[id*="pricing"]']
        for selector in pricing_selectors:
            element = soup.select_one(selector)
            if element:
                sections['pricing_section'] = element.get_text().strip()
                break
        
        # Team section
        team_selectors = ['[class*="team"]', '[class*="about"]', '[class*="leadership"]', '[class*="founder"]']
        for selector in team_selectors:
            element = soup.select_one(selector)
            if element and 'team' in element.get_text().lower():
                sections['team_section'] = element.get_text().strip()
                break
        
        # Contact section
        contact_selectors = ['[class*="contact"]', '[id*="contact"]', 'footer', '[class*="footer"]']
        for selector in contact_selectors:
            element = soup.select_one(selector)
            if element:
                sections['contact_section'] = element.get_text().strip()
                break
        
        # Clean up sections - remove empty ones and limit length
        cleaned_sections = {}
        for key, content in sections.items():
            if content and len(content.strip()) > 20:  # Only keep substantial content
                # Limit section length
                if len(content) > 2000:
                    content = content[:2000] + "... [truncated]"
                cleaned_sections[key] = content
        
        return cleaned_sections
    
    def _detect_technologies(self, html: str) -> List[str]:
        """Detect technologies used on the website."""
        technologies = []
        html_lower = html.lower()
        
        # CRM and Sales Tools (domain-aware to reduce false positives)
        if 'hubspot' in html_lower or 'hs-scripts.com' in html_lower or 'hsforms' in html_lower:
            technologies.append('HubSpot')
        # Require stronger signals for Salesforce (domains/snippets)
        if (
            'salesforce.com' in html_lower or 'force.com' in html_lower or
            'sfmc' in html_lower or 'salesforce' in html_lower and 'data-sf' in html_lower
        ):
            technologies.append('Salesforce')
        if 'pipedrive' in html_lower or 'pipedrive.com' in html_lower:
            technologies.append('Pipedrive')
        
        # Analytics
        if 'google-analytics' in html_lower or 'gtag(' in html_lower or 'ga(' in html_lower:
            technologies.append('Google Analytics')
        if 'mixpanel' in html_lower:
            technologies.append('Mixpanel')
        if 'segment.com' in html_lower or 'cdn.segment.com' in html_lower or 'analytics.load(' in html_lower:
            technologies.append('Segment')
        
        # Marketing Tools
        if 'mailchimp' in html_lower:
            technologies.append('Mailchimp')
        if 'marketo' in html_lower:
            technologies.append('Marketo')
        if 'pardot' in html_lower:
            technologies.append('Pardot')
        
        # Communication Tools
        if 'intercom' in html_lower:
            technologies.append('Intercom')
        if 'zendesk' in html_lower:
            technologies.append('Zendesk')
        if 'drift' in html_lower:
            technologies.append('Drift')
        
        # Scheduling Tools
        if 'calendly' in html_lower:
            technologies.append('Calendly')
        if 'acuity' in html_lower:
            technologies.append('Acuity Scheduling')
        if 'chili piper' in html_lower:
            technologies.append('Chili Piper')
        
        # Document Tools
        if 'pandadoc' in html_lower:
            technologies.append('PandaDoc')
        if 'docusign' in html_lower:
            technologies.append('DocuSign')
        if 'hellosign' in html_lower:
            technologies.append('HelloSign')
        
        # Automation Tools
        if 'zapier' in html_lower:
            technologies.append('Zapier')
        if 'integromat' in html_lower:
            technologies.append('Integromat')
        
        # Web Technologies
        if 'wordpress' in html_lower:
            technologies.append('WordPress')
        if 'shopify.com' in html_lower or 'cdn.shopify.com' in html_lower:
            technologies.append('Shopify')
        if 'webflow' in html_lower:
            technologies.append('Webflow')
        if 'react' in html_lower:
            technologies.append('React')
        if 'vue' in html_lower:
            technologies.append('Vue.js')
        if 'angular' in html_lower:
            technologies.append('Angular')
        
        return list(set(technologies))  # Remove duplicates
    
    def _extract_contact_information(self, soup: BeautifulSoup) -> Dict[str, Any]:
        """Extract contact information from the website."""
        contact_info = {}
        text_content = soup.get_text()
        
        # Email addresses
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, text_content)
        if emails:
            contact_info['emails'] = list(set(emails))
        
        # Phone numbers (basic pattern)
        phone_pattern = r'(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})'
        phones = re.findall(phone_pattern, text_content)
        if phones:
            contact_info['phones'] = [''.join(phone) for phone in phones]
        
        # Social media links
        social_links = {}
        for link in soup.find_all('a', href=True):
            href = link['href'].lower()
            if 'linkedin.com' in href:
                social_links['linkedin'] = link['href']
            elif 'twitter.com' in href:
                social_links['twitter'] = link['href']
            elif 'facebook.com' in href:
                social_links['facebook'] = link['href']
            elif 'instagram.com' in href:
                social_links['instagram'] = link['href']
        
        if social_links:
            contact_info['social_media'] = social_links
        
        return contact_info
    
    def _extract_navigation_structure(self, soup: BeautifulSoup) -> List[str]:
        """Extract navigation structure to understand site organization."""
        nav_items = []
        
        # Find navigation elements
        nav_selectors = ['nav', '[class*="nav"]', '[class*="menu"]', 'header ul', '[role="navigation"]']
        
        for selector in nav_selectors:
            nav_element = soup.select_one(selector)
            if nav_element:
                # Extract link text from navigation
                links = nav_element.find_all('a')
                for link in links:
                    link_text = link.get_text().strip()
                    if link_text and len(link_text) < 50:  # Reasonable nav item length
                        nav_items.append(link_text)
                break  # Use first navigation found
        
        return list(set(nav_items))  # Remove duplicates
