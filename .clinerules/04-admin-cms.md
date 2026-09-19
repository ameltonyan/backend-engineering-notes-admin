
---

## 4. `.clinerules/04-admin-cms.md`

```markdown
# Admin CMS Guidelines

## Purpose

This application is the administration and content-management interface
for the Backend Engineering Interview Platform.

The admin application manages interview preparation content.

## Content Hierarchy

The conceptual content hierarchy is:

Topic
└── Section
    └── Main Question
        └── Follow-up
            └── Deeper Follow-up

Do not assume that all questions are independent flat records.

Preserve relationships and hierarchy when modifying the frontend.

## Content Management

The admin application may manage:

- Topics
- Sections
- Questions
- Answers
- Question hierarchy
- Ordering
- Study programs
- AI-generated questions
- AI-generated answers
- Alternative answers
- Merged answers
- Follow-up questions

Only treat functionality as implemented when it actually exists in the
repository.

Do not invent missing functionality.

## Ordering

Content ordering is important.

Preserve existing ordering behaviour.

Do not introduce client-side ordering that conflicts with the backend or
existing application behaviour.

## Question Relationships

When displaying or editing hierarchical content, prefer human-readable
relationships in the UI.

Do not expose raw internal IDs as the primary user experience when the
application can display the corresponding entity/question.

Do not flatten the hierarchy merely because it makes a component easier to
implement.

## AI Content

AI-generated content is not automatically authoritative.

The intended workflow is:

Generate
    ↓
Review
    ↓
Edit / Choose / Merge
    ↓
Save / Publish

AI-generated content should remain reviewable before it becomes saved or
published content.

Do not automatically save or publish generated content unless the existing
implementation explicitly requires that behaviour.

## AI Features

Existing AI functionality may include:

- question generation
- answer generation/improvement
- alternative answers
- answer merging
- follow-up generation
- simplification
- humanisation
- shortening

Inspect the actual implementation before changing AI-related behaviour.

Do not invent AI provider APIs or request parameters.

Do not move provider-specific implementation into unrelated UI components
if an existing API/service boundary already exists.

## Study Programs

`StudyProgramEditor.tsx` has already been extracted from `App.tsx`.

Inspect its current implementation before changing it.

Do not automatically move it again.

Determine whether its current responsibilities are appropriate and whether
some internal state or logic should be separated further.

Only make changes when they improve responsibility boundaries or maintainability.

## Admin UX

This is a CMS/content-authoring application.

Prefer interfaces that make the content hierarchy and editing workflow clear.

Do not sacrifice the existing admin workflow merely to achieve a particular
code structure.

Preserve existing navigation, editing, review, generation, and save flows
during refactoring.

## Backend Boundary

The Spring Boot API is the source of backend business rules and security.

The frontend must not be treated as the security boundary.

Do not weaken authentication or authorization behaviour.

Do not rely on hiding a UI control as a replacement for backend authorization.

Never expose secrets, API keys, or provider credentials in frontend code.

Do not change backend API contracts as part of frontend refactoring unless
explicitly requested.