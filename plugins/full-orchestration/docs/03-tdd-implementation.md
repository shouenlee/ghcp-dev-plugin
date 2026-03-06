# Stage 3: TDD Implementation

## Purpose

Stage 3 takes the approved technical spec and implementation doc from Stage 2 and implements the changes following strict test-driven development. A `TddEngineer` agent works on a dedicated feature branch, writing failing tests first, then implementing the minimal code to pass them, and finally refactoring while keeping all tests green.

This stage is mechanical by design. All design decisions were made in Stage 2. The implementation doc provides exact file paths, function signatures, test cases with inputs/outputs, and a step-by-step order. The TDD agent executes this plan without improvising.

## Input

- Approved technical spec: `.claude/specs/{ticket-id}.md`
- Approved implementation doc: `.claude/specs/{ticket-id}-impl.md`
- Codebase context: `.claude/specs/{ticket-id}-context.md`

## Output

- All changes committed on the current branch
- All new and existing tests passing
- Implementation summary for Stage 4 (code review)

---

## Options Comparison

| Criteria | A: Single `TddEngineer` agent | B: Team (test-writer + implementer) | C: Iterative loop (one test at a time) |
|---|---|---|---|
| **Implementation effort** | Low — one agent, one skill | Medium — coordination between two agents | Medium — loop orchestration |
| **Context coherence** | High — single agent sees full picture | Lower — handoff between agents loses context | Medium — narrow focus per iteration |
| **Speed** | Fast — no inter-agent communication | Slower — synchronization overhead | Slowest — serial execution |
| **TDD discipline** | Good — agent follows red/green/refactor | Best — enforced separation of concerns | Best — one test at a time |
| **Error recovery** | Simple — single agent retries | Complex — which agent owns the fix? | Simple — retry current iteration |
| **Recommendation** | **RECOMMENDED** | Over-engineered | Too slow for most tasks |

**Decision:** Option A — a single `TddEngineer` agent that follows the red/green/refactor cycle. The implementation doc from Stage 2 already provides the test plan, so splitting test-writing from implementation adds coordination cost without meaningful quality gain.

---

## `TddEngineer` Agent Specification

### Overview

The `TddEngineer` agent is responsible for the full implementation cycle. It reads the approved spec and implementation doc and executes the implementation plan step by step using TDD on the current branch.

### Workflow

```
Read approved spec + implementation doc
    │
    ▼
Confirm current branch
    │
    ▼
For each step in implementation order:
    │
    ├── RED: Write failing test(s) for this step
    │     └── Run tests → verify they FAIL
    │
    ├── GREEN: Write minimal implementation code
    │     └── Run tests → verify they PASS
    │
    ├── REFACTOR: Clean up code while keeping tests green
    │     └── Run tests → verify they still PASS
    │
    └── COMMIT: Commit with descriptive message
          └── Format: "feat({scope}): {what} [TDD step N/{total}]"
    │
    ▼
Run full test suite for regressions
    │
    ▼
Produce implementation summary
```

### Red Phase (Write Failing Tests)

For each step in the implementation plan, the agent:

1. Reads the test cases from the implementation doc (Section 5: Test Plan)
2. Writes test files at the paths specified in the implementation doc
3. Uses existing test fixtures, mocks, and patterns identified by the Test Explorer in Stage 2A
4. Runs the tests to confirm they fail for the expected reason (not due to syntax errors or import issues)
5. If tests fail for unexpected reasons, diagnoses and fixes the test before proceeding

### Green Phase (Minimal Implementation)

The agent:

1. Implements the minimal code needed to make the failing tests pass
2. Follows the function signatures and type definitions from the implementation doc (Sections 2-3)
3. Does not add functionality beyond what the tests require
4. Runs the tests to confirm they pass
5. If tests still fail, iterates on the implementation (not the tests)

### Refactor Phase

The agent:

1. Cleans up the implementation while keeping all tests green
2. Removes duplication, improves naming, extracts helpers if needed
3. Ensures the code follows patterns identified by the Pattern Explorer in Stage 2A
4. Runs the full test suite (not just the current step's tests) to catch regressions
5. Commits the refactored code

### Implementation Summary

After all steps are complete, the agent produces a summary:

```markdown
# Implementation Summary: {ticket-id}

## Branch
{current branch name}

## Changes
| File | Lines Changed | Description |
|---|---|---|

## Test Results
- New tests: N
- Modified tests: N
- Total test suite: PASS/FAIL
- Coverage: X% (if available)

## Deviations from Plan
- Any differences from the implementation doc, with rationale

## Notes for Review
- Areas that need extra scrutiny in Stage 4
- Trade-offs made during implementation
```

---

## Feature Branch Strategy

The user should create a feature branch and invoke `/swe` from it with a clean working tree (no uncommitted changes). The `TddEngineer` agent works directly on the current branch.

### How It Works

1. The user creates a feature branch before invoking `/swe`
2. The agent works on the current branch — it does not create or switch branches
3. All file edits, test runs, and commits happen on the current branch
4. After implementation completes, the branch is available for Stage 4 review

---

## Language-Specific Test Runners

The `TddEngineer` agent detects the project's language and test framework to run tests correctly.

| Language | Test Runner | Command | Config File |
|---|---|---|---|
| Python | pytest | `pytest` | `pyproject.toml`, `pytest.ini`, `setup.cfg` |
| JavaScript/TypeScript | Jest | `npx jest` | `jest.config.js`, `package.json` |
| JavaScript/TypeScript | Vitest | `npx vitest run` | `vitest.config.ts`, `vite.config.ts` |
| JavaScript/TypeScript | Mocha | `npx mocha` | `.mocharc.yml`, `package.json` |
| Go | go test | `go test ./...` | `go.mod` |
| Rust | cargo test | `cargo test` | `Cargo.toml` |
| Java | JUnit (Maven) | `mvn test` | `pom.xml` |
| Java | JUnit (Gradle) | `gradle test` | `build.gradle` |
| Ruby | RSpec | `bundle exec rspec` | `.rspec`, `Gemfile` |
| Ruby | Minitest | `ruby -Itest` | `Gemfile` |
| C# | dotnet test | `dotnet test` | `*.csproj`, `*.sln` |
| PHP | PHPUnit | `vendor/bin/phpunit` | `phpunit.xml` |
| Elixir | ExUnit | `mix test` | `mix.exs` |
| Swift | XCTest | `swift test` | `Package.swift` |

The agent detects the runner by checking for config files in priority order. If multiple runners are present, it uses the one matching the project's primary test configuration.

---

## Hook Suggestion

To maintain TDD discipline and catch regressions immediately, the plugin suggests an `after_edit` hook that runs relevant tests after every file modification:

```json
{
  "hooks": [
    {
      "event": "after_edit",
      "pattern": "\\.(py|js|ts|go|rs|java|rb)$",
      "action": "suggest",
      "message": "Source file modified. Run tests to verify your changes."
    }
  ]
}
```

This hook fires after edits to source files (not test files) and suggests running the detected test command. It uses `"action": "suggest"` rather than `"action": "run"` to keep the user in control.

---

## Error Handling

### Test Failures

| Scenario | Agent Behavior |
|---|---|
| Red phase: test fails for wrong reason (syntax error, missing import) | Fix the test, re-run to confirm correct failure |
| Green phase: test still fails after implementation | Iterate on implementation (max 5 attempts), then report blocker |
| Refactor phase: previously passing test fails | Revert refactor, commit pre-refactor code, note in summary |
| Full suite: unrelated test fails | Investigate if change caused it; if not, note as pre-existing failure |

### Compilation Errors

If the project uses a compiled language, compilation errors during the green phase are treated as test failures. The agent iterates on the implementation to resolve them before proceeding.

### Dependency Issues

If new dependencies are needed (identified in the implementation doc):

1. Install the dependency using the project's package manager
2. Commit the dependency change separately: `chore: add {package} dependency`
3. Continue with the TDD cycle

If an unexpected dependency issue arises (missing transitive dependency, version conflict):

1. Attempt to resolve using the package manager's resolution mechanism
2. If unresolvable, report as a blocker with details for the user

### Max Retry Policy

Each TDD step has a maximum of 5 implementation attempts. If the agent cannot make the tests pass after 5 tries, it:

1. Commits the current state with a `WIP:` prefix
2. Adds a detailed note to the implementation summary explaining the blocker
3. Continues to the next step if possible, or halts and reports to the user

---

## Cross-References

- **Stage 2 (Spec & Design):** Provides the technical spec, implementation doc, and test plan that this stage executes. See [02-spec-design.md](02-spec-design.md).
- **Stage 4 (Code Review):** Reviews the implementation produced by this stage using adversarial multi-perspective review. See [04-code-review.md](04-code-review.md).
- **Stage 1 (Ticket Intake):** The ticket ID used for branch naming and spec file paths originates here. See [01-ticket-intake.md](01-ticket-intake.md).
- **Stage 5 (PR Creation):** Creates the pull request from the feature branch produced by this stage. See [05-pr-creation.md](05-pr-creation.md).
