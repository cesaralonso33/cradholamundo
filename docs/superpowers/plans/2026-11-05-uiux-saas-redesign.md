# SaaS UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure the Vue frontend into a spacious, modern SaaS experience while preserving all routes, permissions, API calls, offline sync, and business workflows.

**Architecture:** Keep the existing Vue Router and Tailwind foundation, expand the current shadcn-vue-compatible primitives, and introduce one authenticated app shell plus reusable page-header, state, and surface patterns. Migrate views incrementally so each task remains runnable and testable.

**Tech Stack:** Vue 3, TypeScript, Tailwind CSS, shadcn-vue patterns, `@lucide/vue`, Vitest, Vite.

**Spec:** `docs/superpowers/specs/2026-11-05-uiux-saas-redesign.md`

## Global Constraints

- No changes to business rules, models, endpoints, permissions, or offline sync.
- Preserve every existing route and flow.
- Do not reintroduce PrimeVue.
- Use reusable shadcn-vue-style components only where duplication is reduced.
- Maintain keyboard accessibility, responsive behavior, and visible loading/error/empty states.

## Review Focus

- Session loss on refresh: authenticated shell must remain hidden only when `/api/auth/me` actually fails; test persisted session behavior.
- Limited permissions: grouped navigation must not expose unauthorized modules; test regular and admin users.
- Mobile drawer behavior: focusable controls and route changes must not leave an inaccessible overlay; test open/close and navigation.
- Empty/error/loading states: every primary module must explain recovery or next action; test representative states.
- Long tables and forms: desktop density must not force horizontal overflow on mobile; test responsive class structure and table fallback.

---

### Task 1: Expand shadcn-vue foundation

**Files:**
- Create: `frontend/src/components/ui/{Badge,Alert,Skeleton,Separator,PageHeader}.vue`
- Modify: `frontend/src/components/ui/Button.vue`, `Card.vue`
- Modify: `frontend/src/lib/utils.ts`
- Test: `frontend/src/components/ui/*.test.ts`

- [ ] Write failing tests for variants, accessible attributes, and composition of the new primitives.
- [ ] Run focused tests and verify RED.
- [ ] Implement the primitives with Tailwind classes and `cn()`.
- [ ] Run focused tests and verify GREEN.
- [ ] Commit `feat: expand shadcn ui foundation`.

### Task 2: Rebuild authenticated SaaS shell

**Files:**
- Modify: `frontend/src/App.vue`, `frontend/src/style.css`
- Modify: `frontend/src/App.navigation.test.ts`

- [ ] Add failing tests for desktop sidebar, mobile drawer, grouped permissions, active route, and logout.
- [ ] Run focused tests and verify RED.
- [ ] Implement persistent desktop sidebar, mobile drawer/scrim, contextual top bar, route-aware active state, and user menu using Lucide icons and UI primitives.
- [ ] Run navigation tests and verify GREEN.
- [ ] Run the Impeccable detector on shell files.
- [ ] Commit `feat: rebuild SaaS application shell`.

### Task 3: Redesign Inventory landing experience

**Files:**
- Modify: `frontend/src/views/Inventory.vue`
- Modify: `frontend/src/components/QuickInventoryForm.vue`, `InventoryMovementPanel.vue`, `RecentCapturesTable.vue`
- Test: existing inventory component tests plus new view assertions

- [ ] Add failing tests for page header, metric summaries, quick actions, empty state, and movement feedback.
- [ ] Run focused tests and verify RED.
- [ ] Implement the SaaS inventory home: welcome context, lightweight metrics derived from existing data, quick actions, capture/movement cards, and responsive recent activity.
- [ ] Preserve all existing events, API calls, offline sync, and pagination.
- [ ] Run inventory tests and verify GREEN.
- [ ] Commit `feat: redesign inventory SaaS landing`.

### Task 4: Redesign Papelería and Employees workflows

**Files:**
- Modify: `frontend/src/views/Papeleria.vue`, `frontend/src/views/Employees.vue`
- Test: existing related tests plus view-level assertions

- [ ] Add failing tests for page headers, tab semantics, form sections, empty states, upload feedback, and mobile table behavior.
- [ ] Run focused tests and verify RED.
- [ ] Implement spacious forms, clear primary actions, responsive data cards/tables, and actionable empty/error states.
- [ ] Preserve order lifecycle, permissions, uploads, imports, and API payloads.
- [ ] Run frontend tests and build.
- [ ] Commit `feat: redesign operations workflows`.

### Task 5: Redesign Settings, API docs, and secondary views

**Files:**
- Modify: `frontend/src/views/Settings.vue`, `ApiDocs.vue`, `Users.vue`, `Roles.vue`, `Audit.vue`, `History.vue`
- Test: existing Settings/navigation tests plus new page-header/state assertions

- [ ] Add failing tests for section hierarchy, sensitive backup confirmation, API docs readability, and empty/error states.
- [ ] Run focused tests and verify RED.
- [ ] Apply shared PageHeader/Card/Alert patterns and preserve all permission checks and backup safety warnings.
- [ ] Run full frontend suite and build.
- [ ] Commit `feat: polish SaaS secondary modules`.

### Task 6: Responsive and visual verification

**Files:**
- Modify only files required by verified findings.
- Update: `.superpowers` progress/report artifacts if tracked for this work.

- [ ] Run frontend tests and build from a clean working tree.
- [ ] Run `git diff --check`.
- [ ] Run Impeccable detector across every modified UI file.
- [ ] Run available Playwright flows at desktop and mobile viewport sizes.
- [ ] Verify no PrimeVue references and no API/backend file changes.
- [ ] Commit final verification documentation.
