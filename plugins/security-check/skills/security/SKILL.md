# /security - Security Check

Scan code for hardcoded secrets, injection risks, and common vulnerabilities.

## Usage

```
/security [file or directory]
```

## Instructions

When the user invokes `/security`, perform a security-focused scan of the specified target or the entire project.

### What to Scan For

1. **Hardcoded Secrets**
   - API keys, tokens, passwords in source code
   - Private keys or certificates committed to the repo
   - Connection strings with embedded credentials
   - Patterns: strings matching `(?i)(api[_-]?key|secret|password|token|credential)\s*[=:]\s*["'][^"']+["']`

2. **Injection Risks**
   - SQL injection: string concatenation in queries instead of parameterized queries
   - Command injection: unsanitized input passed to shell commands
   - XSS: unescaped user input rendered in HTML
   - Path traversal: user input used in file paths without sanitization

3. **Insecure Configurations**
   - CORS set to `*` in production
   - Debug mode enabled in production configs
   - HTTP used where HTTPS should be
   - Disabled SSL/TLS verification
   - Overly permissive file permissions

4. **Dependency Concerns**
   - Known vulnerable dependency versions (check against common CVE databases)
   - Unused dependencies that increase attack surface

### Output Format

For each finding:
- **Location**: `file:line`
- **Severity**: Critical, High, Medium, Low
- **Type**: Secret, Injection, Config, Dependency
- **Finding**: What was found
- **Recommendation**: How to fix it

### Behavior

- If no target is specified, scan the entire project root.
- Skip `node_modules/`, `vendor/`, `.git/`, and other dependency directories.
- Skip binary files.
- Order results by severity (Critical first).
- End with a summary and an overall risk assessment (Pass / Needs Attention / Fail).
