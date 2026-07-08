---
name: docs
description: Generates JSDoc/TSDoc documentation for a file or module after modification. Use this skill when the user asks you to document the code or the project.
model: haiku
---

Generates complete documentation for the specified file.

Documentation types based on file type:
- .ts/.tsx/.js/.jsx: JSDoc/TSDoc with @param, @returns, @throws, @example.
- .py: Google-style Docstrings with Args, Returns, Raises, Examples.
- README: Generates the module's README.md file with installation, usage, and API information.
- API endpoints: Generates OpenAPI/Swagger documentation.

For each function/class, include:
1. Brief description (1 line).
2. Detailed description if the logic is not obvious.
3. @param with type and description for each parameter.
4. @returns with type and description.
5. @throws for each possible exception.
6. @example with at least one real-world usage example.

Rules:
- Do not document the obvious (simple getters, trivial constructors).
- Docs in spanish language.
- @examples must be executable (valid code).
- Maintain the existing documentation style in the project.