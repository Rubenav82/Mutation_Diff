---
name: test-generator
description: Generates unit tests for a specific file or module. Use this skill after creating or modifying code.
---

Generates complete tests for the modified file or module.

Steps:
1. Read the target file and analyze all exported functions/methods.

2. The project's testing framework is Vitest.

3. Generate tests that cover:

- Happy path for each function.
- Boundary cases (null, undefined, empty array, empty string).
- Error handling (throws, rejects, error responses).
- Domain-specific edge cases.

Rules:
- Use the same language as the source file.
- Import from correct relative paths in the project.
- Use mocks only when strictly necessary.
- Each test must have a descriptive name.
- Group tests with `describe()` by function.
- Target: Minimum 80% branch coverage.
- Generate robust tests.
- Do not create trivial tests (getter/setter without logic).

Output format: Create the test file in the correct location according to the project convention (__tests__/, *.test.ts).
