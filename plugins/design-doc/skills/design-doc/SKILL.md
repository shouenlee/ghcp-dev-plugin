---
name: design-doc
description: 'Generates RFCs and Architecture Decision Records (ADRs) from feature descriptions — reads existing docs to maintain numbering and style. Use when asked to "write rfc", "create adr", "design doc", "architecture decision", "technical design", "write proposal", "document decision", or "design document".'
---

# Design Document Generator

Generate RFCs and Architecture Decision Records (ADRs) that follow your project's existing numbering, format, and style conventions.

## When to Use

- You need to write an RFC for a new feature proposal
- You need to record an architecture decision as an ADR
- You want to create a technical design document with consistent formatting
- You want to document a decision or proposal using your project's existing conventions

## Prerequisites

None. The skill will create the docs directory if one does not already exist.

## Workflow

1. **Determine document type** (RFC or ADR) from the user request:
   - **RFC**: larger feature proposals with context, alternatives, and an implementation plan
   - **ADR**: focused architecture decisions with status, context, decision, and consequences

2. **Scan for existing docs** to discover where documents live:
   ```bash
   find . -type d -name "rfcs" -o -name "adrs" -o -name "decisions" -o -name "architecture" | head -20
   ```
   - Look in `docs/rfcs/`, `docs/adrs/`, `docs/decisions/`, `docs/architecture/`
   - If none found, ask the user for a preferred location or default to `docs/adrs/`

3. **Read existing documents** to determine:
   - Numbering scheme (e.g., `0001-`, `ADR-001-`, sequential integers)
   - Template/format used (sections, status values, metadata)
   - Style conventions (tone, depth, section order)

4. **Calculate the next number** in the sequence based on existing documents.

5. **Gather context** from the user:
   - Feature or decision being documented
   - Problem statement or motivation
   - Constraints and requirements

6. **Generate the document** using the appropriate template:

   **RFC Template:**
   ```markdown
   # RFC-{NNN}: {Title}
   - **Status**: Draft
   - **Author**: {author}
   - **Date**: {date}

   ## Summary
   ## Motivation
   ## Detailed Design
   ## Alternatives Considered
   ## Migration/Rollout Plan
   ## Open Questions
   ```

   **ADR Template:**
   ```markdown
   # ADR-{NNN}: {Title}
   - **Status**: Proposed
   - **Date**: {date}

   ## Context
   ## Decision
   ## Consequences
   ### Positive
   ### Negative
   ### Neutral
   ```

7. **Write the file** and present it to the user for review.

8. **Offer to create a git branch** for the design doc so it can go through a review process.

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| Existing docs not found | Documents live in a non-standard directory | Ask the user for the correct path or search more broadly with `find` |
| Numbering conflict | Two documents share the same sequence number | Re-scan the directory, pick the next unused number, and flag the conflict |
| Template mismatch | Project uses a custom template that differs from defaults | Read an existing document first and mirror its structure instead of using the built-in template |
