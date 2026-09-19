# Backend Engineering Notes Admin — Copilot Instructions

## Repository Role

`backend-engineering-notes-admin` is the administration and content-authoring React application for the Backend Engineering Interview Platform.

The other repositories are:

* `backend-engineering-notes` — public candidate-facing React application
* `backend-engineering-notes-api` — Spring Boot backend API

The admin application is the primary place where administrators create, organize, review, improve, and publish interview content.

It should behave as a **content management and authoring system**, not merely as a generic CRUD application.

---

## Main Responsibility

Administrators should be able to manage the complete interview content structure, including:

* Topics
* Sections
* Questions
* Answers
* Follow-up questions
* Deeper follow-up questions
* Ordering
* Weekly preparation plans
* Monthly preparation plans
* Other future interview-training content

Content should normally be creatable in two ways:

1. Manually
2. With AI assistance

AI is an authoring assistant. It does not replace administrator review.

The administrator remains responsible for the final content.

---

# Content Hierarchy

The core interview content hierarchy is:

Topic
→ Section
→ Main Question
→ Follow-up
→ Deeper Follow-up

For example:

Java
→ Concurrency
→ LongAdder
→ What is LongAdder?
→ Why does LongAdder reduce contention?
→ When would AtomicLong be preferable?

The hierarchy should be explicit and easy for an administrator to understand.

Do not expose raw database relationships such as `parent_id` when a human-readable parent question can be displayed instead.

When creating a follow-up from a selected question, the selected question should naturally become its parent.

If hierarchy depth can be derived from the parent relationship, do not manually maintain a separate depth value unless the backend explicitly requires it.

---

# Content Ordering

The order configured in the admin application is the order that should be presented in the public application.

This applies to:

* Topics
* Sections
* Questions
* Follow-up questions
* Other ordered interview content

Ordering is part of the content model, not merely a frontend display preference.

When changing ordering:

* make the resulting order explicit
* preserve existing order unless the administrator changes it
* avoid accidental reordering
* ensure the public application receives the same intended order

Do not implement a separate frontend-only ordering system that can diverge from the backend content order.

---

# Manual Content Creation

Administrators must be able to create content manually.

Manual creation should support the appropriate fields for the content type, such as:

* title/question
* answer/reference answer
* description
* difficulty
* question type
* parent
* ordering
* other fields defined by the backend API

Use human-readable labels in the UI.

Do not expose internal database terminology unnecessarily.

For relationships, prefer controls such as:

* Parent question
* Section
* Topic

rather than raw IDs.

---

# AI-Assisted Content Creation

AI generation is an important part of the administration workflow.

The general workflow is:

Generate
→ Review
→ Edit
→ Approve
→ Save / Publish

Never treat AI output as automatically approved content.

AI-generated content must remain editable before it becomes authoritative content.

---

## AI Question Generation

Administrators should be able to request questions from the admin interface.

Generation should support controls such as:

* topic
* section
* requested question count
* difficulty
* question type
* additional context/guidance
* existing questions when relevant

For example, the admin may request:

> Generate 10 Java Core questions.

or:

> Generate 5 advanced concurrency interview questions.

The UI should make the generation parameters explicit rather than hiding important choices.

---

## AI Alternative Generation

When generating a question or answer, the administrator may select an **Alternative** option.

When Alternative is enabled, AI should generate two candidate alternatives.

The administrator can then:

1. choose one option and save it
2. edit one of the options
3. ask AI to merge the alternatives into a stronger result

The UI should make the alternatives clearly distinguishable.

Do not automatically select an alternative.

The administrator makes the final decision.

---

# AI Answer Improvement

The admin interface should provide AI-assisted answer improvement.

An administrator should be able to provide additional context and request an improved answer.

The improvement operation may expose controls such as:

* Humanized
* Simplify
* Shorten

These controls represent different editing intentions.

For example:

**Humanized**

Make the answer sound like a knowledgeable engineer explaining the concept naturally during a real interview.

**Simplify**

Explain the same concept using simpler language while preserving technical correctness.

**Shorten**

Make the answer more concise while preserving the important technical information.

These options may be combined when the backend supports it.

The administrator should be able to review the generated result before replacing the existing answer.

Do not silently overwrite existing content with AI output.

---

# AI Follow-Up Generation

Administrators should be able to generate follow-up questions from an existing question.

The flow should be:

Select question
→ Generate follow-ups
→ Review alternatives
→ Edit
→ Save

Follow-ups should be relevant to the parent question and should progressively test deeper understanding.

Generation should be possible from the admin UI as well as manually creating follow-ups.

The generated follow-ups should not automatically become published content.

---

# AI Merge

When two generated alternatives are available, the administrator may ask AI to merge them.

The merge operation should produce one stronger candidate based on the two inputs.

The administrator must still review the merged result before saving it.

Do not automatically replace both original alternatives with the merged answer without explicit administrator action.

---

# AI Curriculum Generation

The admin application should eventually support AI-assisted curriculum creation.

An administrator should be able to provide information such as:

* topic
* target role
* areas of focus
* desired number of sections
* additional guidance

AI can propose a curriculum/section structure.

The intended workflow is:

Generate curriculum
→ Review
→ Edit
→ Reorder
→ Approve
→ Save

AI should suggest structure, not silently determine the final curriculum.

---

# Weekly and Monthly Interview Plans

The admin application should eventually allow administrators to create and manage interview preparation plans.

Plans may be:

* weekly
* monthly
* customized

A preparation plan should be able to combine questions from different backend engineering areas.

The objective is to avoid overly narrow preparation where a candidate repeatedly receives questions from only one topic.

For example, a plan might intentionally combine:

* Java
* concurrency
* Spring
* SQL
* databases
* distributed systems
* APIs
* system design
* messaging
* performance
* testing
* debugging
* architecture

The admin interface should allow administrators to configure the composition and ordering of these plans.

Do not hard-code a specific future curriculum into the frontend.

The backend should ultimately be the source of truth for plan configuration and content.

---

# Future User-Personalized Features

The public application is expected to eventually support registered users and personal interview preparation.

The admin application should therefore be designed so future content can support:

* personalized preparation plans
* user-specific progress
* saved personal notes
* personalized questions
* AI-generated explanations
* additional user-requested questions
* paid/entitled content

These are future product capabilities.

Do not implement them unless explicitly requested.

However, do not make current admin functionality unnecessarily incompatible with these future requirements.

---

# Public Application Relationship

The public application is:

`backend-engineering-notes`

The admin application controls the curated content that the public application displays.

The conceptual flow is:

Admin creates/reviews content
↓
Backend stores authoritative content
↓
Public application reads content
↓
Candidate studies/practices

The admin UI should therefore prioritize content correctness and structure.

Do not create frontend-only content that bypasses the backend content model.

---

# Content Quality

The platform targets serious backend engineering interview preparation.

Questions should prioritize meaningful engineering understanding over memorization.

Useful question areas include:

* mechanisms
* why/how something works
* trade-offs
* limitations
* common misconceptions
* performance
* memory
* concurrency
* correctness
* debugging
* failure modes
* production decisions
* system design
* architecture

Avoid generating large numbers of low-value questions merely to increase content volume.

A smaller collection of high-quality questions is preferable to a large collection of repetitive or primitive questions.

Reference answers should sound like something a strong engineer could realistically explain in an interview.

Avoid textbook-style or unnecessarily academic wording.

---

# Content Review

AI-generated content must be easy to review.

The admin should be able to compare:

* generated content
* existing content
* alternatives
* merged content

where relevant.

Review should happen before saving authoritative content.

Prefer workflows that make it obvious:

* what AI generated
* what the administrator changed
* what will be saved
* what will replace existing content

Do not hide destructive or irreversible actions behind ambiguous buttons.

---

# Editing Existing Content

When improving existing content:

1. preserve the original until the administrator accepts the change
2. show the proposed AI result
3. allow editing
4. allow the administrator to accept or reject it

AI should assist editing rather than silently overwrite content.

If the administrator explicitly chooses to replace the existing answer, that action can be performed.

---

# UI / UX

The admin application should be optimized for efficient content authoring.

Unlike the public application, the admin UI may contain more controls because administrators need them.

However, complexity should still be organized rather than displayed all at once.

Prefer:

* clear hierarchy navigation
* contextual actions
* focused editors
* predictable forms
* explicit save actions
* clear AI actions
* clear review states
* breadcrumbs where useful

The primary hierarchy should be easy to navigate:

Topic
→ Section
→ Question
→ Follow-up

A useful conceptual layout is:

Left:
Content hierarchy/tree

Right:
Selected content editor

The tree should primarily show the content hierarchy.

Answers and large editing fields should appear in the selected item's editor rather than making the tree excessively large.

---

# AI UI Principles

AI actions should be visually identifiable but should not overwhelm ordinary editing.

Examples:

* `Generate`
* `Generate Alternatives`
* `Improve with AI`
* `Generate Follow-ups`
* `Merge with AI`
* `Simplify`
* `Humanize`
* `Shorten`

Use explicit labels instead of relying only on icons.

When an AI operation requires additional context, provide a clear input for that context.

The UI should make it clear whether an action:

* creates new content
* proposes an edit
* replaces content
* merges alternatives

Do not make AI actions destructive by default.

---

# Forms and Editing

Forms should distinguish between:

* required fields
* optional fields
* generated content
* administrator-authored content

Validation should happen before submission.

Do not duplicate backend validation rules unnecessarily, but provide useful immediate frontend validation where appropriate.

Error messages should explain what the administrator needs to fix.

---

# API Integration

The backend API is:

`backend-engineering-notes-api`

Do not invent API endpoints or response structures.

Before changing API usage:

1. inspect the existing API client/service code
2. inspect the backend controller and DTO contract when necessary
3. understand request and response structures
4. make the smallest compatible change

If a feature requires backend functionality that does not exist, identify the backend change rather than creating a fake frontend implementation.

Do not modify `backend-engineering-notes-api` unless explicitly asked.

Do not modify the public `backend-engineering-notes` application unless explicitly asked.

---

# Architecture and State

Keep frontend architecture proportional to the application.

Prefer:

* clear component responsibilities
* predictable data flow
* reusable components where reuse is genuine
* local state when global state is unnecessary
* existing project conventions

Do not introduce a new state-management library, component framework, or abstraction layer without a concrete need.

Do not build speculative infrastructure for every future roadmap feature.

Implement current requirements cleanly while keeping the design extensible.

---

# Destructive Actions

Deleting or replacing content can have consequences because content is shared with the public application.

Be careful with:

* deleting Topics
* deleting Sections
* deleting Questions
* deleting parent questions with children
* replacing answers
* reordering content
* publishing/unpublishing content

Require explicit administrator confirmation for destructive operations where appropriate.

Never silently cascade-delete content unless that behavior is explicitly defined by the backend and clearly communicated in the UI.

---

# Security

The admin application contains privileged content-management functionality.

Never expose:

* API keys
* passwords
* tokens
* database credentials
* provider secrets

in frontend source code.

Never put AI provider credentials in React code.

Authentication and authorization must ultimately be enforced by the backend.

Frontend visibility checks are UX behavior, not a security boundary.

---

# Development Rules

Before making changes:

1. Inspect the existing implementation.
2. Understand the current component, routing, API, and state structure.
3. Check whether the requested functionality already exists partially.
4. Reuse existing components and patterns where appropriate.
5. Identify the smallest reasonable change.

Do not rewrite working functionality merely because another implementation looks cleaner.

Do not modify unrelated parts of the application.

Do not introduce unnecessary dependencies.

Do not change API contracts without checking their callers and the backend implementation.

Do not implement future roadmap features unless explicitly requested.

---

# Verification

After meaningful changes:

* run the relevant frontend checks
* run the build when appropriate
* verify the affected workflow
* verify API error handling where relevant
* check the UI at realistic screen sizes when UI changes are involved

For AI-related UI changes, verify:

* loading state
* success state
* failure state
* empty response
* invalid response
* duplicate submission prevention where appropriate
* ability to review before saving

Do not claim that something has been verified if it has not actually been tested.

---

# Git

Do not commit or push changes unless explicitly asked.

Do not overwrite unrelated uncommitted changes.

Preserve existing work in the working tree.

Before making broad changes, inspect the current Git status.

---

# Communication

For substantial changes, first briefly explain:

1. what you found
2. what you propose to change
3. why

For small and obvious changes, proceed without unnecessary discussion.

When multiple approaches are reasonable, recommend one and explain the important trade-off.

If something is unclear, inspect the code before guessing.

Do not invent backend behavior, API contracts, or product requirements.
