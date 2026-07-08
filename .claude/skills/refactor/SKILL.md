---
name: refactor
description: Analyze and refactor code, identifying code smells and improvements. Use this skill when the user asks you to refactor the code or the project.
---

Analyze the specified file or module and propose specific refactorings.

Process:
1. Read the code and identify these code smells:

- Functions longer than 30 lines.
- More than 3 levels of nesting.
- Duplicate code (DRY violations).
- God classes or god functions.
- Magic numbers/strings without constants.
- Boolean parameters (flag arguments).
- Excessive coupling between modules.

2. For each proposed refactoring, show:

- What: description of the change.
- Why: problem it solves.
- Before: current code.
- After: refactored code.
- Risk: low/medium/high.

3. Order the refactorings by impact (highest first)

4. Apply only the refactorings approved by the user

Critical rule: NEVER change the public interface (exports, API endpoints, component props) without explicit confirmation.