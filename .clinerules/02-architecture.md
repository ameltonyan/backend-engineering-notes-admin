# Architecture Guidelines

## General Principle

Prefer simple, maintainable architecture over unnecessary abstraction.

Do not introduce frameworks, libraries, design patterns, or abstractions
without a concrete reason.

The objective is clear separation of responsibilities, not maximizing the
number of files, folders, classes, or components.

## React Application Structure

Use appropriate React/TypeScript concepts such as:

- components
- feature components
- custom hooks
- API/service modules
- types
- utilities
- constants
- pages/views where appropriate

Prefer feature-oriented organisation when the application naturally contains
distinct features.

Do not blindly impose a predefined folder structure.

Inspect the existing application and choose boundaries based on actual
responsibilities and dependencies.

## Responsibilities

Prefer a structure conceptually similar to:

UI Components
    ↓
Feature logic / custom hooks
    ↓
API / services
    ↓
Backend API

Components should primarily handle presentation and UI interaction.

Custom hooks may contain coherent stateful feature behaviour.

API/service modules should contain substantial backend communication.

Pure reusable logic may belong in utilities.

## App.tsx

`App.tsx` should remain a thin application/root component.

It may contain:

- application composition
- routing
- top-level providers
- top-level layout
- selection/rendering of major views

It should not become a container for the majority of application logic.

Avoid keeping large amounts of:

- feature-specific state
- API calls
- complex event handlers
- business logic
- data transformation
- forms
- modals
- large feature-specific JSX

inside `App.tsx`.

## Components

Create components around meaningful UI responsibilities.

Do not create a component for every small JSX fragment.

Avoid excessive component fragmentation.

A component should have a clear reason to exist independently.

## Hooks

Extract logic into custom hooks when it represents a coherent stateful
or side-effect-driven responsibility.

Do not create hooks simply to move code from one file to another.

Do not move trivial state into hooks without a meaningful benefit.

Keep state at the lowest appropriate level.

## State Management

Do not introduce global state management unless there is a concrete need.

Do not introduce Redux, Zustand, or another state-management library merely
to refactor existing code.

If state is only needed by one component, prefer keeping it local.

If state is shared, determine the appropriate owner and data flow based on
actual usage.

Avoid duplicated sources of truth.

## API / Services

Keep substantial HTTP/API communication outside presentation components
when a clean separation is appropriate.

Use the existing API/service approach if one already exists.

Do not change backend endpoints, request structures, response structures,
or API contracts during a frontend refactoring unless explicitly required.

If an API contract is unclear, inspect the existing frontend and backend
code before guessing.

## Types

Keep TypeScript types in sensible locations.

Feature-specific types should generally remain close to their feature when
appropriate.

Avoid creating a giant global types file containing unrelated definitions.

Avoid duplicating equivalent types.

## Dependencies

Maintain a clear dependency direction.

Avoid circular dependencies.

Do not make low-level utilities depend on UI components.

Do not create unnecessary cross-feature dependencies.

## Refactoring

When refactoring:

1. Understand the current responsibilities.
2. Identify logical boundaries.
3. Move code with minimal behavioural change.
4. Update imports and dependencies.
5. Remove obsolete implementations.
6. Verify that there is only one source of truth.
7. Run type checking/build/tests.

Do not rewrite working code unnecessarily.