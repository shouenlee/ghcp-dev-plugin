# /review - Code Review

Review code for bugs, security issues, performance problems, and readability improvements.

## Usage

```
/review [file or directory]
```

## Instructions

When the user invokes `/review`, perform a thorough code review of the specified file, directory, or the most recently edited files if no target is given.

### Review Categories

Analyze the code across these dimensions and report findings grouped by category:

1. **Bugs** - Logic errors, off-by-one errors, null/undefined access, race conditions, unhandled edge cases
2. **Security** - Injection vulnerabilities (SQL, XSS, command), hardcoded secrets, insecure defaults, missing input validation
3. **Performance** - Unnecessary allocations, N+1 queries, missing indexes, blocking operations, inefficient algorithms
4. **Readability** - Unclear naming, overly complex functions, missing or misleading comments, inconsistent style

### Output Format

For each finding, report:
- **File and line number** (e.g., `src/auth.ts:42`)
- **Severity**: Critical, Warning, or Info
- **Category**: Bug, Security, Performance, or Readability
- **Description**: What the issue is and why it matters
- **Suggestion**: How to fix it, with a code snippet when helpful

### Behavior

- If no file or directory is specified, review files changed in the current git working tree (`git diff --name-only` and `git diff --cached --name-only`).
- Skip binary files, lock files, and generated files.
- Prioritize findings by severity (Critical first).
- At the end, provide a brief summary with counts by category and severity.
