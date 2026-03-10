# Lensically — Agent Execution Rules

## Execution Model

When implementing a task:

1. Read the repository before editing code.
2. Follow existing architecture and patterns.
3. Modify only files necessary for the change.
4. Do not break authentication, routes, or database logic.
5. Prefer minimal and production-safe implementations.

## Implementation Procedure

1. Locate the relevant files in the repository.
2. Identify the safest integration point.
3. Implement the change with minimal modifications.

## Environment Consistency

The development environment and runtime versions are controlled by the
VS Code task system.

Agents must NOT:

- diagnose local Node versions
- recommend runtime upgrades
- modify environment configuration
- block implementation due to local runtime assumptions

All builds, Node versions, and deployment commands are executed through
the task registry defined in the development workflow.

If a build failure appears to be environment-related, assume the runtime
is correct and focus only on code-level causes unless explicitly told
otherwise.

## Verification

Every implementation must include:

- explanation of how the change works
- how to test the change
- commands required to run or verify the fix

## Required Output

Files Created  
Files Modified  
Code Changes  
Summary  
Risks / Edge Cases

## Rule

If the correct integration point cannot be confidently determined from
the repository, stop and ask for clarification instead of guessing.