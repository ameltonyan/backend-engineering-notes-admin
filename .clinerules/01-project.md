# Project Context

## Application

This repository is `backend-engineering-notes-admin`.

It is the React/TypeScript administration and CMS application for the
Backend Engineering Interview Platform.

The overall system consists of three separate repositories:

- `backend-engineering-notes` — public React application
- `backend-engineering-notes-admin` — administration/CMS React application
- `backend-engineering-notes-api` — Spring Boot backend API

The admin application communicates with the Spring Boot API.

## Product Purpose

The platform is designed for backend/software engineering interview preparation.

The public application presents interview questions and answers and supports
interactive interview preparation.

The admin application is responsible for creating, editing, organising,
reviewing, and managing interview content.

## Existing Project

This is an existing application, not a greenfield project.

Before making changes:

1. Inspect the existing implementation.
2. Understand existing patterns and dependencies.
3. Reuse existing solutions where appropriate.
4. Make the smallest coherent change required.
5. Preserve existing behaviour unless the task explicitly requests a change.

Do not invent functionality, architecture, APIs, database structures, or
product requirements that are not supported by the existing code or task.

## Change Discipline

Do not combine unrelated refactoring with feature work.

Do not perform large rewrites when a focused change is sufficient.

Do not rename large numbers of files or variables without a concrete reason.

Do not remove existing functionality merely because it could be implemented
differently.

Before deleting or moving code, search the repository for its usages.

## Git Safety

Do not reset, revert, or overwrite existing user changes.

Do not discard uncommitted work.

Assume that changes already present in the working tree may be intentional.

Do not create Git commits unless explicitly requested.