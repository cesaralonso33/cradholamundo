# UI/UX Conservative Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the frontend's visual hierarchy, navigation clarity, responsive behavior, and feedback states without changing business behavior or API contracts.

**Architecture:** Keep Vue Router, the shared authenticated header in `App.vue`, and Tailwind-based styles. Add only lightweight shared visual primitives/classes in the existing stylesheet; update the most-used views in place rather than introducing a new UI framework.

**Tech Stack:** Vue 3, TypeScript, Vue Router, Tailwind utility classes, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-11-05-uiux-pulido-conservador.md`

## Global Constraints

- No changes to models, endpoints, permissions, offline sync, or business rules.
- No new heavy visual dependency or replacement of Tailwind.
- Preserve all existing routes, forms, and permission-conditioned links.
- Keep login free of the authenticated navigation.
- Maintain keyboard focus visibility and responsive behavior.

## Review Focus

- Narrow viewport: navigation must wrap or collapse without horizontal overflow; test computed/layout classes in `App.vue`.
- Missing permissions: restricted links must remain absent; test admin and limited users.
- Loading/error/empty states: content must remain understandable and actions recoverable; test representative states in Inventory and Settings.
- Long labels and validation errors: controls must not shift unpredictably or become inaccessible; test visible alert and form layout.
- Existing authenticated session: refresh must preserve the header and user action; test `inv_user` initialization.

---

### Task 1: Shared visual language and authenticated navigation

**Files:**
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/style.css`
- Test: `frontend/src/__tests__/App.test.ts` or the existing frontend test location

**Interfaces:**
- Consumes: `useAuth()`, `useRoute()`, `SyncStatusBadge`.
- Produces: stable authenticated header structure with accessible navigation, user identity, sync status, and logout action.

- [ ] **Step 1: Write failing tests** for authenticated header visibility, hidden login header, permission-filtered links, and narrow-screen wrapping classes.
- [ ] **Step 2: Run the focused tests** and verify they fail for the new visual assertions.
- [ ] **Step 3: Refine `App.vue`** with grouped navigation, clearer active-link treatment, a compact user/action area, and responsive wrapping without changing permission logic.
- [ ] **Step 4: Add shared visual tokens/classes** in `style.css` for page background, surface, focus ring, primary/secondary buttons, alerts, and muted text.
- [ ] **Step 5: Run focused tests** and verify they pass.
- [ ] **Step 6: Run the Impeccable detector** against `App.vue` and `style.css`; resolve critical findings only within scope.
- [ ] **Step 7: Commit** with `git commit -m "style: polish authenticated navigation"`.

### Task 2: Inventory and Papelería operational surfaces

**Files:**
- Modify: `frontend/src/views/Inventory.vue`
- Modify: `frontend/src/views/Papeleria.vue`
- Test: existing frontend view/API tests

**Interfaces:**
- Consumes: existing API functions, Zod schemas, offline/conflict handling, and shared visual classes from Task 1.
- Produces: clearer operational cards, primary actions, tables, empty states, and movement/order feedback without changing payloads.

- [ ] **Step 1: Add failing view-level assertions** for visible page title, primary action hierarchy, loading/empty/error feedback, and conflict messaging.
- [ ] **Step 2: Run the focused tests** and verify the new assertions fail.
- [ ] **Step 3: Improve Inventory layout** using consistent surface/card spacing, clearer filters, a visually distinct movement form, and accessible success/error/empty states.
- [ ] **Step 4: Improve Papelería layout** with clearer order/item sections, primary submit/close actions, and visible loading/error/empty states.
- [ ] **Step 5: Run frontend tests and build**; verify all existing API payload tests remain green.
- [ ] **Step 6: Run the Impeccable detector** on both views and resolve actionable findings.
- [ ] **Step 7: Commit** with `git commit -m "style: clarify inventory and stationery workflows"`.

### Task 3: Employees and Settings forms

**Files:**
- Modify: `frontend/src/views/Employees.vue`
- Modify: `frontend/src/views/Settings.vue`
- Test: existing frontend form/settings tests

**Interfaces:**
- Consumes: existing Zod validation, `ApiError`, admin checks, upload and backup APIs.
- Produces: forms with clearer grouping, visible validation, upload/backup warnings, and recoverable loading/error states.

- [ ] **Step 1: Add failing assertions** for invalid form feedback, upload state, backup warning/confirmation, and retryable API errors.
- [ ] **Step 2: Run focused tests** and verify failure.
- [ ] **Step 3: Polish Employees** with field grouping, inline validation, upload affordance, and explicit empty/error states.
- [ ] **Step 4: Polish Settings** with section hierarchy, distinct safe/sensitive backup actions, warning copy, and visible request status.
- [ ] **Step 5: Run frontend tests and build**; verify permissions and API calls are unchanged.
- [ ] **Step 6: Run the Impeccable detector** on both views.
- [ ] **Step 7: Commit** with `git commit -m "style: improve employee and settings forms"`.

### Task 4: Final responsive/accessibility verification

**Files:**
- Modify only files needed to resolve verified findings from Tasks 1–3.
- Test: full frontend suite and existing Playwright/UI checks where available.

**Interfaces:**
- Consumes: completed visual language and view updates.
- Produces: verified frontend polish with no functional regression.

- [ ] **Step 1: Run `npm test` in `frontend/`** and record the complete result.
- [ ] **Step 2: Run `npm run build` in `frontend/`** and record the complete result.
- [ ] **Step 3: Run `git diff --check`** and confirm no whitespace errors.
- [ ] **Step 4: Run the Impeccable detector** across all modified UI files and review at desktop/mobile widths if a browser environment is available.
- [ ] **Step 5: Verify permission-filtered navigation and login exclusion** with the existing tests.
- [ ] **Step 6: Update `frontend-report.md` and `PROGRESO_MIGRACION.md`** with actual results only.
- [ ] **Step 7: Commit final documentation/verification changes** with `git commit -m "docs: verify conservative UI polish"`.
