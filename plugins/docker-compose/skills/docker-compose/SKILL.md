---
name: docker-compose
description: 'Generates multi-stage Dockerfiles and docker-compose.yml configurations, adds services like Postgres/Redis/Celery/Nginx, and checks for Docker anti-patterns. Use when asked to "dockerize", "create dockerfile", "docker compose", "add docker", "add redis", "add postgres", "docker init", "optimize docker", or "container setup".'
---

# Docker Compose

Generate production-ready Dockerfiles and docker-compose configurations, add common services, and audit existing Docker setups for anti-patterns.

## When to Use

- You need to containerize an existing project with a Dockerfile and docker-compose.yml
- You want to add a service (database, cache, worker, proxy) to an existing compose setup
- You want to audit your Dockerfile and compose configuration for best practices

## Prerequisites

- Docker and docker-compose installed locally (for validation and testing)
- A project with an identifiable language and framework (Python, Node.js, Go)

## Workflow

This skill supports three subcommands: `/docker init`, `/docker add <service>`, and `/docker optimize`.

---

### `/docker init` -- Generate Dockerfile + compose

1. **Detect project type** (Python/Node/Go) and framework:

   ```bash
   # Python detection
   ls requirements.txt pyproject.toml Pipfile setup.py 2>/dev/null

   # Node detection
   ls package.json 2>/dev/null

   # Go detection
   ls go.mod 2>/dev/null
   ```

2. **Detect package manager and dependency files**:
   - Python: pip (requirements.txt), poetry (pyproject.toml), pipenv (Pipfile)
   - Node: npm (package-lock.json), yarn (yarn.lock), pnpm (pnpm-lock.yaml)
   - Go: go modules (go.mod)

3. **Generate a multi-stage Dockerfile**:
   - **Build stage**: install dependencies first (for layer caching), then copy source
   - **Production stage**: minimal base image, create non-root user, copy artifacts from build

   ```dockerfile
   # Example: Python multi-stage
   FROM python:3.12-slim AS builder
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt

   FROM python:3.12-slim
   RUN useradd --create-home appuser
   WORKDIR /app
   COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
   COPY . .
   USER appuser
   EXPOSE 8000
   CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
   ```

4. **Generate docker-compose.yml** with:
   - App service with a health check
   - Volume mounts for development (source code, exclude node_modules/venv)
   - Environment variables loaded from `.env`

   ```yaml
   version: "3.9"
   services:
     app:
       build: .
       ports:
         - "8000:8000"
       volumes:
         - .:/app
       env_file:
         - .env
       healthcheck:
         test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
         interval: 30s
         timeout: 10s
         retries: 3
   ```

5. **Generate .dockerignore** if not already present, including common exclusions:

   ```
   .git
   .venv
   __pycache__
   node_modules
   .env
   *.pyc
   .mypy_cache
   .pytest_cache
   ```

6. **Present all generated files for review** before writing to disk.

---

### `/docker add <service>` -- Add a service

1. **Read the existing docker-compose.yml** to understand current services, networks, and volumes.

2. **Add the appropriate service block** based on the requested service name:

   - **`postgres`**: PostgreSQL with health check, persistent volume, and environment variables
     ```yaml
     postgres:
       image: postgres:16-alpine
       environment:
         POSTGRES_DB: app_db
         POSTGRES_USER: app_user
         POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
       volumes:
         - postgres_data:/var/lib/postgresql/data
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U app_user -d app_db"]
         interval: 10s
         timeout: 5s
         retries: 5
     ```

   - **`redis`**: Redis with persistence and health check
     ```yaml
     redis:
       image: redis:7-alpine
       command: redis-server --appendonly yes
       volumes:
         - redis_data:/data
       healthcheck:
         test: ["CMD", "redis-cli", "ping"]
         interval: 10s
         timeout: 5s
         retries: 5
     ```

   - **`celery`**: Celery worker using the same image as the app service, depends_on app
     ```yaml
     celery:
       build: .
       command: celery -A app worker --loglevel=info
       depends_on:
         - app
         - redis
       env_file:
         - .env
     ```

   - **`celery-beat`**: Celery beat scheduler
     ```yaml
     celery-beat:
       build: .
       command: celery -A app beat --loglevel=info
       depends_on:
         - celery
       env_file:
         - .env
     ```

   - **`nginx`**: Nginx reverse proxy with configuration volume
     ```yaml
     nginx:
       image: nginx:alpine
       ports:
         - "80:80"
       volumes:
         - ./nginx.conf:/etc/nginx/conf.d/default.conf
       depends_on:
         - app
     ```

   - **`mailhog`**: Development email catcher
     ```yaml
     mailhog:
       image: mailhog/mailhog
       ports:
         - "1025:1025"
         - "8025:8025"
     ```

3. **Add necessary networks, volumes, and depends_on relationships** to wire the new service into the existing compose graph.

4. **Update the app service environment** to reference the new service (e.g., add `DATABASE_URL`, `REDIS_URL`, or `CELERY_BROKER_URL`).

5. **Present the updated compose file** for review.

---

### `/docker optimize` -- Check for anti-patterns

1. **Read the Dockerfile and docker-compose.yml** from the project root.

2. **Check for common issues**:

   | Check | Severity | What to look for |
   |---|---|---|
   | Running as root | High | No `USER` directive in Dockerfile |
   | No .dockerignore | Medium | Missing file or missing key entries (.git, node_modules, .env) |
   | COPY before deps | Medium | Source copied before dependency install, breaking layer cache |
   | Using `latest` tag | Medium | Base image uses `:latest` instead of a pinned version |
   | No health checks | Medium | No `HEALTHCHECK` in Dockerfile or `healthcheck` in compose |
   | Bloated final image | Low | Build tools (gcc, make) present in production stage |
   | Secrets in env/args | High | Passwords or tokens in `ENV` or `ARG` directives |
   | No multi-stage build | Low | Single `FROM` with both build and runtime dependencies |

3. **Present findings** with severity level and a concrete fix suggestion for each issue:

   ```
   [HIGH] Running as root
     -> Add USER directive: RUN useradd -m appuser && USER appuser

   [MEDIUM] Using latest tag for base image
     -> Pin version: python:3.12-slim instead of python:latest
   ```

4. **Offer to apply fixes** automatically where possible (adding USER, reordering COPY, pinning tags).

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| Project type not detected | No recognizable dependency files | Manually specify the language and framework |
| Conflicting ports | Another service already uses the requested port | Change the host port mapping in docker-compose.yml |
| Service name conflicts | A service with the same name already exists in compose | Choose a different name or update the existing service |
| Health check fails | Application does not expose a health endpoint | Add a `/health` endpoint to your application or adjust the health check command |
| Permission denied errors | Non-root user cannot access mounted volumes | Ensure volume permissions match the container user UID |
