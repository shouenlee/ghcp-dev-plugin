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

Fetch a ticket from any supported ticketing system, parse its requirements, and present a structured summary for user confirmation before proceeding to Stage 2 (Spec & Design). This is the entry point to the pipeline.

## Usage

```
/ticket_intake PROJ-123
/ticket_intake https://myorg.atlassian.net/browse/PROJ-123
/ticket_intake #42
/ticket_intake https://github.com/org/repo/issues/42
```

If no argument is provided, display the supported formats above and prompt the user to provide a ticket ID or URL.

---

## Prerequisites

This is Stage 1 — the pipeline entry point. The only requirement is a ticket ID or URL as argument.

---

## Phase 1: Accept Input & Auto-detect System

Parse the single argument provided by the user.

### Detection Rules

| Input Pattern | Detected System | Fetch Method |
|---|---|---|
| URL containing `atlassian.net` or `jira` | Jira | MCP tool call to `atlassian` server |
| URL containing `linear.app` | Linear | MCP tool call to `linear-server` |
| URL containing `github.com` | GitHub Issues | `gh issue view` |
| Bare `#N` or `owner/repo#N` | GitHub Issues | `gh issue view` |
| `PROJ-123` pattern (uppercase letters + hyphen + digits) | Jira (default) | MCP tool call to `atlassian` server |
| Unrecognized pattern | Unknown | Prompt user to specify system |

Extract the **ticket ID** from the input:
- From Jira URLs: the path segment after `/browse/` (e.g., `PROJ-123`)
- From Linear URLs: the issue identifier from the path
- From GitHub URLs: the issue number from the path (e.g., `42`)
- From bare `#N`: the number after `#`

---

## Phase 2: Fetch Ticket Data

Use the detected system to retrieve the ticket.

### Jira

Call the `atlassian` MCP server to fetch the issue:

```
MCP tool: atlassian_jira_get_issue
  issue_key: {ticket-id}
```

If the MCP server is not available, show the setup command:

```
Jira MCP server not configured. Set it up with:

  claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse

Then re-run: /ticket_intake {ticket-id}
```

### Linear

Call the `linear-server` MCP server to fetch the issue:

```
MCP tool: linear_get_issue
  issue_id: {ticket-id}
```

If the MCP server is not available, show the setup command:

```
Linear MCP server not configured. Set it up with:

  claude mcp add --transport sse linear-server https://mcp.linear.app/sse

Then re-run: /ticket_intake {ticket-id}
```

### GitHub Issues

No setup required. Fetch via `gh`:

```bash
gh issue view <number> --json title,body,comments,labels,assignees,milestone
```

If the issue is in a different repo, use `--repo owner/repo`.

### Generic REST

If the user specifies a custom system, ask them to provide either:
- A curl command that fetches the ticket data
- An API endpoint URL with auth headers

Execute the provided command and parse the JSON response.

---

## Phase 3: Extract Structured Fields

Parse the fetched ticket data and extract:

| Field | Source | Notes |
|---|---|---|
| **Title** | Title / summary field | Direct mapping |
| **Description** | Body / description field | Full text |
| **Acceptance Criteria** | Parsed from description | Look for `- [ ]` checkboxes, numbered lists after "Acceptance Criteria" or "AC" headings, or dedicated AC fields |
| **Comments** | Comments / discussion thread | Include author and timestamp |
| **Linked Issues** | Related issues, parent epics, blockers | Include relationship type |
| **Labels** | Tags, labels, categories | Direct mapping |
| **Priority** | Priority field | Map to High/Medium/Low if system uses numeric priorities |
| **Assignee** | Assignee field | Direct mapping |

If acceptance criteria are not in a separate field, extract them from the description by looking for:
- Lines starting with `- [ ]` or `- [x]`
- Numbered lists following headings containing "Acceptance Criteria", "AC", "Requirements", or "Definition of Done"
- Bullet lists in sections titled "Expected Behavior" or "Success Criteria"

---

## Phase 4: Identify Affected Areas

Search the codebase for keywords extracted from the ticket to surface likely areas of change.

1. Extract keywords from the ticket: file names, function names, module names, API endpoints, class names mentioned in the title, description, or acceptance criteria.
2. Use Grep and Glob to search the codebase for each keyword.
3. Categorize each match:

| Category | Meaning | Example |
|---|---|---|
| **existing** | File likely needs modification | `src/middleware/rate-limiter.ts` |
| **new** | File or module likely needs creation | Referenced but doesn't exist yet |
| **test** | Related test file | `tests/middleware/rate-limiter.test.ts` |

4. Deduplicate and rank by relevance (number of keyword hits).

---

## Phase 5: Present Summary & Initialize State

Display the structured summary to the user:

```
## Ticket Summary

**Source:** {System} — {ticket-id}
**Title:** {title}
**Priority:** {priority}
**Assignee:** {assignee}

### Requirements
1. {requirement 1}
2. {requirement 2}
3. ...

### Acceptance Criteria
- [ ] {criterion 1}
- [ ] {criterion 2}
- ...

### Linked Issues
- {linked-issue-id} ({relationship}: {title})

### Affected Codebase Areas
- {file-path} ({category}, {reason})
- ...

```

Ask the user to review the summary. They can edit requirements, add context, or confirm.

### On User Confirmation

1. Create the state directory: `.claude/swe-state/{ticket-id}/`
2. Write `.claude/swe-state/{ticket-id}/ticket.json` with all extracted fields:

```json
{
  "ticket_id": "{ticket-id}",
  "source": "{jira|linear|github|generic}",
  "url": "{original-url-or-null}",
  "title": "{title}",
  "description": "{description}",
  "acceptance_criteria": ["{criterion 1}", "{criterion 2}"],
  "comments": [{"author": "", "body": "", "timestamp": ""}],
  "linked_issues": [{"id": "", "relationship": "", "title": ""}],
  "labels": [],
  "priority": "{priority}",
  "assignee": "{assignee}",
  "affected_areas": [
    {"path": "", "category": "existing|new|test", "reason": ""}
  ]
}
```

3. Write or merge `.claude/swe-state/{ticket-id}.json` pipeline state:

```json
{
  "ticket_id": "{ticket-id}",
  "current_stage": "intake",
  "stages": {
    "intake": {
      "completed": true,
      "ticket_file": ".claude/swe-state/{ticket-id}/ticket.json"
    },
    "spec": { "completed": false },
    "implement": { "completed": false },
    "review": { "completed": false },
    "pr": { "completed": false }
  }
}
```

Read the existing state file first if it exists and merge — do not overwrite prior stage data.

---

## Error Handling

| Error | Behavior |
|-------|----------|
| Invalid ticket ID format | Display supported formats and prompt user to re-enter |
| MCP server not configured | Show the setup command for the detected system and offer to configure it |
| Authentication failure | Explain the auth requirement and link to MCP server docs |
| Ticket not found (404) | Report the ID and ask user to verify |
| Network timeout | Retry once, then report failure and suggest checking connectivity |
| Ambiguous system detection | List detected possibilities and ask user to choose |

---

## Artifacts Produced

| File | Contents |
|---|---|
| `.claude/swe-state/{ticket-id}/ticket.json` | Structured ticket data with all extracted fields |
| `.claude/swe-state/{ticket-id}.json` | Pipeline state with `stages.intake.completed = true` |

