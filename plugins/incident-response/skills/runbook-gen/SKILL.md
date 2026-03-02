---
name: runbook-gen
description: 'Generates step-by-step operational runbooks from infrastructure config and saves to docs/runbooks/. Use when asked to "create runbook", "generate runbook", "operations playbook", "incident playbook", "how to restart", "deployment procedure", or "operational documentation".'
---

# Runbook Generator

Generates structured operational runbooks by scanning project infrastructure configuration, CI/CD workflows, and service topology.

## When to Use

- You need a step-by-step runbook for a deployment, rollback, or restart procedure
- You want to document how to respond to a specific monitoring alert
- You need to create operational documentation for database migrations or scaling
- You want to generate a playbook from existing infrastructure config

## Prerequisites

- A project with infrastructure configuration (Docker, CI/CD workflows, Terraform, etc.)
- Knowledge of the target operational procedure or topic

## Workflow

1. **Determine the runbook topic** — identify what operational procedure to document:
   - Deployment procedure
   - Service restart/rollback
   - Database migration
   - Scaling/capacity management
   - Monitoring alert response
   - Custom topic from user

2. **Scan the project for relevant configuration**:
   ```bash
   # Docker/compose files for service topology
   find . -name "Dockerfile" -o -name "docker-compose*.yml" -o -name "compose*.yml"

   # CI/CD workflows for deploy steps
   find . -path "./.github/workflows/*.yml" -o -path "./.gitlab-ci.yml"

   # Database migration files
   find . -path "*/migrations/*" -name "*.py" -o -path "*/migrations/*" -name "*.sql"

   # Environment variables and config files
   find . -name ".env.example" -o -name "config*.yml" -o -name "settings*.py"

   # Infrastructure-as-code
   find . -name "*.tf" -o -name "*.template.json" -o -name "*.template.yaml"
   ```

3. **Generate structured runbook**:
   ```markdown
   # Runbook: {Title}
   - **Last Updated**: {date}
   - **Owner**: {team/person}

   ## Prerequisites
   - Access requirements
   - Tools needed
   - Environment setup

   ## Steps
   1. Step with exact commands
      ```bash
      command to run
      ```
      **Expected output**: Description of what you should see
      **If this fails**: What to do if this step fails

   ## Verification
   - How to confirm the procedure succeeded

   ## Rollback
   - Steps to undo if something goes wrong

   ## Contacts
   - On-call team and escalation path
   ```

4. **Save** to `docs/runbooks/{topic}.md`.
5. **Offer to add** to an index file at `docs/runbooks/README.md` for discoverability.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| No config files found | Project lacks infrastructure config | Ask the user to describe the infrastructure and create the runbook from their description |
| Unclear service topology | Config spread across many files or using external orchestration | Ask the user to clarify service dependencies and architecture |
| Missing environment details | No `.env.example` or config templates | Document placeholder values and flag them for the user to fill in |
