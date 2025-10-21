"""
Code-specific capability extensions for semantic parser
Adds code-indexer operations to the semantic understanding framework
"""

from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class CodeCapability(str, Enum):
    """Code-specific capabilities for the indexer"""
    CODE_SEARCH = "code_search"
    EXPLAIN_CODE = "explain_code"
    FIND_IMPLEMENTATION = "find_implementation"
    TRACE_DEPENDENCIES = "trace_dependencies"
    FIND_USAGES = "find_usages"
    ANALYZE_COMPLEXITY = "analyze_complexity"
    SUGGEST_REFACTOR = "suggest_refactor"
    FIND_BUGS = "find_bugs"
    GENERATE_DOCS = "generate_docs"
    FIND_SIMILAR_CODE = "find_similar_code"


class CodeContext(BaseModel):
    """Enhanced context for code operations"""
    repository: str = Field(..., description="Repository name (owner/repo)")
    branch: Optional[str] = Field("main", description="Git branch")
    ticket_key: Optional[str] = Field(None, description="JIRA ticket key")
    ticket_summary: Optional[str] = Field(None, description="JIRA ticket summary")
    ticket_description: Optional[str] = Field(None, description="JIRA ticket description")
    file_patterns: List[str] = Field(default_factory=list, description="File glob patterns to search")
    language: Optional[str] = Field(None, description="Programming language")
    recent_files: List[str] = Field(default_factory=list, description="Recently viewed files")


class CodeOperation(BaseModel):
    """A specific code operation to execute"""
    operation_type: CodeCapability = Field(..., description="Type of operation")
    query: str = Field(..., description="Search query or description")
    scope: Optional[str] = Field(None, description="Directory/file scope")
    filters: Dict[str, Any] = Field(default_factory=dict, description="Additional filters")
    priority: int = Field(1, description="Execution priority (1=highest)")


class CodeUnderstanding(BaseModel):
    """Enhanced understanding for code queries"""
    business_goal: str = Field(..., description="What the user is trying to accomplish")
    code_capabilities: List[CodeCapability] = Field(..., description="Required code operations")
    code_context: CodeContext = Field(..., description="Code-specific context")
    operations: List[CodeOperation] = Field(..., description="Suggested operations to execute")
    confidence_score: float = Field(..., description="Confidence in understanding (0-1)")
    clarification_needed: Optional[str] = Field(None, description="What needs clarification")


# Capability to operation mapping
CAPABILITY_OPERATIONS = {
    CodeCapability.CODE_SEARCH: {
        "keywords": ["find", "search", "locate", "where is", "show me"],
        "file_hints": [],
        "operation": "search"
    },
    CodeCapability.EXPLAIN_CODE: {
        "keywords": ["explain", "how does", "what does", "understand", "describe"],
        "file_hints": [],
        "operation": "explain"
    },
    CodeCapability.FIND_IMPLEMENTATION: {
        "keywords": ["implementation", "implemented", "code for", "logic for"],
        "file_hints": ["**/services/**", "**/lib/**", "**/src/**"],
        "operation": "search"
    },
    CodeCapability.TRACE_DEPENDENCIES: {
        "keywords": ["dependencies", "depends on", "uses", "imports", "requires"],
        "file_hints": ["**/package.json", "**/requirements.txt", "**/go.mod"],
        "operation": "trace"
    },
    CodeCapability.FIND_USAGES: {
        "keywords": ["used by", "calls", "references", "usage of"],
        "file_hints": [],
        "operation": "find_references"
    },
    CodeCapability.ANALYZE_COMPLEXITY: {
        "keywords": ["complexity", "performance", "optimize", "slow"],
        "file_hints": [],
        "operation": "analyze"
    },
    CodeCapability.SUGGEST_REFACTOR: {
        "keywords": ["refactor", "improve", "clean up", "better way"],
        "file_hints": [],
        "operation": "refactor"
    },
    CodeCapability.FIND_BUGS: {
        "keywords": ["bug", "error", "issue", "problem", "broken", "not working"],
        "file_hints": [],
        "operation": "debug"
    },
    CodeCapability.GENERATE_DOCS: {
        "keywords": ["document", "docs", "documentation", "comments"],
        "file_hints": ["**/README.md", "**/docs/**"],
        "operation": "generate_docs"
    },
    CodeCapability.FIND_SIMILAR_CODE: {
        "keywords": ["similar", "like this", "duplicate", "same as"],
        "file_hints": [],
        "operation": "find_similar"
    }
}


# Common code patterns for different languages
LANGUAGE_PATTERNS = {
    "javascript": {
        "function": r"function\s+\w+|const\s+\w+\s*=\s*\(.*\)\s*=>",
        "class": r"class\s+\w+",
        "import": r"import\s+.*from|require\(",
        "export": r"export\s+(default\s+)?(function|class|const)"
    },
    "python": {
        "function": r"def\s+\w+\(",
        "class": r"class\s+\w+:",
        "import": r"(from\s+\S+\s+)?import\s+",
        "export": r"__all__\s*=|^[A-Z_]+\s*="
    },
    "typescript": {
        "function": r"function\s+\w+|const\s+\w+\s*=\s*\(.*\)\s*=>",
        "class": r"class\s+\w+",
        "interface": r"interface\s+\w+",
        "type": r"type\s+\w+\s*=",
        "import": r"import\s+.*from",
        "export": r"export\s+(default\s+)?(function|class|const|interface|type)"
    },
    "go": {
        "function": r"func\s+\w+\(",
        "struct": r"type\s+\w+\s+struct",
        "interface": r"type\s+\w+\s+interface",
        "import": r"import\s+\(",
        "export": r"^func\s+[A-Z]"
    }
}


def infer_capability_from_query(query: str) -> List[CodeCapability]:
    """Infer code capabilities from natural language query"""
    query_lower = query.lower()
    capabilities = []

    for capability, config in CAPABILITY_OPERATIONS.items():
        if any(keyword in query_lower for keyword in config["keywords"]):
            capabilities.append(capability)

    # Default to code search if no match
    if not capabilities:
        capabilities.append(CodeCapability.CODE_SEARCH)

    return capabilities


def extract_file_patterns(query: str, ticket_description: Optional[str] = None) -> List[str]:
    """Extract file patterns from query and ticket context"""
    patterns = []
    query_lower = query.lower()

    # Common file type keywords
    file_mappings = {
        "component": ["**/components/**", "**/ui/**"],
        "service": ["**/services/**", "**/api/**"],
        "model": ["**/models/**", "**/entities/**"],
        "database": ["**/db/**", "**/migrations/**", "**/schema/**"],
        "auth": ["**/auth/**", "**/security/**"],
        "api": ["**/api/**", "**/routes/**", "**/controllers/**"],
        "test": ["**/*.test.*", "**/*.spec.*", "**/tests/**"],
        "config": ["**/config/**", "**/*.config.*"],
        "util": ["**/utils/**", "**/helpers/**", "**/lib/**"]
    }

    for keyword, file_patterns in file_mappings.items():
        if keyword in query_lower:
            patterns.extend(file_patterns)

    # Extract from ticket description
    if ticket_description:
        ticket_lower = ticket_description.lower()
        for keyword, file_patterns in file_mappings.items():
            if keyword in ticket_lower:
                patterns.extend(file_patterns)

    return list(set(patterns))  # Remove duplicates


def extract_search_terms(query: str) -> List[str]:
    """Extract key search terms from query"""
    # Remove common question words
    stop_words = {"what", "where", "how", "is", "are", "the", "a", "an", "in", "on", "for", "to", "of", "this", "that"}

    words = query.lower().split()
    terms = [w for w in words if w not in stop_words and len(w) > 2]

    # Look for quoted terms (exact match)
    exact_matches = []
    if '"' in query:
        parts = query.split('"')
        for i in range(1, len(parts), 2):
            exact_matches.append(parts[i])

    return exact_matches + terms[:5]  # Limit to top 5 terms


def create_code_operations(
    capabilities: List[CodeCapability],
    query: str,
    context: CodeContext
) -> List[CodeOperation]:
    """Create executable operations from capabilities"""
    operations = []

    for i, capability in enumerate(capabilities):
        config = CAPABILITY_OPERATIONS.get(capability, {})

        operation = CodeOperation(
            operation_type=capability,
            query=query,
            scope=context.file_patterns[0] if context.file_patterns else None,
            filters={
                "language": context.language,
                "patterns": context.file_patterns,
                "search_terms": extract_search_terms(query)
            },
            priority=i + 1
        )

        operations.append(operation)

    return operations
