# 01 — Stage 1: Ticket Intake

## Purpose

Fetch a ticket from any supported ticketing system, parse its requirements, and present a structured summary for user confirmation before proceeding to spec & design.

This is the entry point to the pipeline. The user provides a ticket ID or URL, and the skill handles detection, fetching, parsing, and summarization automatically.

## Supported Ticketing Systems

| Option | Setup Complexity | Setup Command | Notes |
|--------|-----------------|---------------|-------|
| Jira MCP (Atlassian official) | Low | `claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse` | Supports Jira Cloud |
| Linear MCP (official) | Low | `claude mcp add --transport sse linear-server https://mcp.linear.app/sse` | Built-in Linear support |
| GitHub Issues (gh CLI) | Zero | Already available | No setup needed, uses `gh issue view` |
| Generic REST (curl/Bash) | Medium | Custom per system | Works with any system that has an API |

## Skill Specification

```yaml
---
name: ticket_intake
description: >-
  Fetch and parse a ticket from Jira, Linear, or GitHub Issues.
  Use when starting work on a ticket, beginning a new feature,
  or when given a ticket ID or issue URL. Accepts a ticket ID
  or full URL as argument, auto-detects the ticketing system,
  and produces a structured requirements summary.
---
```

### Behavior

1. **Accept input** — Takes a ticket ID (e.g., `PROJ-123`, `#456`) or full URL as its argument.
2. **Auto-detect system** — Determines the ticketing system from the input:
   - URLs containing `atlassian.net` or `jira` → Jira MCP
   - URLs containing `linear.app` → Linear MCP
   - URLs containing `github.com` or bare `#N` / `owner/repo#N` → GitHub Issues via `gh`
   - Unrecognized patterns → prompt user to specify
3. **Fetch ticket data** — Retrieves via the appropriate method:
   - Jira: MCP tool call to `atlassian` server
   - Linear: MCP tool call to `linear-server`
   - GitHub: `gh issue view <number> --json title,body,comments,labels,assignees,milestone`
   - Generic: User-provided curl command or API endpoint
4. **Extract fields** — Pulls structured data from the response:
   - Title
   - Description / body
   - Acceptance criteria (parsed from description if not a separate field)
   - Comments and discussion
   - Linked issues / parent epics
   - Labels, priority, assignee
5. **Identify affected areas** — Searches the codebase for keywords extracted from the ticket (file names, function names, module references) to surface likely areas of change.
6. **Present summary** — Displays a structured summary and waits for user confirmation before the pipeline proceeds to Stage 2.

## Input Format

The skill receives a single argument: the ticket identifier.

```
/ticket_intake PROJ-123
/ticket_intake https://myorg.atlassian.net/browse/PROJ-123
/ticket_intake #42
/ticket_intake https://github.com/org/repo/issues/42
```

When invoked via the orchestrator (`/swe PROJ-123`), the orchestrator passes the ticket ID to this skill as Stage 1.

## Output Format

The skill produces a structured summary displayed to the user:

```
## Ticket Summary

**Source:** Jira — PROJ-123
**Title:** Add rate limiting to /api/v2/users endpoint
**Priority:** High
**Assignee:** @developer

### Requirements
1. Implement token-bucket rate limiting on the /api/v2/users endpoint
2. Default: 100 requests per minute per API key
3. Return 429 with Retry-After header when exceeded

### Acceptance Criteria
- [ ] Rate limiter is configurable per endpoint
- [ ] 429 responses include correct Retry-After header
- [ ] Existing tests continue to pass
- [ ] New tests cover rate limiting behavior

### Linked Issues
- PROJ-100 (parent epic: API Hardening)
- PROJ-118 (related: audit logging for rate limit events)

### Affected Codebase Areas
- src/middleware/rate-limiter.ts (existing, likely modification)
- src/routes/api/v2/users.ts (endpoint under change)
- tests/middleware/ (test directory)

```

The user reviews the summary and can edit requirements, add context, or confirm.

## Error Handling

| Error | Behavior |
|-------|----------|
| Invalid ticket ID format | Display supported formats and prompt user to re-enter |
| MCP server not configured | Show the setup command for the detected system and offer to configure it |
| Authentication failure | Explain the auth requirement and link to MCP server docs |
| Ticket not found (404) | Report the ID and ask user to verify |
| Network timeout | Retry once, then report failure and suggest checking connectivity |
| Ambiguous system detection | List detected possibilities and ask user to choose |

## Hook Suggestion

An `after_command` hook can suggest the `/swe` workflow when a user manually views a GitHub issue:

```json
{
  "hooks": [
    {
      "event": "after_command",
      "pattern": "^gh issue view",
      "action": "suggest",
      "message": "Tip: Use /swe to start the full software engineering pipeline for this ticket."
    }
  ]
}
```

This hook is defined in the plugin's top-level `hooks.json` and activates only when the plugin is installed.

## Cross-References

- [00 — System Overview](00-overview.md) — Where this stage fits in the pipeline
- [02 — Spec & Design](02-spec-design.md) — The next stage after ticket intake
- [06 — Orchestrator Skill](06-orchestrator.md) — How `/swe` invokes this skill
- [08 — Setup Guide](08-setup-guide.md) — MCP configuration details
