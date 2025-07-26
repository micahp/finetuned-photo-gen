---
status: accepted
date: 2025-07-23
author: dev-team
description: Prevent Logs Hide/Show toggle from submitting video generation form
---

## Context
Users reported that clicking the “Hide” button on the Logs panel inside the Dashboard › Video page unintentionally triggered a new video generation. Root cause was that the `<button>` inside the `<form>` defaulted to `type="submit"` and therefore fired the form’s `onSubmit` handler.

## Decision
1. Convert the toggle to `type="button"` so it never submits the form.
2. Move the entire Logs card outside of the form element to eliminate any possibility of accidental submission by future controls placed inside the Logs panel.
3. Added a Jest regression test to ensure the toggle does not invoke generation (no fetch call).

## Consequences
* The Video generator UX is now predictable; toggling Logs visibility no longer starts a job.
* Future contributors have a pattern for placing diagnostic UI outside forms.
* The automated test prevents regressions. 