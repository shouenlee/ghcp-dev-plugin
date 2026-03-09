# Review Protocol

Shared review method for all spec/plan reviewer agents.

## Review Method

You review by writing a structured comment file. Do NOT edit the document directly.

### Output

Write your comments as a JSON array to the comment file path provided in your prompt:

```json
[
  {
    "action": "add",
    "severity": "HIGH",
    "anchor": "unique text from the paragraph (10-50 chars)",
    "comment": "Your review comment"
  }
]
```

Fields:
- **action**: `add` | `reopen` | `remove`
- **severity**: `CRITICAL` | `HIGH` | `MEDIUM` | `LOW` (required for `add` and `reopen`)
- **anchor**: For `add` — a unique snippet from the paragraph you're commenting on. For `reopen`/`remove` — the full blockquote line to find (e.g., `> **[MEDIUM | {ReviewerName} | RESOLVED]** ...`)
- **comment**: Your review text (required for `add`, optional for `reopen` to update text, omit for `remove`)

Write an empty array `[]` if you find no issues.

### On Re-Review

When the document contains comments from prior iterations:
- **RESOLVED comments from you**: If fix is adequate, use `remove`. If not, use `reopen`.
- **OPEN comments from you**: No action needed (they persist). Use `remove` if no longer applicable.
- **Comments from other reviewers**: Ignore entirely.
- **New issues**: Use `add` as normal.

### What NOT To Do

- Do not edit the document directly (use the comment file only)
- Do not produce a standalone review narrative
- Do not comment on other reviewers' findings

Report when done: counts of add, reopen, and remove actions.
