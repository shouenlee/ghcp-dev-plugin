---
name: dep-manager
description: 'Manages Python dependencies — add, remove, audit for vulnerabilities with pip-audit, and detect unused packages. Use when asked to "manage deps", "add dependency", "remove dependency", "audit dependencies", "find unused packages", "pip audit", "security audit deps", "check vulnerabilities", or "dependency management".'
---

# Dependency Manager

Manages Python project dependencies with support for adding, removing, auditing, and detecting unused packages across multiple package manager formats.

## When to Use

- You need to add or remove a Python dependency and keep your dependency file in sync
- You want to audit your project for known security vulnerabilities
- You suspect there are unused packages inflating your dependency list
- You want a quick security check after adding a new package

## Prerequisites

- A Python project with a dependency file (`pyproject.toml`, `requirements.txt`, `Pipfile`, or `setup.py`)
- `pip-audit` for vulnerability auditing (install with `uv pip install pip-audit`)
- An activated virtual environment is recommended

## Workflow

### `/deps add <package>` — Add a dependency

1. **Detect package manager** — check for `pyproject.toml` (uv/pip), `requirements.txt`, `Pipfile`, `setup.py`:
   ```bash
   ls pyproject.toml requirements*.txt Pipfile setup.py 2>/dev/null
   ```
2. **Install the package**:
   ```bash
   uv pip install <package>
   ```
   or fall back to:
   ```bash
   pip install <package>
   ```
3. **Update the appropriate dependency file** — add the package with its resolved version to the correct file format.
4. **Run a quick security check** on the new package:
   ```bash
   pip-audit --require-hashes --no-deps -r <file>
   ```
5. **Verify import works**:
   ```python
   python -c "import <package>"
   ```

### `/deps remove <package>` — Remove a dependency

1. **Remove from dependency file** — delete the entry from `requirements.txt`, `pyproject.toml`, `Pipfile`, or `setup.py`.
2. **Uninstall the package**:
   ```bash
   uv pip uninstall <package>
   ```
   or fall back to:
   ```bash
   pip uninstall <package>
   ```
3. **Check for broken imports** in the codebase:
   ```bash
   grep -r "import <package>" --include="*.py" .
   grep -r "from <package>" --include="*.py" .
   ```
4. **Report** if any files still reference the removed package, listing each file and line.

### `/deps audit` — Security audit

1. **Run `pip-audit`** on the project dependencies:
   ```bash
   pip-audit -r requirements.txt
   ```
   or:
   ```bash
   pip-audit
   ```
2. **If pip-audit is not installed**, suggest installing it:
   ```bash
   uv pip install pip-audit
   ```
3. **Run `safety check`** as a secondary scanner (if available):
   ```bash
   safety check --full-report
   ```
4. **Parse results** and present:
   - Package name, installed version, fixed version
   - CVE ID and severity
   - Description of vulnerability
5. **Offer to update** vulnerable packages:
   ```bash
   uv pip install <package>==<fixed-version>
   ```
6. **Re-run audit** after updates to confirm fixes.

### `/deps unused` — Find unused packages

1. **List installed packages** from the dependency file.
2. **For each package**, search the codebase for imports:
   ```bash
   grep -r "import <package>" --include="*.py" .
   grep -r "from <package>" --include="*.py" .
   ```
   - Account for package name vs import name differences (e.g., `python-dateutil` -> `dateutil`, `Pillow` -> `PIL`)
3. **Report packages** with no detected imports.
4. **Flag false positives** — plugins, CLI tools, test dependencies, runtime-only deps.
5. **Offer to remove** confirmed unused packages.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| No dependency file found | Project not initialized | Run `pip freeze > requirements.txt` or create a `pyproject.toml` |
| `pip-audit` not installed | Missing audit tool | Run `uv pip install pip-audit` or `pip install pip-audit` |
| Virtual environment not activated | System Python in use | Activate your venv with `source .venv/bin/activate` or create one with `python -m venv .venv` |
| Package name vs import name mismatch | Different PyPI name and import name | Manually verify the import name; common mappings are handled automatically |
| Permission denied during install | System Python or restricted env | Use a virtual environment or add `--user` flag |
