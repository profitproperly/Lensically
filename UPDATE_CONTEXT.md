For Codex — Implementation Task

Goal
Update PROJECT_CONTEXT.md so it accurately reflects the current repository state.

Constraints
- Read the repository before making changes.
- Modify only PROJECT_CONTEXT.md.
- Do not modify application code.
- Do not modify AGENTS.md, README files, or any other documentation unless explicitly instructed.
- If the file already reflects the repository accurately, make no changes.
- Keep the file concise.
- Prefer current repository behavior over existing wording in PROJECT_CONTEXT.md.
- Remove stale statements, completed objectives, and outdated recent changes instead of only appending new text.
- Do not invent systems, integrations, or responsibilities that are not clearly supported by the repository.
- Focus on active production-relevant architecture, flows, routes, services, and public compliance surfaces.

Implementation
1. Open PROJECT_CONTEXT.md in the repository root.
2. Analyze the repository structure, architecture, and services.
3. Update any section that no longer reflects the repository state.
4. If scope, naming, architecture, or responsibilities have changed, update those sections accordingly.
5. If the structure of the file needs improvement, adjust it while keeping the same purpose.
6. Reflect newly added or removed production routes, authentication flows, account lifecycle behavior, compliance pages, and backend responsibilities when relevant.
7. Refresh the "Recent Changes (Git History)" section using:

git log -n 10 --pretty=format:"- %s"

8. Replace stale or completed "Current Objective" text with the current development focus instead of preserving historical objectives.
9. Keep legacy or scaffold directories brief unless they are actively used in production behavior.

Verification
Confirm that PROJECT_CONTEXT.md now reflects the repository state, current production flows, and current development focus without stale references.

Return
Files Modified
PROJECT_CONTEXT.md (only if changes were necessary)

Summary
Explain what sections were updated or confirm that no update was required.

Risks / Edge Cases
Note if any repo areas were ambiguous.
