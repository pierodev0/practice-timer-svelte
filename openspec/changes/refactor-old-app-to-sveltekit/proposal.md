# Propuesta: Refactor old-app (Vanilla JS) → SvelteKit + Svelte 5

## 1. Nombre del Cambio

`refactor-old-app-to-sveltekit`

---

## 2. Resumen Ejecutivo

Migrar la aplicación existente `old-app/` (Vanilla JS con pub/sub, manipulación directa del DOM, vistas modulares) a SvelteKit 2 + Svelte 5 (runes mode) + TypeScript 6 strict, manteniendo exactamente la misma funcionalidad, diseño visual y comportamiento. Se reemplaza la arquitectura de vistas basadas en `document.getElementById` por un modelo de componentes Svelte con estado reactivo (`$state`, `$derived`, `$effect`). Sin cambios funcionales — es un refactor sin migración de datos.

---

## 3. Problema / Oportunidad

| Aspecto | Problema actual (old-app) | Oportunidad (SvelteKit) |
|---------|--------------------------|--------------------------|
| **Estado** | Pub/sub manual (`_subscribers[]`, `_notify()`) con mutación directa de objetos | Reactividad granular con `$state`, `$derived`, `$effect` — sin boilerplate de notificaciones |
| **DOM** | `document.getElementById()` + `innerText/innerHTML` dispersos en 8 vistas | Template declarativo: cada componente renderiza su propio HTML, bindings automáticos |
| **Vistas** | `display: none/block` con clases `.active`, manejo manual de scroll y visibilidad | Condicionales `{#if}` + layouts SvelteKit; el framework maneja montaje/desmontaje |
| **Modales** | IDs globales en index.html con `.hidden` toggle | Componentes modales con props `show` + transiciones Svelte |
| **Firebase** | `import('./firebase/sync.js')` dinámico en `saveData()` | Import estático opcional con try/catch; patrón `$state` para estado de autenticación |
| **Timer** | Web Worker como archivo separado, `postMessage('tick')` | Worker se mantiene como archivo separado (`$lib/worker.ts`), envuelto en clase Svelte |
| **Tests** | Vitest (funcional) pero JS plano, sin cobertura de componentes | Vitest + testing-library/svelte para componentes, mismo patrón para módulos puros |
| **CDN** | `<script src="...">` en index.html cargan librerías globales | Se mantienen como CDN (FontAwesome, Sortable, Chart.js, Tone.js, ExcelJS) declaradas en app.html |

---

## 4. Alcance

### Incluye

- Migración completa de **todos los módulos** (`js/`, `js/views/`, `js/firebase/`) a `src/lib/`
- Migración de **todo el CSS** (`css/styles.css`) a un archivo `src/app.css` (mismos estilos, sin Tailwind migration)
- Migración de **todos los tests** (`tests/`) a `src/lib/` con TypeScript
- Web Worker (`js/worker.js`) portado a `src/lib/worker.ts` compatible con SvelteKit + Vite
- Service Worker (PWA) existente (`sw.js`) portado a Service Worker de SvelteKit
- Layout SvelteKit con un único `+page.svelte` que contiene la Bottom Nav y los componentes de cada tab
- Integración con Firebase Auth + Firestore Sync (offline-first, misma API)
- Todas las dependencias CDN (FontAwesome 6.4, Sortable 1.15, Chart.js, Tone.js 14.8, ExcelJS 4.4)
- 12 rutinas de muestra (módulo 1-12 de JustinGuitar)
- Mismo diseño responsive mobile-first con bottom-nav

### Excluye

- No se migra a Tailwind (se mantiene el CSS personalizado exacto)
- No se cambia la navegación (SPA con bottom-nav tabs, no SvelteKit routing entre páginas)
- No se instalan dependencias npm para Chart.js, Tone.js, ExcelJS, Sortable, FontAwesome
- No se migra a TypeScript las dependencias CDN (se usan `declare global` para tipos)
- No se refactoriza la lógica de negocio (es refactor, no reescritura funcional)
- No se modifica el esquema de persistencia (localStorage, misma clave `musicRoutineApp_v36_stats`)
- No se añaden nuevas funcionalidades

---

## 5. Enfoque Propuesto

### Arquitectura General

```
src/
├── app.html                 ← CDN scripts + %sveltekit.head% / %sveltekit.body%
├── app.css                  ← CSS completo migrado de old-app/css/styles.css
├── app.d.ts                 ← TypeScript declarations (CDN globals: Sortable, Tone, ExcelJS, Chart)
├── routes/
│   ├── +layout.svelte       ← Layout que carga app.css, CDN head tags
│   └── +page.svelte         ← Único page: BottomNav + vista activa condicional
├── lib/
│   ├── state/
│   │   ├── store.svelte.ts  ← $state central (getState → export functions, como old-app)
│   │   ├── utils.ts         ← formatTime, getFirstUrl, stringToColor, deepClone...
│   │   └── types.ts         ← Interfaces TypeScript: Routine, Exercise, Session, Stats
│   ├── components/
│   │   ├── BottomNav.svelte
│   │   ├── Dashboard/
│   │   │   ├── Dashboard.svelte     ← Header + BPM + PlayButton + ExerciseList
│   │   │   ├── ExerciseCard.svelte  ← Card individual con drag handle
│   │   │   └── TimerBar.svelte      ← Barra de progreso + temporizador
│   │   ├── Details/
│   │   │   ├── DetailsView.svelte   ← Editor de ejercicio individual
│   │   │   └── AttachmentList.svelte
│   │   ├── Routines/
│   │   │   ├── RoutinesView.svelte  ← CRUD de rutinas + import/export
│   │   │   └── RoutineCard.svelte
│   │   ├── History/
│   │   │   └── HistoryView.svelte   ← Historial mensual + export XLSX
│   │   ├── Stats/
│   │   │   ├── StatsView.svelte     ← Charts: weekly, doughnut, progress, schedule
│   │   │   └── StatCard.svelte
│   │   ├── Settings/
│   │   │   ├── SettingsView.svelte  ← Archived, backup, cloud sync, danger zone
│   │   │   ├── SyncSection.svelte   ← Login Google + auto-sync toggle
│   │   │   └── BackupManager.svelte ← Cloud backups overlay
│   │   └── Modals/
│   │       ├── CreateExerciseModal.svelte
│   │       ├── StatInputModal.svelte
│   │       ├── FinishModal.svelte
│   │       ├── ResetModal.svelte
│   │       ├── EditStatsModal.svelte
│   │       ├── EditSessionModal.svelte
│   │       └── ImageLightbox.svelte
│   ├── audio.ts            ← Tone.js metronome (misma lógica, envuelta en $effect)
│   ├── export.ts           ← ExcelJS export (misma API, tipos añadidos)
│   ├── worker.ts           ← Web Worker (mismo código JS, compatible con Vite)
│   └── firebase/
│       ├── config.ts       ← Firebase init (mismas credenciales)
│       ├── auth.ts         ← Google Auth (popup/redirect)
│       ├── sync.ts         ← Firestore sync (upload, download, merge, listener)
│       ├── serializer.ts   ← Serialización de datos para Firestore
│       ├── merge.ts        ← Merge de datos locales + remotos
│       └── device.ts       ← Device info para sync
```

### Patrón de Estado (store)

En lugar de una clase con pub/sub, se usa un módulo Svelte 5 con `$state`:

```typescript
// src/lib/state/store.svelte.ts
// NOTA: este archivo usa extensión .svelte.ts para que Svelte 5 procese los runes

let isExercisePlaying = $state(false);
let bpm = $state(120);
let globalSeconds = $state(0);
let routines = $state<Routine[]>([]);
// ...

export function getState() {
  return {
    get isExercisePlaying() { return isExercisePlaying; },
    get bpm() { return bpm; },
    get globalSeconds() { return globalSeconds; },
    // ...
  };
}

export function setBpm(val: number) { bpm = Math.max(1, Math.min(300, val)); }
export function adjustBpm(delta: number) { setBpm(bpm + delta); }
// ...
```

Los componentes acceden a `getState()` directamente en el template — la reactividad fluye automáticamente porque Svelte 5 trackea los getters en tiempo de render.

### Persistencia

`saveData()` serializa el estado a localStorage (misma clave). Se envuelve en un `$effect.root` que subscribe a cambios. El cloud sync se dispara desde el mismo `saveData()` con debounce, igual que en old-app.

### Web Worker

Se crea `src/lib/worker.ts` como un Worker URL (misma técnica que old-app: `new URL('./worker.ts', import.meta.url)`). El worker mantiene exactamente la misma lógica (`'start'`/`'stop'` → `'tick'`). Se crea en `+page.svelte` dentro de `onMount`.

### Firebase (offline-first)

Los módulos de Firebase se importan estáticamente pero envueltos en try/catch para que nunca rompan el offline. El patrón es idéntico: `observeAuth()`, `downloadAndMergeState()`, `startSyncListener()`, etc. El estado de autenticación se expone como `$state` para que la UI reaccione.

### CDN (nueve dependencias globales)

En `app.html`, se declaran los CDN scripts/link tags. En `app.d.ts`, se declaran los tipos globales:

```typescript
declare global {
  const Sortable: typeof import('sortablejs');
  const Tone: any;
  const ExcelJS: any;
  // Chart.js se declara en el canvas vía Chart构造函数
}
```

---

## 6. Decisiones de Diseño Tomadas

| Decisión | Opción elegida | Alternativa descartada | Razón |
|----------|---------------|----------------------|-------|
| **Routing** | SPA con `+page.svelte` único + BottomNav con `$state('practice')` | Rutas SvelteKit (`/practice`, `/routines`, ...) | La old-app es SPA con tabs; migrar a rutas implicaría recargas y pérdida de estado del timer en ejecución |
| **Estado global** | Módulo `.svelte.ts` con `$state` por variable | Clase singleton, stores Svelte 4 | `$state` es el mecanismo nativo de Svelte 5; evita wrapping y es más performante |
| **Componentes de vista** | Un componente por vista (Dashboard, Routines, History, Stats, Settings, Details, Modals) | Un solo componente gigante con `{#if}` | Separación limpia, testable, mantenible |
| **Estado autenticación** | `$state` en store + efecto para UI reactiva | Context API | El estado de auth afecta múltiples vistas no anidadas; store es más directo |
| **Import Firebase** | Estático (con try/catch graceful) | Dinámico (`import()`) | La comprobación offline debe ser robusta; el import estático permite type checking |
| **Worker** | Archivo separado con `new Worker(new URL(...))` | `setInterval` en main thread | La old-app usa Worker para precisión en background; mismo comportamiento requerido |
| **TDD** | Tests unitarios Vitest para módulos puros + tests de componentes Svelte | Solo tests de componentes | Los módulos de estado/lógica pura son más rápidos de testear sin browser |
| **Diseño responsive** | Móvil-first con bottom-nav fija + vista única | Desktop-first con sidebar | La old-app ya es mobile-first; mantener misma UX |

---

## 7. Estructura de Componentes Svelte Propuesta

```
+page.svelte (raíz)
├── ImageLightbox
├── StatInputModal
├── EditStatsModal
├── EditSessionModal
├── FinishModal
├── ResetModal
├── CreateExerciseModal
│
├── {#if activeTab === 'practice'}
│   ├── Dashboard
│   │   ├── TimerBar
│   │   └── ExerciseCard (x N, con drag handle Sortable)
│   └── DetailsView (cuando viewingExerciseId !== null)
│       └── AttachmentList
│
├── {#if activeTab === 'routines'}
│   └── RoutinesView
│       └── RoutineCard (x N)
│
├── {#if activeTab === 'history'}
│   └── HistoryView
│
├── {#if activeTab === 'stats'}
│   └── StatsView
│       └── StatCard (x 4 summary)
│
├── {#if activeTab === 'settings'}
│   └── SettingsView
│       ├── SyncSection
│       └── BackupManager
│
└── BottomNav
```

### Flujo de datos

```
User Action → Component event handler → state mutation function → $state reactivo
                                                                    ↓
                                              Template se re-renderiza automáticamente
                                                                    ↓
                                              saveData() (localStorage + cloud sync)
```

El Web Worker postea `'tick'` → `onWorkerTick()` en el store modifica `globalSeconds` y `exerciseRemaining` → el template de Dashboard se actualiza solo.

---

## 8. Mapa de Migración (old-app → src/)

| old-app (vanilla JS) | SvelteKit (src/) | Tipo |
|----------------------|------------------|------|
| `index.html` (DOM completo) | `src/routes/+page.svelte` + `src/app.html` | Dividido |
| `css/styles.css` | `src/app.css` | Copia directa |
| `js/state.js` | `src/lib/state/store.svelte.ts` | Refactor (pub/sub → $state) |
| `js/utils.js` | `src/lib/state/utils.ts` | Refactor (JS → TS) |
| — | `src/lib/state/types.ts` | Nuevo (tipos TS) |
| `js/audio.js` | `src/lib/audio.ts` | Refactor (JS → TS) |
| `js/export.js` | `src/lib/export.ts` | Refactor (JS → TS) |
| `js/worker.js` | `src/lib/worker.ts` | Copia (misma lógica) |
| `js/views/dashboard.js` | `src/lib/components/Dashboard/*.svelte` | Refactor completo |
| `js/views/details.js` | `src/lib/components/Details/DetailsView.svelte` | Refactor completo |
| `js/views/routines.js` | `src/lib/components/Routines/RoutinesView.svelte` | Refactor completo |
| `js/views/history.js` | `src/lib/components/History/HistoryView.svelte` | Refactor completo |
| `js/views/stats.js` | `src/lib/components/Stats/StatsView.svelte` | Refactor completo |
| `js/views/settings.js` | `src/lib/components/Settings/SettingsView.svelte` | Refactor completo |
| `js/views/modals.js` | `src/lib/components/Modals/*.svelte` (7 modales) | Dividido |
| `js/views/bottom-nav.js` | `src/lib/components/BottomNav.svelte` | Refactor completo |
| `js/app.js` | `src/routes/+page.svelte` (init logic en onMount) | Refactor |
| `js/routines-sample.js` | `src/lib/state/routines-sample.ts` | Copia (JS → TS) |
| `js/firebase/config.js` | `src/lib/firebase/config.ts` | Copia (JS → TS) |
| `js/firebase/auth.js` | `src/lib/firebase/auth.ts` | Refactor (JS → TS) |
| `js/firebase/sync.js` | `src/lib/firebase/sync.ts` | Refactor (JS → TS) |
| `js/firebase/serializer.js` | `src/lib/firebase/serializer.ts` | Copia (JS → TS) |
| `js/firebase/merge.js` | `src/lib/firebase/merge.ts` | Copia (JS → TS) |
| `js/firebase/device.js` | `src/lib/firebase/device.ts` | Copia (JS → TS) |
| `tests/state.test.js` | `src/lib/state/store.test.ts` | Refactor (JS → TS) |
| `tests/utils.test.js` | `src/lib/state/utils.test.ts` | Refactor (JS → TS) |
| `tests/worker.test.js` | `src/lib/worker.test.ts` | Refactor (JS → TS) |
| `tests/firebase-merge.test.js` | `src/lib/firebase/merge.test.ts` | Copia (JS → TS) |
| `tests/firebase-serializer.test.js` | `src/lib/firebase/serializer.test.ts` | Copia (JS → TS) |
| `public/` (manifest, icons, sw.js) | `static/` | Copia directa |

---

## 9. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| **Pérdida de datos de usuarios reales** | Baja | Crítico | Mantener misma clave de localStorage (`musicRoutineApp_v36_stats`), mismo schema. Rollback = restaurar old-app |
| **Regresión en el timer (precisión)** | Media | Alto | Worker idéntico, tests de integración con fake timers. Validar que `onWorkerTick` se ejecuta cada 1s |
| **Firebase sync race conditions** | Media | Medio | Seguir mismo patrón de old-app: `downloadAndMerge` → `startSyncListener`. Tests de integración con emulador |
| **Drag & drop (Sortable.js)** | Media | Medio | Sortable se attacha al contenedor del ExerciseList en `onMount` + `afterUpdate`. Re-inicializar tras reorden |
| **CDNs caídos / offline** | Baja | Medio | Las dependencias CDN (FontAwesome, Chart.js, etc.) tienen fallback visual. ExcelJS/Tone ya tienen guard `if (!window.ExcelJS) alert(...)` |
| **Rendimiento con muchos ejercicios** | Baja | Bajo | La old-app maneja ~50 ejercicios bien. Svelte 5 con $state es más eficiente que pub/sub manual |

### Rollback Plan

1. Revertir todos los cambios en `src/` a la versión anterior (`git revert`)
2. Si se modificó `app.html`, restaurar la versión original
3. Los datos de usuario en localStorage no se pierden (misma clave)
4. La old-app sigue existiendo en `old-app/` como referencia

---

## 10. Criterios de Éxito

- [ ] **Funcionalidad completa**: Las 5 vistas principales (practice, routines, history, stats, settings) funcionan idéntico a old-app
- [ ] **Timer preciso**: El worker tickea cada 1s, el contador global avanza, los ejercicios se completan al llegar a 0
- [ ] **Persistencia**: Los datos se guardan en localStorage y se cargan al recargar la página
- [ ] **Cloud Sync**: Login con Google, subida/descarga desde Firestore, sync automático, backups en la nube
- [ ] **Metrónomo**: Tone.js se inicializa en el primer click, metrónomo suena al ritmo del BPM configurado
- [ ] **Export XLSX**: exportDay y exportMonth generan archivos .xlsx con ExcelJS
- [ ] **Drag & drop**: Sortable.js funciona en la lista de ejercicios, persiste el orden
- [ ] **PWA**: Service worker registrado, manifest presente, instalable
- [ ] **Tests**: Todos los tests de old-app migrados y pasando en Vitest (browser + node)
- [ ] **Sin regresiones visuales**: El diseño, colores, tipografía y layout son idénticos
- [ ] **Sin errores TypeScript**: `svelte-check` pasa sin errores
