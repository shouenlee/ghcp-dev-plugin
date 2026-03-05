---
name: task_breakdown
description: 'Decomposes feature descriptions or GitHub issues into ordered subtasks with file-level scope, acceptance criteria, and optional gh issue create. Use when asked to "break down task", "decompose feature", "create subtasks", "plan implementation", "break this into tasks", "task list", or "implementation plan".'
---

# Task Breakdown

Decompose feature descriptions or GitHub issues into ordered implementation subtasks with file-level scope, acceptance criteria, and dependency ordering.

## When to Use

- You have a feature description or GitHub issue that needs to be broken into actionable subtasks
- You want to plan an implementation with clear ordering and dependencies
- You need to create GitHub issues for each subtask in a larger feature
- You want to estimate complexity and scope before starting work

## Prerequisites

- A feature description, GitHub issue number, or branch/PR to analyze
- `gh` CLI installed and authenticated (required only for fetching issues and creating subtasks as issues)

## Workflow

1. **Gather the feature or task** to decompose:
   - If the user provides a GitHub issue number, fetch it:
     ```bash
     gh issue view <number> --json title,body,labels,comments
     ```
   - If the user provides a description, use it directly
   - If the user provides a branch name or PR, analyze the scope from the diff or description

2. **Analyze the codebase** to understand:
   - Which files and modules will need changes
   - Dependencies between components
   - Existing patterns for similar features
   - Test infrastructure and conventions

3. **Break down into ordered subtasks**, each including:
   - **Title**: Clear, imperative-mood description (e.g., "Add User model with email and password fields")
   - **Files**: Specific files to create or modify
   - **Acceptance criteria**: Measurable conditions for "done"
   - **Dependencies**: Which other subtasks must complete first
   - **Estimated complexity**: Small / Medium / Large

4. **Order subtasks by dependency** (foundation first, integration last):
   - Data models and schemas first
   - Business logic and services next
   - API endpoints / views
   - Tests alongside or after implementation
   - Documentation and cleanup last

5. **Present the breakdown** as a numbered list for the user to review.

6. **Offer to create GitHub issues** for each subtask:
   ```bash
   gh issue create --title "<title>" --body "<body with acceptance criteria>"
   ```
   - Add labels if specified
   - Set up issue references between dependent tasks

7. **Optionally create a tracking issue** that links to all subtasks so progress can be monitored from a single place.

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| Issue not found | The issue number does not exist or `gh` is not authenticated | Verify the issue number and run `gh auth status` to check authentication |
| Scope too vague | The feature description lacks enough detail to identify files | Ask the user clarifying questions about expected behavior, affected components, and constraints |
| Circular dependencies | Two subtasks depend on each other | Merge the coupled subtasks into one or extract the shared concern into a separate subtask that both depend on |
