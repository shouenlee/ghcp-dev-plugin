---
name: incident-triage
description: 'Triages production incidents — searches codebase for error origins, correlates with recent deploys, and generates structured postmortems. Use when asked to "triage incident", "investigate error", "production issue", "debug prod", "incident response", "recent deploys", "what broke", "postmortem", or "root cause analysis".'
---

# Incident Triage

Systematically investigates production incidents by tracing errors to their source, correlating with recent deploys, and generating structured postmortem documents.

## When to Use

- A production error or outage needs rapid investigation
- You need to correlate an error with recent code changes or deploys
- You want to check what was recently deployed and identify risky changes
- You need to generate a structured postmortem after an incident

## Prerequisites

- A git repository with commit history
- `gh` CLI for release and deploy information
- Error message, stack trace, or description of the production issue

## Workflow

### `/incident triage <error>` — Investigate an error

1. **Parse the error message/stack trace** provided by the user — extract exception classes, function names, file references, and error message strings.
2. **Search codebase for the error origin**:
   ```bash
   grep -r "ErrorMessageString" --include="*.py" --include="*.js" --include="*.ts" .
   grep -r "ExceptionClassName" --include="*.py" --include="*.js" --include="*.ts" .
   ```
   - Grep for error message strings, exception classes, and function names from the stack trace
   - Identify the file and line where the error originates
3. **Check recent changes** to the affected files:
   ```bash
   git log --oneline -10 -- <file>
   git diff HEAD~5..HEAD -- <file>
   ```
4. **Correlate with recent deploys**:
   ```bash
   git log --oneline -20 --since="3 days ago"
   ```
   - Check for recent tags or releases:
   ```bash
   git tag --sort=-creatordate | head -5
   ```
5. **Present findings**:
   - Error origin (file, line, function)
   - Recent changes to the affected area
   - Likely root cause
   - Suggested fix with code

### `/incident recent` — Check recent deploys

1. **List recent tags**:
   ```bash
   git tag --sort=-creatordate | head -10
   ```
2. **List recent releases**:
   ```bash
   gh release list --limit 5
   ```
3. **Show commits between last two tags**:
   ```bash
   git log <prev-tag>..<latest-tag> --oneline
   ```
4. **Highlight any risky changes** — migrations, config changes, dependency updates, large diffs.

### `/incident postmortem` — Generate postmortem

1. **Gather incident details** from the conversation or ask the user for:
   - Incident title and date
   - Duration and severity
   - Symptoms and impact
2. **Generate structured postmortem document**:
   ```markdown
   # Incident Postmortem: {Title}
   - **Date**: {date}
   - **Duration**: {duration}
   - **Severity**: {P0-P3}
   - **Author**: {author}

   ## Summary
   ## Impact
   ## Timeline
   ## Root Cause
   ## Resolution
   ## Action Items
   | Action | Owner | Due Date | Status |
   |--------|-------|----------|--------|
   ## Lessons Learned
   ```
3. **Save** to `docs/postmortems/` or user-specified location.
4. **Offer to create GitHub issues** for action items:
   ```bash
   gh issue create --title "<action item>" --body "<details>"
   ```

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| No recent tags found | Project does not use git tags for releases | Check `git log` for deploy commits or ask for deploy process details |
| Error message too vague | Insufficient information to trace | Ask user for full stack trace, affected endpoint, or reproduction steps |
| No git history available | Shallow clone or new repo | Run `git fetch --unshallow` or check CI/CD deploy logs externally |
| `gh` CLI not authenticated | Missing GitHub auth | Run `gh auth login` to authenticate |
