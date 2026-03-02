# Addressing PR Review Feedback

Help PR authors understand and address reviewer feedback through **local code changes**.
The author handles all PR interaction: pushing commits, replying to threads, resolving.

## Workflow Overview

```
1. Fetch PR comments           - Understand what reviewers want
2. Check local/PR sync         - Can changes be made directly?
3. Investigate concerns        - Find evidence for/against
4. Make local code changes     - Address valid concerns
5. Summarize for author        - What changed and why
   -------------------------------------------------------
6. Author reviews changes      - (outside scope)
7. Author pushes and responds  - (outside scope)
```

## Local/PR Sync Check

Before making code changes, verify the local branch matches the PR.

**Check local HEAD:**
```bash
git log -1 --format=%H
git branch --show-current
```

**Compare against the PR's latest source commit** (from `gh pr view` output).

| Local vs PR | Meaning | Action |
|-------------|---------|--------|
| **In sync** | Local HEAD matches PR tip | Can address feedback directly |
| **Local behind** | PR has commits not in local | Inform user - they may want to pull first |
| **Local ahead** | Local has unpushed commits | Inform user - changes exist that reviewers haven't seen |
| **Diverged** | Both have unique commits | Inform user - situation needs their attention |

**Do not** attempt to automatically sync branches.
Just report the state and let the author decide how to proceed.

## Understanding Reviewer Concerns

### Comment Categories

| Type | Signals | What's Needed |
|------|---------|---------------|
| **Blocking** | "Needs Work" vote, explicit blocking language | Must address before merge |
| **Questions** | "Why did you...", "What happens if..." | Clarification or code comment |
| **Suggestions** | "Consider...", "You could...", non-blocking | Evaluate trade-offs |
| **Nitpicks** | "Nit:", style preferences | Optional improvements |

Understanding the category helps prioritize effort.

## Reviewer-First Investigation

When a reviewer raises a concern, approach it as a truth-seeking exercise - not as defending the author's code.

### 1. Assume the Reviewer Might Be Right

They've spent time understanding the code and identified something worth questioning.
Start from their perspective.

### 2. Find Evidence Supporting the Reviewer

Before defending the current approach, actively try to validate the reviewer's concern:

```bash
# If reviewer questions error handling
grep -rn "catch\|throw\|error" src/module/  # Does error handling exist?

# If reviewer suggests different approach
# Actually read the alternative and check if it works

# If reviewer questions necessity
grep -rn "functionName" --include="*.ts"    # Is this really needed?
```

**Ask yourself:**
- What if the reviewer is right?
- What evidence would prove their concern valid?
- Have I actually tested their suggested alternative?

### 3. Find Evidence Supporting the Author's Decision

Only after genuinely attempting to validate the reviewer's position:

```bash
# Document why current approach is necessary
# Show the specific constraint that requires this choice
# Demonstrate the alternative fails (actually try it, don't assume)
```

### 4. Let Evidence Decide

| Investigation Result | Action |
|---------------------|--------|
| Reviewer's concern is valid | Make the suggested change |
| Concern is valid but different fix is better | Propose alternative with evidence |
| Author's approach is correct | Document the evidence for author's PR response |
| Unclear or trade-off | Present both sides, let author decide |

## Making Code Changes

### Before Changing

1. **Verify sync state** (see above)
2. **Understand the full context** - read surrounding code, not just the flagged line
3. **Check downstream impact** - grep for usages of what you're changing

### When Changing

Make minimal, focused changes that address the specific concern.
Don't refactor unrelated code or "improve" things the reviewer didn't mention.

### Verification

Before claiming a change works:

```bash
# Verify the change compiles/lints
# Run relevant tests (not the full suite - just affected areas)
# Re-read the modified file to confirm correctness
```

If the project has a build/test setup, use it.
If not, at minimum re-read the file and check for obvious issues.

## Summarizing for the Author

After investigation and any code changes, provide the author with:

### Summary Template

```markdown
## Addressed Reviewer Feedback

### Changed
- `{file}:{line}`: {what was changed} (reviewer was right - {brief evidence})

### Investigated, No Change Needed
- `{file}:{line}`: {reviewer concern}
  Evidence: {what you found that supports current code}

### For Your PR Response
- Re: {topic} - {talking point with evidence reference}
- Re: {topic} - {talking point}
```

**Key principles for the summary:**
1. **What you found** - evidence supporting reviewer or author
2. **What you changed** - specific files and why
3. **What you didn't change** - concerns you investigated but found author was correct
4. **Suggested responses** - brief talking points for PR replies (author writes actual responses)

---

See also: [Response Examples](../examples/response-examples.md) for calibrated example responses.
