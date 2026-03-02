# Ruff Rules Reference

The top 30 most common ruff rules organized by category. Each entry includes the rule ID, what it catches, whether it is auto-fixable, and example code.

---

## E: pycodestyle errors

### E501 -- Line too long

**What it catches:** Lines that exceed the configured maximum length (default 88 characters).

**Auto-fixable:** No

```python
# Bad
result = some_function(argument_one, argument_two, argument_three, argument_four, argument_five, argument_six)

# Good
result = some_function(
    argument_one, argument_two, argument_three,
    argument_four, argument_five, argument_six,
)
```

### E711 -- Comparison to None

**What it catches:** Using `==` or `!=` to compare with `None` instead of `is` or `is not`.

**Auto-fixable:** Yes

```python
# Bad
if value == None:
    pass

# Good
if value is None:
    pass
```

### E712 -- Comparison to True/False

**What it catches:** Using `==` or `!=` to compare with `True` or `False` instead of using the value directly.

**Auto-fixable:** Yes

```python
# Bad
if flag == True:
    pass

# Good
if flag:
    pass
```

### E741 -- Ambiguous variable name

**What it catches:** Single-character variable names that are easily confused (e.g., `l`, `O`, `I`).

**Auto-fixable:** No

```python
# Bad
l = [1, 2, 3]
O = 0

# Good
items = [1, 2, 3]
count = 0
```

---

## W: pycodestyle warnings

### W291 -- Trailing whitespace

**What it catches:** Lines with trailing spaces after the last non-whitespace character.

**Auto-fixable:** Yes

```python
# Bad
x = 1

# Good
x = 1
```

### W292 -- No newline at end of file

**What it catches:** Files that do not end with a newline character.

**Auto-fixable:** Yes

### W293 -- Whitespace before a comment

**What it catches:** Lines with indentation that uses a mix of tabs and spaces.

**Auto-fixable:** Yes

---

## F: pyflakes

### F401 -- Unused import

**What it catches:** Modules that are imported but never used in the file.

**Auto-fixable:** Yes

```python
# Bad
import os
import sys

def hello():
    print("hello")

# Good
def hello():
    print("hello")
```

### F811 -- Redefinition of unused name

**What it catches:** A variable or function is defined, then re-defined without the first definition being used.

**Auto-fixable:** No

```python
# Bad
def process(data):
    return data

def process(data):
    return data.strip()

# Good
def process(data):
    return data.strip()
```

### F841 -- Local variable is assigned but never used

**What it catches:** Variables assigned in a function that are never referenced.

**Auto-fixable:** Yes

```python
# Bad
def compute():
    result = expensive_call()
    return 42

# Good
def compute():
    return 42
```

### F821 -- Undefined name

**What it catches:** References to names that have not been defined in the current scope.

**Auto-fixable:** No

```python
# Bad
def greet():
    print(mesage)

# Good
def greet():
    message = "hello"
    print(message)
```

---

## I: isort

### I001 -- Import block is not sorted

**What it catches:** Imports that are not grouped and sorted according to isort conventions (stdlib, third-party, local).

**Auto-fixable:** Yes

```python
# Bad
import requests
import os
from mypackage import utils
import sys

# Good
import os
import sys

import requests

from mypackage import utils
```

---

## N: pep8-naming

### N801 -- Class name should use CapWords convention

**What it catches:** Class names not written in CamelCase.

**Auto-fixable:** No

```python
# Bad
class my_class:
    pass

# Good
class MyClass:
    pass
```

### N802 -- Function name should be lowercase

**What it catches:** Function names that use uppercase characters.

**Auto-fixable:** No

```python
# Bad
def MyFunction():
    pass

# Good
def my_function():
    pass
```

### N803 -- Argument name should be lowercase

**What it catches:** Function argument names that use uppercase characters.

**Auto-fixable:** No

```python
# Bad
def process(DataInput):
    return DataInput

# Good
def process(data_input):
    return data_input
```

---

## UP: pyupgrade

### UP006 -- Use `type` instead of `Type` for type annotations (Python 3.9+)

**What it catches:** Using `typing.Type` when the builtin `type` is available.

**Auto-fixable:** Yes

```python
# Bad
from typing import Type

def factory(cls: Type[MyClass]) -> MyClass:
    return cls()

# Good
def factory(cls: type[MyClass]) -> MyClass:
    return cls()
```

### UP007 -- Use `X | Y` for union type annotations (Python 3.10+)

**What it catches:** Using `Union[X, Y]` or `Optional[X]` when the `X | Y` syntax is available.

**Auto-fixable:** Yes

```python
# Bad
from typing import Optional, Union

def process(value: Optional[str]) -> Union[int, str]:
    pass

# Good
def process(value: str | None) -> int | str:
    pass
```

### UP035 -- Import from `typing` instead of deprecated `typing_extensions`

**What it catches:** Importing symbols from `typing_extensions` that are available in the target Python version's `typing` module.

**Auto-fixable:** Yes

```python
# Bad
from typing_extensions import TypeAlias

# Good
from typing import TypeAlias
```

---

## B: flake8-bugbear

### B006 -- Do not use mutable data structures for argument defaults

**What it catches:** Using mutable default arguments (lists, dicts, sets) in function signatures.

**Auto-fixable:** No

```python
# Bad
def process(items: list = []):
    items.append(1)
    return items

# Good
def process(items: list | None = None):
    if items is None:
        items = []
    items.append(1)
    return items
```

### B007 -- Loop control variable not used within loop body

**What it catches:** A `for` loop variable that is never referenced inside the loop.

**Auto-fixable:** Yes

```python
# Bad
for item in range(10):
    print("hello")

# Good
for _item in range(10):
    print("hello")
```

### B009 -- Do not call `getattr` with a constant attribute value

**What it catches:** Using `getattr(obj, "attr")` when `obj.attr` would work.

**Auto-fixable:** Yes

```python
# Bad
value = getattr(obj, "name")

# Good
value = obj.name
```

### B011 -- Do not `assert False`, raise `AssertionError`

**What it catches:** Using `assert False` to unconditionally raise an error instead of raising explicitly.

**Auto-fixable:** Yes

```python
# Bad
assert False, "should not reach here"

# Good
raise AssertionError("should not reach here")
```

---

## S: bandit / security

### S101 -- Use of `assert` detected

**What it catches:** Using `assert` statements which are stripped in optimized bytecode (`python -O`), so they should not be used for security checks.

**Auto-fixable:** No

```python
# Bad
assert user.is_admin, "Unauthorized"

# Good
if not user.is_admin:
    raise PermissionError("Unauthorized")
```

### S105 -- Possible hardcoded password

**What it catches:** Strings assigned to variables with names like `password`, `secret`, `token`.

**Auto-fixable:** No

```python
# Bad
password = "hunter2"

# Good
password = os.environ["APP_PASSWORD"]
```

### S110 -- `try`-`except`-`pass` detected

**What it catches:** Bare `except: pass` blocks that silently swallow all exceptions.

**Auto-fixable:** No

```python
# Bad
try:
    risky_call()
except:
    pass

# Good
try:
    risky_call()
except SpecificError:
    logger.warning("risky_call failed")
```

---

## SIM: flake8-simplify

### SIM102 -- Use a single `if` instead of nested `if`

**What it catches:** Nested `if` statements that can be collapsed with `and`.

**Auto-fixable:** Yes

```python
# Bad
if condition_a:
    if condition_b:
        do_something()

# Good
if condition_a and condition_b:
    do_something()
```

### SIM110 -- Use `any()` instead of a `for` loop

**What it catches:** For loops that return `True` on a condition and `False` at the end, which can be replaced with `any()`.

**Auto-fixable:** Yes

```python
# Bad
for item in items:
    if item.is_valid():
        return True
return False

# Good
return any(item.is_valid() for item in items)
```

### SIM118 -- Use `key in dict` instead of `key in dict.keys()`

**What it catches:** Calling `.keys()` unnecessarily when checking membership.

**Auto-fixable:** Yes

```python
# Bad
if key in my_dict.keys():
    pass

# Good
if key in my_dict:
    pass
```

---

## RET: flake8-return

### RET501 -- Do not explicitly `return None` if it is the only possible return value

**What it catches:** Functions that explicitly return `None` when the function would return `None` implicitly.

**Auto-fixable:** Yes

```python
# Bad
def setup():
    configure()
    return None

# Good
def setup():
    configure()
```

### RET504 -- Unnecessary assignment before `return` statement

**What it catches:** Assigning a value to a variable and immediately returning it on the next line.

**Auto-fixable:** No

```python
# Bad
def get_name():
    name = compute_name()
    return name

# Good
def get_name():
    return compute_name()
```
