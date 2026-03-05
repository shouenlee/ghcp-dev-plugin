---
name: ticket_intake
description: >-
  Fetch and parse a ticket from Jira, Linear, or GitHub Issues.
  Use when starting work on a ticket, beginning a new feature,
  or when given a ticket ID or issue URL. Accepts a ticket ID
  or full URL as argument, auto-detects the ticketing system,
  and produces a structured requirements summary.
---

# Ticket Intake

**State file**: `.claude/swe-state/{ticket-id}.json`

Fetch a ticket, parse requirements, present a summary for user confirmation.

## Usage

```
/ticket_intake PROJ-123
/ticket_intake https://myorg.atlassian.net/browse/PROJ-123
/ticket_intake #42
```

---

## Phase 1: Detect System

| Input Pattern | System | Fetch Method |
|---|---|---|
| URL with `atlassian.net` or `jira` | Jira | MCP: `atlassian_jira_get_issue` |
| URL with `linear.app` | Linear | MCP: `linear_get_issue` |
| URL with `github.com`, or bare `#N` | GitHub | `gh issue view` |
| `PROJ-123` pattern | Jira (default) | MCP: `atlassian_jira_get_issue` |
| Unrecognized | Unknown | Prompt user |

Extract ticket ID from the input (Jira key from path, GitHub number, Linear ID).

---

## Phase 2: Fetch Ticket Data

**Jira**: `atlassian_jira_get_issue` with `issue_key`. If MCP unavailable:
```
claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse
```

**Linear**: `linear_get_issue` with `issue_id`. If MCP unavailable:
```
claude mcp add --transport sse linear-server https://mcp.linear.app/sse
```

**GitHub**: `gh issue view <N> --json title,body,comments,labels,assignees,milestone`

**Generic**: Ask user for a curl command or API endpoint.

---

## Phase 3: Extract Fields

Parse fetched data into structured fields: title, description, acceptance criteria, comments (with author/timestamp), linked issues, labels, priority, assignee.

For acceptance criteria, search the description for:
- `- [ ]` / `- [x]` checkboxes
- Numbered lists after "Acceptance Criteria", "AC", "Requirements", or "Definition of Done" headings
- Bullet lists under "Expected Behavior" or "Success Criteria"

---

## Phase 4: Identify Affected Areas

Extract keywords (file names, function names, endpoints, class names) from the ticket. Use Grep and Glob to search the codebase. Categorize matches as `existing` (needs modification), `new` (referenced but doesn't exist), or `test` (related test file). Deduplicate and rank by relevance.

---

## Phase 5: Present Summary & Write Ticket File

Display the summary (source, title, priority, requirements, acceptance criteria, linked issues, affected areas). Ask the user to review — they can edit, add context, or confirm.

On confirmation, write `.claude/swe-state/{ticket-id}/ticket.json`:

```json
{
  "ticket_id": "",
  "source": "jira|linear|github|generic",
  "url": "",
  "title": "",
  "description": "",
  "acceptance_criteria": [],
  "comments": [{"author": "", "body": "", "timestamp": ""}],
  "linked_issues": [{"id": "", "relationship": "", "title": ""}],
  "labels": [],
  "priority": "",
  "assignee": "",
  "affected_areas": [{"path": "", "category": "existing|new|test", "reason": ""}]
}
```

Then update pipeline state: set `stages.intake.completed = true`.
