---
name: test-coverage
description: 'Runs pytest with coverage tracking, identifies under-covered files and functions, and offers to generate tests for gaps. Use when asked to "check coverage", "run coverage", "coverage report", "find untested code", or "pytest --cov".'
---

# Test Coverage

Run pytest with coverage tracking to identify under-tested files and functions. Presents a clear coverage report and offers to generate tests for the most under-covered areas.

## When to Use

- You want to see which parts of your codebase lack test coverage
- You need to identify specific uncovered lines and functions
- You want to prioritize which files need tests the most
- You are preparing for a code review and want to ensure adequate coverage

## Prerequisites

The following must be installed. If missing, install with:

```bash
uv pip install pytest pytest-cov
```

- **pytest** -- test framework
- **pytest-cov** -- coverage plugin for pytest

## Workflow

1. **Run pytest with coverage tracking** against the source directory:

   ```bash
   pytest --cov=<source_dir> --cov-report=term-missing
   ```

   If the user specifies a particular directory or module, scope coverage to that area. Otherwise, auto-detect the source directory from the project structure.

2. **Parse the output** to identify files below the coverage threshold (default 80%):
   - Extract per-file coverage percentages
   - Identify which specific lines are missing coverage (`Missing` column)
   - Flag files with 0% coverage as completely untested

3. **For each under-covered file, identify specific uncovered areas:**
   - Map missing line numbers to functions and class methods
   - Determine which code paths are untested (error handlers, edge cases, branches)
   - Note any entire functions or classes with zero coverage

4. **Present a coverage report table:**

   | File | Statements | Missed | Coverage % | Key Gaps |
   |------|-----------|--------|------------|----------|
   | `src/auth.py` | 45 | 18 | 60% | `validate_token`, `refresh_session` |
   | `src/db.py` | 82 | 41 | 50% | `migrate`, `rollback` |
   | `src/utils.py` | 30 | 3 | 90% | edge case in `parse_date` |

5. **Offer to run /test-gen** on the most under-covered files to automatically generate tests that fill the coverage gaps. Prioritize files with the lowest coverage percentage and the highest number of missed statements.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `pytest-cov: command not found` or `no module named pytest_cov` | pytest-cov is not installed | Run `uv pip install pytest-cov` or `pip install pytest-cov` |
| Coverage is 0% for all files | Source directory path is wrong | Verify `--cov=<path>` points to the actual source directory, not the tests directory |
| Coverage report shows only test files | `--cov` target is misconfigured | Set `--cov` to the source package name (e.g., `--cov=src` or `--cov=mypackage`) |
| Missing lines not shown | Using default report format | Add `--cov-report=term-missing` to see which lines are uncovered |
| Coverage seems too high | Tests import modules but do not exercise them meaningfully | Check for tests that import but do not assert; use branch coverage with `--cov-branch` |
| `CoverageWarning: No data was collected` | Source files were not executed during tests | Ensure tests actually import and call the source modules |
