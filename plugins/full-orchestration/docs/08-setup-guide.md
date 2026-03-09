# 08 — Setup & Configuration Guide

This guide covers everything you need to install and configure the `full-orchestration` plugin so the `/swe` pipeline works end-to-end.

## Prerequisites

Before installing the plugin, make sure the following tools are available on your system:

| Prerequisite | Why it's needed | Verify |
|---|---|---|
| **Claude Code CLI** | Runtime for the plugin | `claude --version` |
| **`gh` CLI** | GitHub Issues intake (Stage 1), PR creation (Stage 5) | `gh --version` |
| **`gh` authenticated** | API access to your repos | `gh auth status` |
| **Git** | Branch creation, commits | `git --version` |
| **Project test runner** | TDD stage needs to run tests | `pytest --version`, `npx jest --version`, `go test`, etc. |

The test runner does not need to be globally installed — it just needs to be runnable from your project root via the command that your project normally uses.

## Plugin Installation

```
/plugin install full-orchestration@ghcp-dev-plugin
```

This registers the `/swe` skill, orchestration agents, and pipeline hooks with Claude Code.

## MCP Server Setup (Ticketing Systems)

The pipeline fetches ticket data in Stage 1. Which MCP server you need depends on where your tickets live.

### Jira (Atlassian MCP)

```bash
claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse
```

**Authentication:**

1. Generate an Atlassian API token at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens).
2. When prompted by the MCP server, provide your Atlassian email and the API token.

**Required scopes:**
- `read:jira-work` — read issue details, descriptions, and comments
- `read:jira-user` — resolve assignee and reporter names

**Test the connection:**

```bash
# Inside a Claude Code session:
# Ask Claude to fetch a known ticket
/swe PROJ-1
# Stage 1 should display the ticket summary without errors
```

### Linear (Official MCP)

```bash
claude mcp add --transport sse linear-server https://mcp.linear.app/sse
```

**Authentication:**

1. Create a Linear API key at **Settings > API > Personal API keys** in the Linear app.
2. Provide the key when the MCP server prompts for authentication.

**Test the connection:**

```bash
# Inside a Claude Code session:
/swe LIN-42
# Stage 1 should display the Linear issue summary
```

### GitHub Issues

No additional setup required. The pipeline uses `gh issue view` under the hood, which is available as long as `gh` is authenticated.

```bash
# Verify gh can read issues in your repo:
gh issue view 1
```

### Generic REST API

For custom or self-hosted ticketing systems, the pipeline can fall back to `curl` via Bash. Provide the ticket data as a JSON response from any REST endpoint.

**Example — fetching from a generic endpoint:**

```bash
# The pipeline will use a pattern like this internally:
curl -s -H "Authorization: Bearer $TICKET_API_TOKEN" \
  https://tickets.example.com/api/v1/issues/TICKET-123
```

To use this approach:
1. Set the `TICKET_API_TOKEN` environment variable (or whichever auth header your system requires).
2. When invoking `/swe`, pass the full ticket URL or ID so the orchestrator can construct the API call.

## Dependency Plugins

The pipeline delegates Stage 4 (Code Review) to a separate plugin. Install it alongside `full-orchestration`:

```bash
/plugin install deep-review@ghcp-dev-plugin    # Stage 4: Multi-agent adversarial code review
```

This is optional — the pipeline will warn you at the relevant stage if the dependency plugin is missing, but it will not block earlier stages. Stage 5 (PR Creation) uses the `gh` CLI directly and has no plugin dependency.

## Configuration Options

The pipeline uses sensible defaults. Override them by setting values in your project's `CLAUDE.md` or by passing flags to `/swe`.

| Option | Default | Description |
|---|---|---|
| Spec storage | `.claude/specs/` | Where generated specs and implementation plans are written |
| Pipeline state | `.claude/swe-state/` | Stage transition state, approval records, and logs |
| Default ticketing system | Auto-detected from ticket ID format | `jira`, `linear`, `github`, or `generic` |
| Branch naming | `feat/<ticket-id>` | Convention for feature branches created by the pipeline |
| Review iteration limit | `5` | Maximum review-fix cycles before the pipeline stops and asks for help |

## Verification

After installation, verify that all dependencies are in place:

```bash
claude /swe --check
```

This runs a preflight check that validates:
- Claude Code CLI is operational
- `gh` CLI is installed and authenticated
- Git is available and the current directory is a repository
- MCP servers are reachable (if configured)
- Dependency plugin (`deep-review`) is installed
- A test runner is detected for the current project

A green checkmark appears next to each passing check. Any failures include a remediation hint.

## Troubleshooting

### MCP connection failures

**Symptom:** Stage 1 fails with "MCP server unreachable" or times out.

**Fixes:**
- Verify the MCP server is registered: `claude mcp list`
- Re-add the server: `claude mcp remove atlassian && claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse`
- Check that your API token has not expired
- Confirm network access to the MCP endpoint (corporate proxies may block SSE connections)

### Missing `gh` authentication

**Symptom:** Stage 1 (GitHub Issues) or Stage 5 (PR creation) fails with "auth required."

**Fix:**
```bash
gh auth login
gh auth status  # Confirm the correct account and scopes
```

### Plugin not found

**Symptom:** `/swe` is not recognized as a skill.

**Fixes:**
- Re-install: `/plugin install full-orchestration@ghcp-dev-plugin`
- Confirm the plugin directory contains `.claude-plugin/plugin.json`
- Check that the skill file exists at `plugins/full-orchestration/skills/swe/SKILL.md`

### Test runner not detected

**Symptom:** Stage 3 (TDD) cannot run tests.

**Fixes:**
- Make sure your project's test command works from the repository root (e.g., `pytest`, `npm test`, `go test ./...`)
- If you use a non-standard test command, add it to your project's `CLAUDE.md` so the TDD agent can discover it:
  ```markdown
  ## Testing
  Run tests with: `make test`
  ```

