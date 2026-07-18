# Tasks: Refactor Old App to SvelteKit

## Review Workload Forecast

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

~4,000 lines across 40+ files. Exceeds 400-line budget 10×. Needs 4 chained PRs.

| Unit | Goal | PR | Focused test | Runtime |
|------|------|----|--------------|---------|
| 1 | Types + Store + Shell + Audio | PR 1 | `pnpm test:unit src/lib/state/ src/lib/worker.test.ts` | `pnpm dev` |
| 2 | Dashboard + Details + Modals | PR 2 | test:unit Dashboard/ Details/ Modals/ | create exercise + timer |
| 3 | Views + Firebase | PR 3 | test:unit Routines/ History/ Stats/ firebase/ | all tabs + login |
| 4 | Settings + PWA + Tests | PR 4 | `pnpm test:unit && pnpm check` | `pnpm build` |

Each unit has clean `git revert` rollback.

## Phase 1: Foundation (PR 1)

- [x] 1.1 `src/lib/state/types.ts` — all interfaces
- [x] 1.2 `src/lib/state/utils.ts` — port formatTime, getFirstUrl, stringToColor, deepClone, etc.
- [x] 1.3 `src/lib/state/routines-sample.ts` — 12 JustinGuitar modules
- [x] 1.4 `src/lib/state/store.svelte.ts` — $state, getState proxy, all mutations, save/load/reset
- [x] 1.5 `src/lib/state/store.test.ts` — state tests (spec §8.1)
- [x] 1.6 `src/lib/state/utils.test.ts` — util tests (spec §8.2)
- [x] 1.7 `src/app.html` — CDN scripts + meta
- [x] 1.8 `src/app.css` — exact copy of old-app/css/styles.css
- [x] 1.9 `src/app.d.ts` — global types (Sortable, Tone, Chart, ExcelJS)
- [x] 1.10 `src/routes/+layout.svelte` — imports app.css
- [x] 1.11 `src/routes/+page.svelte` shell — activeTab, modals, onMount
- [x] 1.12 `src/lib/components/BottomNav.svelte` — 5 tabs
- [x] 1.13 `src/lib/worker.ts` — start/stop/tick Worker
- [x] 1.14 `src/lib/audio.ts` — Tone.js metronome
- [x] 1.15 `src/lib/worker.test.ts` — worker lifecycle

## Phase 2: Core UI (PR 2)

- [ ] 2.1 `Dashboard/TimerBar.svelte`
- [ ] 2.2 `Dashboard/ExerciseCard.svelte` — play/stop, progress, badges
- [ ] 2.3 `Dashboard/Dashboard.svelte` — BPM, audio, FINISH/RESET, Sortable
- [ ] 2.4 `Details/AttachmentList.svelte`
- [ ] 2.5 `Details/DetailsView.svelte` — exercise editor
- [ ] 2.6–2.12 7 modals: CreateExercise, StatInput, Finish, Reset, EditStats, EditSession, ImageLightbox

## Phase 3: Views & Firebase (PR 3)

- [ ] 3.1 `Routines/RoutineCard.svelte`
- [ ] 3.2 `Routines/RoutinesView.svelte` — CRUD, import/export
- [ ] 3.3 `src/lib/export.ts` — ExcelJS exports
- [ ] 3.4 `History/HistoryView.svelte`
- [ ] 3.5 `Stats/StatCard.svelte`
- [ ] 3.6 `Stats/StatsView.svelte` — 4 Chart.js charts
- [ ] 3.7 `src/lib/firebase/config.ts` — init
- [ ] 3.8 `src/lib/firebase/auth.ts` — Google Auth
- [ ] 3.9 `src/lib/firebase/device.ts` — UUID
- [ ] 3.10 `src/lib/firebase/serializer.ts`
- [ ] 3.11 `src/lib/firebase/merge.ts`
- [ ] 3.12 `src/lib/firebase/sync.ts` — upload, download, schedule, listener, backups
- [ ] 3.13 `firebase/serializer.test.ts`
- [ ] 3.14 `firebase/merge.test.ts`
- [ ] 3.15 Wire Firebase in +page.svelte

## Phase 4: Polish & Component Tests (PR 4)

- [ ] 4.1 `Settings/SyncSection.svelte`
- [ ] 4.2 `Settings/BackupManager.svelte`
- [ ] 4.3 `Settings/SettingsView.svelte`
- [ ] 4.4 Copy manifest.json + icons to `static/`
- [ ] 4.5 SvelteKit Service Worker
- [ ] 4.6–4.14 Component tests: BottomNav, ExerciseCard, TimerBar, CreateExerciseModal, StatInputModal, FinishModal, ResetModal, DetailsView, HistoryView
- [ ] 4.15 `pnpm check && pnpm lint && pnpm build`
