---
name: test-gen
description: 'Generates pytest tests from Python source files — creates happy path, edge case, and error path tests following existing test conventions. Use when asked to "generate tests", "write tests", "create tests", "add tests", "test this", "pytest", or "unit tests".'
---

# Test Generation

Generate comprehensive pytest test suites from Python source files. Produces happy path, edge case, and error path tests that follow the existing test conventions in your project.

## When to Use

- You have written new Python code and need tests for it
- You want to add tests for an existing module that lacks coverage
- You need to scaffold a test file that follows your project's patterns
- You want to ensure edge cases and error paths are tested

## Prerequisites

The following must be installed. If missing, install with:

```bash
uv pip install pytest
```

- **pytest** -- the test framework used to run and discover tests

## Workflow

1. **Identify target source files** from user input or recent changes, excluding files that are already tests:

   ```bash
   git diff --name-only HEAD -- '*.py' | grep -v 'test_'
   ```

   If the user specifies files or directories, use those instead.

2. **Read each source file** to understand its structure:
   - Functions and their signatures (parameters, type hints, return types)
   - Classes and their methods
   - Module-level constants and configuration
   - Dependencies and imports

3. **Discover existing test conventions** by examining the project:
   - Look for `conftest.py` files and the fixtures they define
   - Check naming patterns (`test_<module>.py` vs `<module>_test.py`)
   - Identify the test directory structure (`tests/` directory vs alongside source)
   - Note any common assertion patterns, parametrize usage, or helper utilities

   ```bash
   find . -name 'conftest.py' -o -name 'test_*.py' | head -20
   ```

4. **For each function or class, generate tests covering:**

   - **Happy path** -- typical inputs that exercise the main code path and return expected results
   - **Edge cases** -- empty inputs, boundary values, `None` values, empty strings, zero, single-element collections
   - **Error paths** -- invalid input types, values that should raise exceptions, missing required arguments

5. **Use existing fixtures and patterns** from `conftest.py`:
   - Reuse defined fixtures rather than creating duplicate setup code
   - Follow the same parametrize style if the project uses it
   - Match the assertion style (plain `assert` vs `pytest.raises` vs custom matchers)

6. **Write test files** following the project naming convention:

   ```bash
   # If tests/ directory exists
   tests/test_<module>.py

   # If tests live alongside source
   <module_dir>/test_<module>.py
   ```

7. **Run pytest on generated tests** to verify they pass:

   ```bash
   pytest <test_file> -v
   ```

8. **Present a summary** of generated tests:
   - Number of test functions created
   - Coverage categories (happy path, edge case, error path)
   - Any tests that failed and need manual adjustment

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `pytest: command not found` | pytest is not installed | Run `uv pip install pytest` or `pip install pytest` |
| `ModuleNotFoundError` in tests | Source module is not on the Python path | Add an `__init__.py` or run with `python -m pytest` from the project root |
| Generated tests fail with `ImportError` | Relative imports not resolving | Ensure the project has a proper package structure or use absolute imports |
| Tests fail due to missing fixtures | conftest.py is in a different directory | Move conftest.py to the tests root or add the correct conftest scope |
| Tests fail with `AttributeError` | Source code changed after test generation | Re-run /test-gen to regenerate tests against the current source |
| Too many tests generated | Every function gets full coverage | Specify individual functions or classes to limit scope |
| Generated tests are too simplistic | Complex business logic needs domain knowledge | Edit the generated tests to add meaningful assertions based on your domain |
