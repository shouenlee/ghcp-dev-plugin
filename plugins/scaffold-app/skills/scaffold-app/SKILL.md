---
name: scaffold-app
description: 'Generates convention-aware boilerplate for Django and FastAPI patterns — endpoints, models, serializers/schemas, Celery tasks, management commands, and test stubs. Use when asked to "scaffold", "generate endpoint", "create model", "new api endpoint", "add view", "boilerplate", "create task", or "scaffold app component".'
---

# Scaffold App

Generate convention-aware boilerplate for Django and FastAPI projects. This skill detects your project framework, reads existing conventions, and produces components that match your codebase style.

## When to Use

- You need a new API endpoint, model, serializer/schema, Celery task, or management command
- You want generated code that follows your project's existing patterns and directory layout
- You are starting a new feature and need the standard set of files (model, view, serializer, tests)

## Prerequisites

- A Django or FastAPI project structure must be present in the working directory
- For Django: `manage.py`, `settings.py`, and `urls.py` should exist
- For FastAPI: `main.py` with a FastAPI import or `pyproject.toml` listing fastapi as a dependency

## Workflow

1. **Detect project framework** by inspecting files in the repository:
   - **FastAPI**: look for `main.py` containing a FastAPI import, or `pyproject.toml` with a fastapi dependency
   - **Django**: look for `manage.py`, `settings.py`, `urls.py`

   ```bash
   # FastAPI detection
   grep -r "from fastapi" main.py 2>/dev/null
   grep "fastapi" pyproject.toml 2>/dev/null

   # Django detection
   ls manage.py settings.py urls.py 2>/dev/null
   ```

2. **Detect existing conventions** in the codebase:
   - Directory structure (app-based vs feature-based organization)
   - Naming patterns (snake_case for files, CamelCase for classes)
   - Existing models, serializers, and views to match their style

   ```bash
   # Inspect directory layout
   find . -name "models.py" -o -name "views.py" -o -name "serializers.py" | head -20

   # Check naming patterns in existing code
   grep -r "class .*Model" --include="*.py" | head -10
   ```

3. **Ask what to generate** (if the user has not already specified):
   - Endpoint (FastAPI route or Django view)
   - Model (Django ORM or SQLAlchemy/Pydantic)
   - Serializer/Schema (DRF serializer or Pydantic model)
   - Celery task
   - Management command (Django)

4. **Generate the component** from templates, adapting to project conventions:
   - Use existing import patterns found in step 2
   - Match existing code style (quotes, trailing commas, line length)
   - Place the file in the conventional location for the project

   ```bash
   # Example: generate a new Django model in the appropriate app
   # File: <app>/models.py (append) or <app>/models/<resource>.py (new file)
   ```

5. **Generate a corresponding test stub** in the appropriate test directory:
   - Mirror the source file path under the `tests/` directory
   - Include imports and a basic test class with placeholder test methods
   - Follow the existing test style (pytest vs unittest, fixtures vs setUp)

   ```python
   # Example test stub
   import pytest
   from <app>.models import <Resource>

   class Test<Resource>:
       def test_create(self):
           """Test creating a <resource>."""
           # TODO: implement
           pass
   ```

6. **Update any required registrations** so the new component is wired in:
   - Add the route to the FastAPI router or Django URL configuration
   - Register the model in Django admin if an admin.py exists
   - Add the URL pattern to the app's `urls.py`

   ```python
   # Example: register in Django admin
   from .models import <Resource>
   admin.site.register(<Resource>)
   ```

7. **Present generated files for review** before writing them to disk, showing the full file paths and contents so the user can approve or request changes.

## Troubleshooting

| Problem | Cause | Solution |
|---|---|---|
| Framework not detected | Missing indicator files (`manage.py`, `main.py`) | Ensure you are in the project root; manually specify the framework |
| Conflicting conventions | Mixed patterns in the codebase | Choose one convention and specify it explicitly when prompted |
| Missing directories | Expected app or module directory does not exist | Create the directory structure first, or let the skill create it |
| Import errors in generated code | Project uses non-standard import paths | Review and adjust import statements to match your project layout |
| Test directory not found | Tests are organized differently than expected | Specify the test directory path when prompted |
