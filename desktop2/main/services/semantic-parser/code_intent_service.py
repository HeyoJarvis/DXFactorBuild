#!/usr/bin/env python3
"""
Code Intent Service
Wrapper for semantic parser optimized for code-indexer queries
Can be called from Node.js via child_process
"""

import sys
import json
import os
from typing import Dict, Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from semantic_request_parser import SemanticRequestParser, CapabilityCategory
from mock_engine import MockAIEngine as MockEngine
from code_capabilities import (
    CodeCapability,
    CodeContext,
    CodeUnderstanding,
    infer_capability_from_query,
    extract_file_patterns,
    extract_search_terms,
    create_code_operations
)


class CodeIntentService:
    """Service for understanding code-related user intents"""

    def __init__(self, use_mock: bool = False):
        """Initialize with mock or real AI engine"""
        self.use_mock = use_mock

        # Initialize AI engine
        if use_mock:
            self.engine = MockEngine()
        else:
            # Try to use Anthropic engine
            try:
                from antrhopic_engine import AnthropicEngine
                api_key = os.getenv('ANTHROPIC_API_KEY')
                if api_key:
                    self.engine = AnthropicEngine(api_key=api_key)
                else:
                    print("Warning: ANTHROPIC_API_KEY not set, falling back to mock", file=sys.stderr)
                    self.engine = MockEngine()
                    self.use_mock = True
            except Exception as e:
                print(f"Warning: Failed to load Anthropic engine: {e}, using mock", file=sys.stderr)
                self.engine = MockEngine()
                self.use_mock = True

        # Initialize semantic parser
        self.parser = SemanticRequestParser(engine=self.engine)

    def parse_code_intent(
        self,
        query: str,
        repository: str,
        ticket_key: Optional[str] = None,
        ticket_summary: Optional[str] = None,
        ticket_description: Optional[str] = None,
        branch: str = "main",
        language: Optional[str] = None,
        recent_files: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Parse user query and extract code-specific intent

        Args:
            query: User's natural language query
            repository: Repository name (owner/repo)
            ticket_key: JIRA ticket key (optional)
            ticket_summary: JIRA ticket summary (optional)
            ticket_description: JIRA ticket description (optional)
            branch: Git branch
            language: Programming language
            recent_files: Recently viewed files

        Returns:
            CodeUnderstanding dict with operations to execute
        """
        try:
            # Infer capabilities from query
            code_capabilities = infer_capability_from_query(query)

            # Extract file patterns
            file_patterns = extract_file_patterns(query, ticket_description)

            # Build code context
            code_context = CodeContext(
                repository=repository,
                branch=branch,
                ticket_key=ticket_key,
                ticket_summary=ticket_summary,
                ticket_description=ticket_description,
                file_patterns=file_patterns,
                language=language,
                recent_files=recent_files or []
            )

            # Create operations
            operations = create_code_operations(
                code_capabilities,
                query,
                code_context
            )

            # Build enhanced context for semantic parser
            enhanced_context = {
                "code_context": {
                    "repository": repository,
                    "ticket": f"{ticket_key}: {ticket_summary}" if ticket_key else None,
                    "file_patterns": file_patterns,
                    "language": language
                },
                "capabilities": [cap.value for cap in code_capabilities]
            }

            # Parse with semantic parser (for business goal and confidence)
            if not self.use_mock:
                try:
                    semantic_result = self.parser.parse_request(
                        request=query,
                        context=enhanced_context
                    )
                    business_goal = semantic_result.business_goal
                    confidence = semantic_result.confidence_score
                    clarification = semantic_result.clarification_needed
                except Exception as e:
                    print(f"Warning: Semantic parser failed: {e}, using fallback", file=sys.stderr)
                    business_goal = query
                    confidence = 0.7
                    clarification = None
            else:
                # Mock simple understanding
                business_goal = query
                confidence = 0.8
                clarification = None

            # Build understanding
            understanding = CodeUnderstanding(
                business_goal=business_goal,
                code_capabilities=code_capabilities,
                code_context=code_context,
                operations=operations,
                confidence_score=confidence,
                clarification_needed=clarification
            )

            # Convert to dict for JSON serialization
            return {
                "success": True,
                "understanding": understanding.dict(),
                "search_terms": extract_search_terms(query),
                "engine": "mock" if self.use_mock else "anthropic"
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "query": query
            }

    def parse_from_json(self, input_json: str) -> Dict[str, Any]:
        """Parse intent from JSON input (for CLI usage)"""
        try:
            data = json.loads(input_json)
            return self.parse_code_intent(
                query=data.get("query", ""),
                repository=data.get("repository", ""),
                ticket_key=data.get("ticket_key"),
                ticket_summary=data.get("ticket_summary"),
                ticket_description=data.get("ticket_description"),
                branch=data.get("branch", "main"),
                language=data.get("language"),
                recent_files=data.get("recent_files")
            )
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"Invalid JSON: {str(e)}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


def main():
    """CLI entry point - reads JSON from stdin, outputs JSON to stdout"""
    if len(sys.argv) > 1 and sys.argv[1] == "--help":
        print("""
Code Intent Service - Semantic parser for code queries

Usage:
  echo '{"query": "Where is authentication?", "repository": "owner/repo"}' | python code_intent_service.py
  python code_intent_service.py --mock < input.json

Options:
  --mock    Use mock AI engine (faster, no API key needed)
  --help    Show this help message

Input JSON format:
  {
    "query": "string (required)",
    "repository": "owner/repo (required)",
    "ticket_key": "PROJ-123 (optional)",
    "ticket_summary": "string (optional)",
    "ticket_description": "string (optional)",
    "branch": "main (default)",
    "language": "javascript (optional)",
    "recent_files": ["path/to/file.js"] (optional)
  }

Output JSON format:
  {
    "success": true,
    "understanding": {
      "business_goal": "string",
      "code_capabilities": ["code_search", "explain_code"],
      "code_context": {...},
      "operations": [{...}],
      "confidence_score": 0.85,
      "clarification_needed": null
    },
    "search_terms": ["auth", "authentication"],
    "engine": "anthropic|mock"
  }
        """)
        sys.exit(0)

    # Check for mock mode
    use_mock = "--mock" in sys.argv

    # Initialize service
    service = CodeIntentService(use_mock=use_mock)

    # Read from stdin
    input_data = sys.stdin.read()

    # Parse and output
    result = service.parse_from_json(input_data)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
