"""
Configuration settings for the Company Intelligence System.
"""

import os
from typing import Dict, Any


def get_default_config() -> Dict[str, Any]:
    """Get default configuration settings."""
    return {
        # AI Configuration
        'anthropic_api_key': os.getenv('ANTHROPIC_API_KEY'),
        'model': 'claude-3-5-sonnet-20241022',
        'temperature': 0.1,  # Low temperature for consistent analysis
        'max_tokens': 4000,
        
        # Scraping Configuration
        'timeout': 30,  # seconds
        'max_content_length': 500000,  # 500KB
        'max_retries': 3,
        'retry_delay': 2,  # seconds
        
        # Logging Configuration
        'log_level': 'INFO',
        'log_format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        
        # Output Configuration
        'export_json': True,
        'export_directory': './intelligence_exports/',
        
        # Analysis Configuration
        'enable_ai_analysis': True,
        'fallback_on_ai_failure': True,
        'conservative_analysis': True,  # Prioritize accuracy over completeness
    }


def load_config_from_env() -> Dict[str, Any]:
    """Load configuration from environment variables."""
    config = get_default_config()
    
    # Override with environment variables if present
    env_mappings = {
        'ANTHROPIC_API_KEY': 'anthropic_api_key',
        'CI_MODEL': 'model',
        'CI_TEMPERATURE': 'temperature',
        'CI_MAX_TOKENS': 'max_tokens',
        'CI_TIMEOUT': 'timeout',
        'CI_MAX_CONTENT_LENGTH': 'max_content_length',
        'CI_LOG_LEVEL': 'log_level',
        'CI_EXPORT_DIR': 'export_directory',
    }
    
    for env_var, config_key in env_mappings.items():
        env_value = os.getenv(env_var)
        if env_value:
            # Convert to appropriate type
            if config_key in ['temperature', 'timeout', 'max_tokens', 'max_content_length']:
                try:
                    config[config_key] = float(env_value) if '.' in env_value else int(env_value)
                except ValueError:
                    pass  # Keep default value
            elif config_key in ['enable_ai_analysis', 'fallback_on_ai_failure', 'conservative_analysis']:
                config[config_key] = env_value.lower() in ('true', '1', 'yes', 'on')
            else:
                config[config_key] = env_value
    
    return config


