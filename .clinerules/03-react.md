# React and TypeScript Guidelines

## React

Use functional React components and hooks.

Follow the conventions already established by the project.

Prefer readable and explicit component code.

Avoid unnecessary abstraction.

## Component Responsibilities

Components should represent meaningful UI responsibilities.

Examples may include:

- editors
- lists
- navigation
- forms
- dialogs/modals
- AI generation interfaces
- question hierarchy interfaces

These are examples only. Determine actual boundaries from the code.

Do not create components solely because a JSX block contains several lines.

## State

Keep state close to the component or feature that owns it.

Avoid unnecessary prop drilling where a cleaner existing pattern is available,
but do not introduce global state merely to avoid a small amount of prop
passing.

Prefer derived values over duplicated state where appropriate.

Avoid multiple independent states representing the same underlying data.

## Effects

Use `useEffect` only when synchronization with an external system or
side effect actually requires it.

Do not use effects simply to calculate derived values that can be calculated
during rendering.

Preserve existing effect behaviour carefully when refactoring.

## Event Handlers

Keep event handlers understandable.

If a handler becomes large because it coordinates a feature-level operation,
consider moving the underlying logic into a custom hook or service while
leaving the UI interaction in the component.

## Forms

Keep presentation and form UI in components.

Move substantial form/state logic into an appropriate hook when it improves
clarity.

Preserve existing validation and submission behaviour.

## API Loading and Errors

Preserve existing:

- loading states
- error states
- empty states
- retry behaviour
- validation
- success handling

Do not silently remove error handling while refactoring.

## Styling

Preserve existing styling and visual behaviour during architectural
refactoring unless the task explicitly requests a visual change.

Do not introduce a new styling framework just to restructure components.

## TypeScript

Prefer strong typing.

Avoid introducing `any` to make a refactoring easier.

Do not weaken existing types unless there is a concrete reason.

Reuse existing domain types where appropriate.

## Naming

Use descriptive names based on responsibility.

Examples:

```text
QuestionEditor.tsx
QuestionList.tsx
TopicEditor.tsx
SectionEditor.tsx
StudyProgramEditor.tsx

useQuestionEditor.ts
useStudyProgram.ts

questionApi.ts
studyProgramApi.ts