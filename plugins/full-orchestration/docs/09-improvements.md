# 09 — Workflow Improvements & Future Ideas

This document captures ideas for extending and improving the `full-orchestration` pipeline. These are not currently implemented — they represent directions the plugin could grow.

## Continuous Context / Learning Loop

The pipeline already writes specs and implementation plans to `.claude/specs/`. This creates an opportunity for a learning loop:

- **Historical reference** — When generating a new spec, the spec architect could scan past specs in the same repository to reuse architectural patterns and avoid repeating past mistakes.
- **Decision log** — Each spec records key decisions (e.g., "chose event-driven approach over polling"). Future tickets that touch the same area get this context automatically.
- **`/retro` skill** — A post-merge retrospective skill that asks: What went well? What caused review iterations? What was missed? Captures the answers in `.claude/specs/retros/` so the pipeline can learn from them over time.

## Parallel Exploration

Stage 2 already uses 3-5 explorer agents. This could be extended:

- **Adaptive explorer count** — Scale the number of explorers based on ticket complexity. A small bug fix needs 1-2 explorers; a cross-cutting feature might need 6-8.
- **Exploration budget** — Set a token or time budget per explorer to prevent runaway exploration on large codebases.
- **Shared discovery map** — Explorers write findings to a shared scratchpad so later explorers can skip areas already covered.

## Incremental Review

Currently, code review happens once at Stage 4, after all implementation is complete. An incremental approach would catch issues earlier:

- After each red-green-refactor cycle in Stage 3, run a lightweight lint-level check.
- Flag obvious issues (unused imports, naming violations, missing error handling) immediately.
- Reserve the full multi-agent adversarial review for the final Stage 4 pass.
- **Benefit:** Reduces the number of review iterations at Stage 4, since trivial issues are already resolved.

## Ticket Triage

A `/triage` skill that reads a batch of tickets and suggests an execution order:

- Parse a list of ticket IDs (e.g., `/triage PROJ-10 PROJ-11 PROJ-12 PROJ-13`).
- Analyze dependencies between tickets (does one require the other's changes?).
- Estimate relative complexity based on description length, number of affected components, and acceptance criteria count.
- Assess risk by looking for keywords like "breaking change," "migration," or "security."
- Output a prioritized list with rationale, suitable for sprint planning discussions.

## Status Updates

Automatically comment on the originating ticket at each stage transition:

| Stage transition | Comment posted |
|---|---|
| Ticket fetched | "Pipeline started — reading requirements" |
| Spec approved | "Technical spec created — beginning implementation" |
| Implementation complete | "Implementation complete — code review in progress" |
| Review passed | "Code review passed — creating PR" |
| PR opened | "PR #123 opened — ready for human review" |

This keeps stakeholders informed without anyone manually updating the ticket. Requires write access to the ticketing system (Jira: `write:jira-work` scope; Linear: write-enabled API key; GitHub: already available via `gh`).

## Rollback Plans

When the review loop hits the iteration limit (default: 5) without resolving all concerns:

- **Auto-create a sub-ticket** for unresolved review findings, linked to the original ticket.
- **Proceed with the PR anyway** if the unresolved items are non-critical (informational or low-severity findings).
- **Block the PR** only for critical or security findings.
- **Track resolution** — The sub-ticket ensures unresolved concerns are not lost, just deferred to a follow-up.

This prevents the pipeline from getting stuck on edge-case disagreements between review agents while still ensuring nothing is silently dropped.

## Alternative Orchestration Approaches

The current plugin uses a skill-based approach: `/swe` is a markdown skill that coordinates agents through Claude Code's built-in subagent system. Other approaches are possible:

| Approach | How it works | Strengths | Weaknesses |
|---|---|---|---|
| **Skill-based (current)** | Markdown skill invokes agents sequentially | Simple, no external dependencies, easy to modify | Linear flow, hard to parallelize stages |
| **MCP-based** | External MCP server manages pipeline state | Persistent state, resumable, language-agnostic | Requires running a server, more complex setup |
| **External workflow engine** | Tools like Temporal or Prefect drive the stages | Battle-tested orchestration, retries, observability | Heavy dependency, overkill for most projects |

**When to consider switching:**
- If you need durable, resumable pipelines across machine restarts, consider MCP-based orchestration.
- If you are running the pipeline in CI/CD (not interactively), an external workflow engine may be more appropriate.
- For interactive, developer-driven use, the current skill-based approach is the simplest and most portable.

## Advanced Customization

### Custom reviewer perspectives

The Stage 4 review currently uses three perspectives (skeptic, advocate, architect). Projects with domain-specific concerns could add custom reviewers:

- **Compliance reviewer** — checks for regulatory requirements (HIPAA, GDPR, SOC2)
- **Performance reviewer** — focuses on hot paths, allocations, and algorithmic complexity
- **Accessibility reviewer** — validates UI changes against WCAG guidelines

Custom reviewers would be defined as additional agent files in the `deep-review` plugin.

### Plugin composition

Stages can be swapped for project-specific alternatives:

- Replace `deep-review` with a lighter single-agent reviewer for small projects.
- Replace the `gh` CLI commands in `pr_create` with a GitLab-specific PR plugin.
- Skip Stage 1 entirely by passing requirements inline instead of a ticket ID.

### CI/CD integration

Run the pipeline (or individual stages) as part of a CI/CD job:

- Trigger `/swe` from a GitHub Action when a ticket is labeled "auto-implement."
- Use Stage 4 standalone as an automated code review gate on PRs.
- Post pipeline metrics (see below) to a dashboard.

## Metrics & Observability

Track pipeline performance to identify bottlenecks and improve over time:

| Metric | What it measures | Why it matters |
|---|---|---|
| Time per stage | Wall-clock duration of each stage | Identifies slow stages for optimization |
| Review iteration count | How many review-fix cycles before approval | High counts suggest specs need more detail |
| Common review feedback | Most frequent review findings across runs | Patterns here should become linting rules or spec checklist items |
| Spec-to-implementation drift | Diff between what the spec described and what was built | Measures spec quality — lower drift means better specs |
| Test coverage delta | Coverage change from before to after implementation | Ensures the TDD stage is actually improving coverage |

Over time, this data feeds back into the learning loop: if reviews consistently flag missing error handling, the spec template can be updated to require an error-handling section, reducing future review iterations.
