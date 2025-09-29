# HeyJarvis Cursor Rules

This directory contains Cursor Rules that help AI assistants understand and work effectively with the HeyJarvis codebase.

## 📋 Available Rules

### Always Applied Rules
These rules are automatically applied to every AI conversation:

- **[project-structure.mdc](./project-structure.mdc)** - Project architecture and workspace organization
- **[development-workflow.mdc](./development-workflow.mdc)** - Development setup, commands, and environment

### File-Type Specific Rules
These rules apply to specific file types based on glob patterns:

- **[coding-standards.mdc](./coding-standards.mdc)** - Code style, patterns, and conventions (*.js, *.jsx, *.ts, *.tsx)
- **[error-handling.mdc](./error-handling.mdc)** - Error handling and logging patterns (*.js, *.jsx, *.ts, *.tsx)
- **[data-models.mdc](./data-models.mdc)** - Database models and repository patterns (*.schema.js, models/**, repositories/**)
- **[slack-integration.mdc](./slack-integration.mdc)** - Slack bot and Block Kit patterns (delivery/slack/**, blocks/**)

### Context-Specific Rules
These rules can be manually applied when working on specific features:

- **[ai-signal-processing.mdc](./ai-signal-processing.mdc)** - AI integration and signal processing patterns

## 🎯 How to Use

### For AI Assistants
These rules are automatically loaded by Cursor to provide context about:
- Project structure and architecture
- Coding standards and patterns
- Error handling conventions
- Database and API patterns
- Slack integration specifics

### For Developers
Reference these rules when:
- Onboarding new team members
- Establishing coding standards
- Implementing new features
- Debugging issues
- Integrating with external services

## 🔧 Rule Structure

Each rule follows the Cursor Rules format:
```markdown
---
alwaysApply: true|false
description: "Rule description"
globs: "file patterns"
---

# Rule Content
Markdown content with code examples and patterns
```

## 📚 Key Concepts Covered

- **Modular Architecture**: Workspace-based monorepo structure
- **Event-Driven Design**: EventEmitter patterns for component communication
- **Structured Logging**: Winston-based logging with consistent formats
- **Error Handling**: Comprehensive error tracking and retry logic
- **AI Integration**: Signal processing and relevance scoring
- **Database Patterns**: Supabase integration with schema validation
- **Slack Integration**: Block Kit UI and interactive components

## 🚀 Getting Started

1. **Read project-structure.mdc** - Understand the overall architecture
2. **Review coding-standards.mdc** - Learn the code patterns
3. **Check development-workflow.mdc** - Set up your environment
4. **Explore specific rules** - Based on what you're working on

These rules ensure consistent development practices and help AI assistants provide more accurate and contextual assistance when working with the HeyJarvis codebase.
