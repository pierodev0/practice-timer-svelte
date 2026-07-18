# SDD Design: refactor-old-app-to-sveltekit

> Diseño técnico detallado para la migración de `old-app/` (Vanilla JS) a SvelteKit 2 + Svelte 5 (runes mode) + TypeScript 6 strict.

---

## Índice

1. [Estado Global (Store) — Arquitectura](#1-estado-global-store--arquitectura)
2. [Component Tree — Relaciones completas](#2-component-tree--relaciones-completas)
3. [Web Worker Integration](#3-web-worker-integration)
4. [Audio Service](#4-audio-service)
5. [Modal System](#5-modal-system)
6. [Firebase Integration](#6-firebase-integration)
7. [CDN Global Dependencies](#7-cdn-global-dependencies)
8. [CSS Migration Strategy](#8-css-migration-strategy)
9. [Key Implementation Sequences](#9-key-implementation-sequences)
10. [Implementation Order](#10-implementation-order-batches)

---

## 1. Estado Global (Store) — Arquitectura

### 1.1 Archivo: `src/lib/state/store.svelte.ts`

El store es un **módulo Svelte 5** con extensión `.svelte.ts`. NO es una clase singleton — es un módulo que declara variables `$state` a nivel de módulo y exporta funciones getter/mutator. El compilador de Svelte 5 procesa los runes (`$state`, `$derived`, `$effect`) porque el archivo termina en `.svelte.ts`.

```typescript
// src/lib/state/store.svelte.ts

// --- Variables de estado ($state) ---
let isExercisePlaying = $state(false);
let isAudioOn = $state(false);
let bpm = $state(120);
let globalSeconds = $state(0);
let sessionStartedAt = $state<number | null>(null);
let activeExerciseId = $state<string | null>(null);
let exerciseRemaining = $state(0);
let viewingExerciseId = $state<string | null>(null);
let autoplayRoutine = $state(false);
let pendingDetailCompletion = $state(false);
let routines = $state<Routine[]>([]); // se rellena en loadData()
let currentRoutineId = $state('module-1');
let newExerciseForm = $state<NewExerciseForm>({ bpm: 100, min: 2, sec: 0, reps: 1 });
let stats = $state<Record<string, StatsEntry>>({});
let sessions = $state<Session[]>([]);
```

### 1.2 El patrón `getState()` — Proxy de solo lectura

Se exporta un **proxy con getters** que permite a los templates de Svelte trackear reactividad automáticamente. Cuando un componente accede a `getState().bpm` dentro del template, Svelte 5 registra la dependencia y re-renderiza solo cuando `bpm` cambia.

```typescript
export function getState(): StateProxy {
  return {
    get isExercisePlaying() { return isExercisePlaying; },
    get isAudioOn() { return isAudioOn; },
    get bpm() { return bpm; },
    get globalSeconds() { return globalSeconds; },
    get sessionStartedAt() { return sessionStartedAt; },
    get activeExerciseId() { return activeExerciseId; },
    get exerciseRemaining() { return exerciseRemaining; },
    get viewingExerciseId() { return viewingExerciseId; },
    get autoplayRoutine() { return autoplayRoutine; },
    get pendingDetailCompletion() { return pendingDetailCompletion; },
    get routines() { return routines; },
    get currentRoutineId() { return currentRoutineId; },
    get newExerciseForm() { return newExerciseForm; },
    get stats() { return stats; },
    get sessions() { return sessions; },
  };
}
```

**¿Cómo funciona la reactividad?** Svelte 5 trackea automáticamente cualquier acceso a una variable `$state` dentro de un template `.svelte`. Cuando un componente hace `{getState().bpm}`, el compilador sabe que `bpm` es `$state` y establece una dependencia. No se necesita `subscribe()` ni `_notify()` como en old-app.

### 1.3 Reactividad: `$state` ↔ `$derived` ↔ `$effect`

Diagrama de flujo reactivo:

```
   $state ──→ Template (.svelte) ──→ Render automático
     │
     ├── $derived: valores calculados
     │     └── Ej: totalRoutineTime, visibleExercises
     │
     ├── $effect: side effects
     │     ├── saveData() en cambios de estado persistible
     │     └── Sincronización con audio/worker
     │
     └── Mutaciones (funciones exportadas)
           └── Modifican $state → Svelte reacciona
```

**Valores derivados** (útiles para componentes, se pueden definir localmente o en store):

```typescript
// Dentro de un componente Svelte:
let totalRoutineTime = $derived(
  getCurrentRoutine().exercises
    .filter(e => !e.archived)
    .reduce((sum, e) => sum + e.durationSec * e.reps, 0)
);

let visibleExercises = $derived(
  getCurrentRoutine().exercises.filter(e => !e.archived)
);
```

**Efecto de persistencia** (en `+page.svelte` via `$effect`):

```typescript
// En +page.svelte o un efecto root
$effect(() => {
  // Este efecto se re-ejecuta cuando alguna de estas dependencias cambia
  const snapshot = {
    routines: getState().routines,
    currentRoutineId: getState().currentRoutineId,
    stats: getState().stats,
    globalSeconds: getState().globalSeconds,
    sessionStartedAt: getState().sessionStartedAt,
    sessions: getState().sessions,
  };
  // NO llamar saveData aquí directamente (causa loop)
  // En su lugar, saveData se llama explícitamente desde las mutaciones
});
```

### 1.4 Funciones de mutación

Cada mutación exportada modifica variables `$state` directamente. Svelte 5 notifica automáticamente a los componentes que las referencian.

| Categoría | Función | Comportamiento |
|-----------|---------|----------------|
| **BPM** | `setBpm(val)` | Clamp [1, 300] |
| | `adjustBpm(delta)` | setBpm + sync a ejercicio activo |
| **Timer** | `recordProgressSeconds(sec)` | Acumula en `stats[todayStr()].totalSec` y `.routines[name]` |
| **Sesiones** | `addSession(data)` | Genera nanoid, pushea, asocia sessionId a statisticLogs, llama saveData() |
| | `updateSession(id, data)` | Actualiza, ajusta stats si cambia fecha |
| | `deleteSession(id)` | Elimina, resta de stats, desasocia logs |
| **Rutina** | `resetRoutine()` | Reset completo de ejercicios + timers |
| **Persistencia** | `saveData(skipCloudSync?)` | Serializa a localStorage + cloud sync opcional |
| | `loadData()` | Deserializa + migración de campos legacy |
| | `resetAllData()` | Factory reset con rutinas de muestra |

### 1.5 Flujo `saveData` / `loadData`

```
saveData():
  1. Sync exerciseRemaining → activeExercise.remainingSec
  2. JSON.stringify({ routines, currentRoutineId, stats, globalSeconds, sessionStartedAt, sessions })
  3. localStorage.setItem('musicRoutineApp_v36_stats', json)
  4. if !skipCloudSync → import('./firebase/sync.js').scheduleCloudSync()
  // NO hay _notify() — la reactividad de $state ya notificó a la UI

loadData():
  1. localStorage.getItem('musicRoutineApp_v36_stats')
  2. JSON.parse(data)
  3. Asignar cada campo a su variable $state
  4. Migrar/normalizar ejercicios (duration→durationSec, defaults)
  // UI reacciona automáticamente porque $state cambió
```

### 1.6 Reset de estado entre tests

Para los tests, se necesita una función que reinicie todas las variables `$state` a sus valores por defecto. Se exporta una función `__resetTestState()` para uso exclusivo en tests:

```typescript
// Solo para tests
export function __resetTestState() {
  // No se puede re-asignar $state directamente fuera del módulo,
  // así que esta función debe estar dentro de store.svelte.ts
}
```

---

## 2. Component Tree — Relaciones Completas

### 2.1 Árbol de Componentes

```
+page.svelte (raíz — SPA, sin routing SvelteKit entre tabs)
├── [Modal] ImageLightbox { show, imageUrl }
├── [Modal] StatInputModal { show, statName, onSave, onSkip }
├── [Modal] EditStatsModal { show }
├── [Modal] EditSessionModal { show, sessionId }
├── [Modal] FinishModal { show, summary, onAccept }
├── [Modal] ResetModal { show, onConfirm }
├── [Modal] CreateExerciseModal { show }
│
├── {#if activeTab === 'practice'}
│   ├── Dashboard
│   │   ├── TimerBar { globalSeconds, totalRoutineTime }
│   │   └── ExerciseCard[] { exercise, isActive, isTimerRunning, remaining }
│   │
│   └── {#if viewingExerciseId}
│       └── DetailsView
│           └── AttachmentList { comment }
│
├── {#if activeTab === 'routines'}
│   └── RoutinesView
│       └── RoutineCard[] { routine, isCurrent, activeCount, archivedCount }
│
├── {#if activeTab === 'history'}
│   └── HistoryView
│
├── {#if activeTab === 'stats'}
│   └── StatsView
│       └── StatCard[] { title, value, subtitle, icon }
│
├── {#if activeTab === 'settings'}
│   └── SettingsView
│       ├── SyncSection
│       └── BackupManager { show }
│
└── BottomNav
```

### 2.2 Props y Eventos por Componente

#### `+page.svelte` — Raíz

| Aspecto | Detalle |
|---------|---------|
| **Props** | Ninguna |
| **Estado** | `activeTab` (local `$state('practice')`) |
| **Efectos** | `onMount`: Worker, Sortable, loadData, Firebase auth, SW |
| **Children** | Todos los modales + vistas condicionales + BottomNav |
| **Comunicación** | No emite eventos — usa store global |

#### `BottomNav.svelte`

| Aspecto | Detalle |
|---------|---------|
| **Props** | Ninguna |
| **Acceso store** | Lee `activeTab` vía `getState()` (aunque es local en +page, se pasa como prop) |
| **Props recibidas** | `activeTab: string`, `onTabChange: (tab: string) => void` |
| **Eventos emitidos** | Ninguno directo — llama `onTabChange` callback |
| **Estilo** | 5 íconos: fa-music, fa-list, fa-history, fa-chart-line, fa-cog |

#### `Dashboard.svelte`

| Aspecto | Detalle |
|---------|---------|
| **Props** | Ninguna (lee store directamente) |
| **Acceso store** | `getState()` completo |
| **Event handlers internos** | `adjustBpm`, `toggleGlobalAudioOnly`, `finishRoutine`, `resetRoutine` |
| **Children** | TimerBar, ExerciseCard[], DetailsView condicional |
| **Comunicación** | No emite eventos al padre |

#### `TimerBar.svelte`

| Prop | Tipo | Descripción |
|------|------|-------------|
| `globalSeconds` | `number` | Segundos acumulados de la sesión |
| `totalRoutineTime` | `number` | Duración programada total |
| **Eventos** | Ninguno | Puramente presentacional |

#### `ExerciseCard.svelte`

| Prop | Tipo | Descripción |
|------|------|-------------|
| `exercise` | `Exercise` | Datos completos del ejercicio |
| `isActive` | `boolean` | Si es el que se está reproduciendo |
| `isTimerRunning` | `boolean` | Si el timer está corriendo |
| `remaining` | `number` | Segundos restantes |

**Eventos emitidos al Dashboard (callback props):**

| Nombre | Firma | Cuándo |
|--------|-------|--------|
| `onStartStop` | `(exerciseId: string) => void` | Click Start/Stop |
| `onDetail` | `(exerciseId: string) => void` | Click chevron `>` |
| `onLightbox` | `(imageUrl: string) => void` | Click en thumbnail |
| `onOpenUrl` | `(url: string) => void` | Click en link externo |

**Renderizado condicional interno:**

- Badge de reps solo si `exercise.reps > 1`
- Badge de estadística solo si `exercise.statisticName`
- Barra de progreso verde con ancho `progressPercent%`
- Color de fondo: verde si completed, verde claro si active, blanco default
- Thumbnail de imagen si existe URL de imagen en comment
- Botón de link si existe URL en comment
- Drag handle `fa-grip-vertical` (manejado por Sortable.js desde el padre)

#### `DetailsView.svelte`

| Aspecto | Detalle |
|---------|---------|
| **Props** | Ninguna (lee `viewingExerciseId` del store) |
| **Acceso store** | `getState().viewingExerciseId` → `getExerciseById()` |
| **Children** | AttachmentList `{ comment }` |
| **Eventos** | No emite — muta store directamente |

**Internamente maneja:**

| Acción | Función store |
|--------|--------------|
| Back | `closeDetailsView()` — limpia `viewingExerciseId` |
| Input título | `updateExerciseTitle(val)` |
| Start/Pause | `toggleDetailPlay()` |
| Reset | `resetCurrentDetailExercise()` |
| Complete | `completeDetailExercise()` → abre StatInputModal si tiene statisticName |
| Reps +/- | `adjustDetailReps(delta)` |
| Min/Sec +/- | `adjustDetailTime(type, val)` |
| BPM +/- | `adjustDetailBPM(delta)` |
| Autostart | `updateDetailAutoStart(checked)` |
| Comment | `updateComment(text)` |
| Duplicate | `duplicateExercise()` |
| Archive | `archiveExercise()` |
| Delete | `deleteDetailExercise()` |

#### `AttachmentList.svelte`

| Prop | Tipo | Descripción |
|------|------|-------------|
| `comment` | `string` | Texto del que extraer URLs |

No emite eventos — renderiza imágenes y links. Las imágenes abren ImageLightbox global.

#### `RoutinesView.svelte`

| Aspecto | Detalle |
|---------|---------|
| **Props** | Ninguna |
| **Estado local** | `sortMode: 'created'|'alpha'|'usage'`, `sortAsc: boolean` |
| **Children** | RoutineCard[] |
| **Eventos** | No emite — muta store directamente |

**Acciones:**
- Nueva rutina → `showNewRoutineInput()` (prompt)
- Importar → `triggerImport()` → `importRoutines(input)`
- Sort tags toggle → `handleSortClick(key)`

#### `RoutineCard.svelte`

| Prop | Tipo | Descripción |
|------|------|-------------|
| `routine` | `Routine` | Datos de la rutina |
| `isCurrent` | `boolean` | Si es la rutina activa |
| `activeCount` | `number` | Ejercicios no archivados |
| `archivedCount` | `number` | Ejercicios archivados |

**Eventos emitidos (callback props):**

| Nombre | Cuándo |
|--------|--------|
| `onSelect` | Click play |
| `onRename` | Menú → Renombrar |
| `onExport` | Menú → Exportar |
| `onDuplicate` | Menú → Duplicar |
| `onDelete` | Menú → Eliminar |

#### `HistoryView.svelte`

| Aspecto | Detalle |
|---------|---------|
| **Props** | Ninguna |
| **Estado local** | `currentYear: number`, `currentMonth: number` |
| **Children** | Ninguno — renderiza HTML directamente (o subcomponentes) |

**Acciones:**
- Mes anterior/siguiente → cambia `currentMonth`, re-renderiza
- Exportar mes → `downloadMonthXLSX()`
- Exportar día → `downloadDayXLSX()`
- Editar sesión → abre EditSessionModal

#### `StatsView.svelte`

| Aspecto | Detalle |
|---------|---------|
| **Props** | Ninguna |
| **Estado interno** | Referencias a instancias Chart.js (4 gráficos) |
| **Children** | StatCard[] (4 summary cards), 4 canvas para Chart.js |

**Acciones:**
- Filtrar progreso → re-renderiza ProgressChart
- Gestionar Datos → abre EditStatsModal

#### `StatCard.svelte`

| Prop | Tipo | Descripción |
|------|------|-------------|
| `title` | `string` | Título (ej. "Total Practicado") |
| `value` | `string` | Valor (ej. "2h 30m") |
| `subtitle` | `string` | Texto secundario |
| `icon` | `string` | Clase FontAwesome (ej. "fa-clock") |

#### `SettingsView.svelte`

| Aspecto | Detalle |
|---------|---------|
| **Props** | Ninguna |
| **Children** | SyncSection, BackupManager (condicional) |

**Acciones:**
- Archivados → `showArchivedExercises()`
- Backup → `exportAllData()`
- Restaurar → `triggerRestore()` → `restoreAllData(input)`
- Copias nube → `openBackupManager()`
- Stats → `openStatsView()`
- Borrar datos → `deleteAllData()` (doble confirmación)

#### `SyncSection.svelte`

| Aspecto | Detalle |
|---------|---------|
| **Props** | Ninguna |
| **Acceso** | Firebase Auth + store |

**Renderizado condicional:**
- `!user`: Botón "Iniciar sesión con Google"
- `user`: Email, estado (punto verde/amarillo/rojo), última sincronización, botones sync/auto-sync/logout

#### `BackupManager.svelte`

| Prop | Tipo | Descripción |
|------|------|-------------|
| `show` | `boolean` | Control de visibilidad (overlay) |

### 2.3 Flujo de datos General

```
User Action (click, input, etc.)
  → Event handler en componente Svelte
    → Función de mutación en store.svelte.ts
      → Variable $state modificada
        → Svelte 5 re-renderiza solo los templates afectados
          → saveData() se llama desde la mutación
            → localStorage + cloud sync (debounced)
```

### 2.4 Comunicación child → parent

Usamos **callback props** en lugar de eventos de Svelte (aunque Svelte 5 tiene `onclick` manejado automáticamente con `$props()`).

```svelte
<script lang="ts">
let { exercise, onStartStop = (id: string) => {} } = $props();
</script>

<button onclick={() => onStartStop(exercise.id)}>
  {isTimerRunning ? 'Stop' : 'Start'}
</button>
```

El Dashboard pasa los callbacks:

```svelte
<ExerciseCard
  {exercise}
  {isActive}
  {isTimerRunning}
  {remaining}
  onStartStop={(id) => toggleListExercise(id)}
  onDetail={(id) => openDetailsView(id)}
/>
```

---

## 3. Web Worker Integration

### 3.1 Creación del Worker

En `+page.svelte`, dentro de `onMount`:

```typescript
onMount(() => {
  const worker = new Worker(
    new URL('$lib/worker.ts', import.meta.url),
    { type: 'module' }
  );

  worker.onmessage = (e: MessageEvent) => {
    if (e.data === 'tick') {
      onWorkerTick();
    }
  };

  // Cleanup: terminar worker al desmontar
  return () => {
    worker.terminate();
  };
});
```

### 3.2 Código del Worker (`src/lib/worker.ts`)

Es **idéntico** al de old-app. Código JS plano compatible con Vite:

```typescript
let intervalId: ReturnType<typeof setInterval> | null = null;

self.onmessage = function (e: MessageEvent) {
  if (e.data === 'start') {
    if (intervalId === null) {
      intervalId = setInterval(() => {
        self.postMessage('tick');
      }, 1000);
    }
  } else if (e.data === 'stop') {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }
};
```

### 3.3 Protocolo de Mensajes

| Dirección | Mensaje | Descripción |
|-----------|---------|-------------|
| Main → Worker | `'start'` | Inicia intervalo de 1s |
| Main → Worker | `'stop'` | Detiene intervalo |
| Worker → Main | `'tick'` | Cada 1s mientras corre |

### 3.4 Integración con $state: `onWorkerTick()`

```typescript
// En store.svelte.ts
export function onWorkerTick() {
  if (!isExercisePlaying) return;

  globalSeconds++;

  if (activeExerciseId && exerciseRemaining > 0) {
    exerciseRemaining--;
    const ex = getExerciseById(activeExerciseId);
    if (ex) ex.remainingSec = exerciseRemaining;

    if (exerciseRemaining <= 0) {
      // handleExerciseCompletion se define en +page.svelte o se importa
      // Porque necesita acceso a modales (StatInputModal)
      handleExerciseCompletion();
    }
  }
}
```

**Nota**: `handleExerciseCompletion` necesita mostrar modales, así que no puede estar en el store puro. Se define en `+page.svelte` como función que importa store + modales.

### 3.5 Ciclo de Vida del Worker

```
startExercise(id):
  1. Asigna activeExerciseId, exerciseRemaining
  2. isExercisePlaying = true
  3. worker.postMessage('start')
  4. initAudio() → si autoStart, startMetronome(bpm)

pauseSequence():
  1. isExercisePlaying = false
  2. worker.postMessage('stop')
  3. stopMetronome()
  4. saveData()

onWorkerTick():
  1. if !isExercisePlaying → return
  2. globalSeconds++
  3. if activeExerciseId && exerciseRemaining > 0:
     exerciseRemaining--, sync a exercise.remainingSec
     if remaining <= 0 → handleExerciseCompletion()
```

---

## 4. Audio Service

### 4.1 Archivo: `src/lib/audio.ts`

Módulo TypeScript puro (NO `.svelte.ts` — no necesita $state). Misma lógica que old-app.

```typescript
let metroSynth: any = null;  // Tone.Synth
let bellSynth: any = null;   // Tone.PolySynth
let beat = 0;
let _initialized = false;
let _isAudioOn = false;
```

### 4.2 Inicialización Perezosa (Lazy, First-Click)

```typescript
export async function initAudio(): Promise<void> {
  if (_initialized) return;
  await Tone.start();  // ← Requiere gesto del usuario

  metroSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 }
  }).toDestination();

  bellSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 1, sustain: 0, release: 1 }
  }).toDestination();

  Tone.Transport.scheduleRepeat((time: any) => {
    if (_isAudioOn && metroSynth) {
      const freq = beat === 0 ? 'C6' : 'G5';
      metroSynth.triggerAttackRelease(freq, '32n', time);
    }
    beat = (beat + 1) % 4;
  }, '4n');

  _initialized = true;
}
```

### 4.3 Patrón del Metrónomo

```
beat 0 → nota C6 (acento fuerte — downbeat)
beat 1 → nota G5
beat 2 → nota G5
beat 3 → nota G5
Cada beat = 4n (negra)
```

### 4.4 Integración con el Store

El audio NO usa $state. Usa una variable interna `_isAudioOn` que se setea desde el store:

```typescript
export function setAudioOn(val: boolean) {
  _isAudioOn = val;
}
```

Cuando el Dashboard hace `toggleGlobalAudioOnly()`:

```typescript
// En Dashboard (o store)
export function toggleGlobalAudioOnly() {
  isAudioOn = !isAudioOn;  // $state — reactivo para UI
  setAudioOn(isAudioOn);   // audio.ts — variable interna

  if (isAudioOn) {
    initAudio().then(() => startMetronome(bpm));
  } else {
    stopMetronome();
  }
}
```

### 4.5 API Exportada

| Función | Descripción |
|---------|-------------|
| `initAudio()` | Inicializa Tone.js (lazy, safe to call multiple times) |
| `setAudioOn(val)` | Setea flag interno *isAudioOn |
| `playBellSound()` | Toca acorde C5-E5-G5 (completado de ejercicio) |
| `startMetronome(bpm)` | Resetea beat, setea BPM, inicia Transport |
| `stopMetronome()` | Detiene Transport, resetea beat |
| `setMetronomeBpm(bpm)` | Actualiza BPM sin reiniciar |

---

## 5. Modal System

### 5.1 Gestión de Modales

Los modales se manejan con **flags de estado `$state`** en `+page.svelte`, no con routing. Cada modal tiene su propio flag booleano:

```svelte
<script lang="ts">
let showCreateModal = $state(false);
let showStatModal = $state(false);
let statModalConfig = $state<{ statName: string; onSave: (v: number) => void; onSkip: () => void } | null>(null);
let showFinishModal = $state(false);
let finishModalConfig = $state<{ summary: FinishSummary; onAccept: () => void } | null>(null);
let showResetModal = $state(false);
let resetOnConfirm = $state<(() => void) | null>(null);
let showEditStatsModal = $state(false);
let showEditSessionModal = $state(false);
let editSessionId = $state<string | null>(null);
let showLightbox = $state(false);
let lightboxUrl = $state('');
</script>
```

### 5.2 Renderizado Condicional

```svelte
{#if showCreateModal}
  <CreateExerciseModal bind:show={showCreateModal} />
{/if}

{#if showStatModal && statModalConfig}
  <StatInputModal
    show={showStatModal}
    statName={statModalConfig.statName}
    onSave={statModalConfig.onSave}
    onSkip={statModalConfig.onSkip}
  />
{/if}

{#if showFinishModal && finishModalConfig}
  <FinishModal
    show={showFinishModal}
    summary={finishModalConfig.summary}
    onAccept={finishModalConfig.onAccept}
  />
{/if}
```

### 5.3 Cada Modal

#### `CreateExerciseModal.svelte`

| Prop | Tipo | Descripción |
|------|------|-------------|
| `show` | `boolean` | Visibilidad |

Lee `newExerciseForm` del store. Botón Create llama `addNewExercise()` que:
1. Valida título
2. Construye Exercise con nanoid
3. Pushea al array de ejercicios
4. saveData()
5. Cierra modal

#### `StatInputModal.svelte`

| Prop | Tipo | Descripción |
|------|------|-------------|
| `show` | `boolean` | Visibilidad |
| `statName` | `string` | Nombre de la estadística |
| `onSave` | `(value: number) => void` | Callback al guardar |
| `onSkip` | `() => void` | Callback al saltar |

Estado interno: `inputValue: string` (bind al input number).

#### `FinishModal.svelte`

| Prop | Tipo | Descripción |
|------|------|-------------|
| `show` | `boolean` | Visibilidad |
| `summary` | `FinishSummary` | `{ exercises, scheduledSec, elapsedSec, startedAt, completedAt }` |
| `onAccept` | `() => void` | Callback al aceptar |

#### `ResetModal.svelte`

| Prop | Tipo | Descripción |
|------|------|-------------|
| `show` | `boolean` | Visibilidad |
| `onConfirm` | `() => void` | Callback al confirmar |

#### `EditStatsModal.svelte`

| Prop | Tipo | Descripción |
|------|------|-------------|
| `show` | `boolean` | Visibilidad |

Carga todos los `statisticLogs` de todos los ejercicios. Renderiza lista con botones editar/eliminar.

#### `EditSessionModal.svelte`

| Prop | Tipo | Descripción |
|------|------|-------------|
| `show` | `boolean` | Visibilidad |
| `sessionId` | `string \| null` | ID de la sesión |

#### `ImageLightbox.svelte`

| Prop | Tipo | Descripción |
|------|------|-------------|
| `show` | `boolean` | Visibilidad |
| `imageUrl` | `string` | URL de la imagen |

### 5.4 Patrón de Callbacks

El `StatInputModal` usa el patrón de callbacks para comunicar el resultado al caller:

```
Dashboard.handleExerciseCompletion()
  → if ex.statisticName && !ex.completed:
    → showStatModal = true
    → statModalConfig = { statName, onSave, onSkip }
      → StatInputModal renderizado
        → Usuario escribe valor y hace click Save
          → OnSave(val) ejecuta:
            1. ex.statisticLogs.push({ date: today, value: val })
            2. saveData()
            3. finalizeCompletion(false)
          → showStatModal = false
```

---

## 6. Firebase Integration

### 6.1 Arquitectura Offline-First

Firebase es una capa **opcional** — nunca rompe el funcionamiento offline. Todos los imports de Firebase están envueltos en try/catch.

```
App Offline ───→ localStorage (siempre funcional)
                    │
                    └── Cloud Sync (cuando hay conexión + sesión)
                         ├── Firebase Auth (Google)
                         └── Firestore (Sync + Backups)
```

### 6.2 Auth State → $state Bridge

```typescript
// En +page.svelte (onMount)
import { observeAuth } from '$lib/firebase/auth';
import { downloadAndMergeState, startSyncListener } from '$lib/firebase/sync';

let currentUser = $state<User | null>(null);

onMount(() => {
  const unsub = observeAuth((user) => {
    currentUser = user;

    if (user) {
      downloadAndMergeState(user.uid).then(() => {
        startSyncListener(user.uid, (merged) => {
          // onRemoteChange callback
          if (merged.routines) routines = merged.routines;
          if (merged.stats) stats = merged.stats;
          if (merged.sessions) sessions = merged.sessions;
          if (merged.currentRoutineId) currentRoutineId = merged.currentRoutineId;
          saveData(true);
        });
      });
    } else {
      stopSyncListener();
    }
  });

  return () => unsub();
});
```

### 6.3 Sync Lifecycle

```
Login (Google)
  → handleRedirectResult()
  → observeAuth() → user detected
    → downloadAndMergeState(uid):
        1. downloadState(uid) — leer Firestore
        2. If cloud vacío → upload local (primera vez)
        3. If neverSynced → cloud wins (evita sobreescribir cloud con datos de muestra)
        4. If ya sincronizado → mergeState(local, cloud) → last-write-wins por timestamp
        5. setLastSyncTime()
    → startSyncListener(uid):
        1. onSnapshot del doc
        2. Skip si deviceId === propio (evita loop)
        3. Skip si !initialSyncDone
        4. Si cloudTime > localTime → merge y actualizar estado local

saveData()
  → if auto-sync toggle ON:
    → scheduleCloudSync()
      → debounce 2000ms
        → uploadState(uid)
```

### 6.4 Firebase Modules

| Archivo | Descripción |
|---------|-------------|
| `src/lib/firebase/config.ts` | `initializeApp`, `initializeFirestore` con `persistentLocalCache()`, `getAuth` |
| `src/lib/firebase/auth.ts` | `loginGoogle` (popup con fallback redirect), `handleRedirectResult`, `logoutGoogle`, `observeAuth` |
| `src/lib/firebase/sync.ts` | `uploadState`, `downloadState`, `downloadAndMergeState`, `syncNow`, `scheduleCloudSync`, `startSyncListener`, `stopSyncListener`, `saveBackup`, `listBackups`, `loadBackup`, `deleteBackup` |
| `src/lib/firebase/serializer.ts` | `exportSyncState` (extrae routines, stats, sessions), `importSyncState` (defaults seguros) |
| `src/lib/firebase/merge.ts` | `mergeState` (last-write-wins con timestamp) |
| `src/lib/firebase/device.ts` | `getDeviceId` (UUID persistente en localStorage) |

### 6.5 Mapa de Sincronización

```
Firestore:
  users/{uid}/app/state
    ├── schemaVersion: 1
    ├── updatedAt: serverTimestamp()
    ├── _localUpdatedAt: number (Date.now())
    ├── deviceId: string
    └── data:
        ├── routines: Routine[]
        ├── stats: Record<string, StatsEntry>
        ├── sessions: Session[]
        └── currentRoutineId: string

  users/{uid}/backups/{backupId}
    ├── createdAt: serverTimestamp()
    ├── label: string
    └── data: SyncPayload
```

---

## 7. CDN Global Dependencies

### 7.1 Declaración en `app.html`

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <title>Practice Timer</title>
  <meta name="theme-color" content="#E53935" />
  <link rel="manifest" href="manifest.json" />
  <link rel="icon" type="image/x-icon" href="icon-192.png" />
  <link rel="apple-touch-icon" href="icon-192.png" />

  <!-- Font Awesome -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />

  <!-- SvelteKit head placeholder -->
  %sveltekit.head%
</head>
<body data-sveltekit-preload-data="hover">
  <!-- CDN Scripts (cargados globalmente) -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js"></script>

  <div style="display: contents">%sveltekit.body%</div>
</body>
</html>
```

### 7.2 TypeScript Declarations (`src/app.d.ts`)

```typescript
declare global {
  // Sortable.js
  const Sortable: {
    new(element: HTMLElement, options: SortableOptions): SortableInstance;
  };
  interface SortableOptions {
    animation?: number;
    delay?: number;
    delayOnTouchOnly?: boolean;
    handle?: string;
    ghostClass?: string;
    chosenClass?: string;
    dragClass?: string;
    scroll?: boolean;
    scrollSensitivity?: number;
    scrollSpeed?: number;
    forceFallback?: boolean;
    fallbackClass?: string;
    onEnd?: (evt: { oldIndex: number; newIndex: number }) => void;
  }
  interface SortableInstance {
    destroy(): void;
  }

  // Tone.js
  const Tone: {
    start(): Promise<void>;
    Synth: any;
    PolySynth: any;
    Transport: {
      bpm: { value: number };
      start(): void;
      stop(): void;
      scheduleRepeat(callback: (time: any) => void, interval: string): void;
      state: 'started' | 'stopped';
    };
    Destination: any;
  };

  // ExcelJS
  const ExcelJS: {
    Workbook: new () => any;
  };

  // Chart.js
  const Chart: new(ctx: CanvasRenderingContext2D, config: any) => any;
}

export {};
```

### 7.3 Lifecycle Hooks para cada CDN

#### Sortable.js — Se attacha en `onMount` + `afterUpdate`

```typescript
// En Dashboard.svelte
let exerciseListEl: HTMLDivElement;
let sortableInstance: SortableInstance | null = null;

onMount(() => {
  if (typeof Sortable === 'undefined') return;

  sortableInstance = new Sortable(exerciseListEl, {
    animation: 200,
    delay: 200,
    delayOnTouchOnly: true,
    handle: '.drag-handle',
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    dragClass: 'sortable-drag',
    scroll: true,
    scrollSensitivity: 40,
    scrollSpeed: 10,
    forceFallback: true,
    fallbackClass: 'sortable-fallback',
    onEnd: (evt) => {
      const routine = getCurrentRoutine();
      const exercises = routine.exercises;
      if (evt.oldIndex !== evt.newIndex && !exercises[evt.oldIndex].archived) {
        const visible = exercises.filter(e => !e.archived);
        const [moved] = visible.splice(evt.oldIndex, 1);
        visible.splice(evt.newIndex, 0, moved);
        // Reconstruir el array completo
        const archived = exercises.filter(e => e.archived);
        routine.exercises = [...visible, ...archived];
        saveData();
      }
    }
  });
});

onDestroy(() => {
  sortableInstance?.destroy();
});
```

#### Chart.js — Se crea en `onMount` con refs a canvas

```typescript
// En StatsView.svelte
let weeklyCanvas: HTMLCanvasElement;
let weeklyChartInstance: any = null;

onMount(() => {
  renderWeeklyChart();
});

onDestroy(() => {
  weeklyChartInstance?.destroy();
  routineChartInstance?.destroy();
  progressChartInstance?.destroy();
  scheduleChartInstance?.destroy();
});

function renderWeeklyChart() {
  // ... preparar datos ...
  if (weeklyChartInstance) weeklyChartInstance.destroy();
  weeklyChartInstance = new Chart(weeklyCanvas.getContext('2d')!, {
    type: 'bar',
    data: { labels, datasets },
    options: { responsive: true, maintainAspectRatio: false, ... }
  });
}
```

#### ExcelJS — Se usa bajo demanda

```typescript
// En export.ts
export async function downloadDayXLSX(...) {
  const ExcelJS = (window as any).ExcelJS;
  if (!ExcelJS) {
    alert('ExcelJS library not loaded. Please check your internet connection.');
    return;
  }
  // ... usar ExcelJS ...
}
```

#### Tone.js — Se inicializa en el primer gesto del usuario

```typescript
// En audio.ts
export async function initAudio() {
  if (_initialized) return;
  await Tone.start(); // ← Requiere interacción del usuario
  // ... crear synths ...
}
```

---

## 8. CSS Migration Strategy

### 8.1 Archivo: `src/app.css`

Se copia **exactamente** `old-app/css/styles.css` a `src/app.css`. No se migra a Tailwind CSS — se mantiene el CSS personalizado exacto.

```css
/* src/app.css — Copia directa de old-app/css/styles.css */

@import "tailwindcss";

@layer components {
  .btn-primary { /* ... */ }
  .btn-secondary { /* ... */ }
  .btn-icon { /* ... */ }
  .card { /* ... */ }
  .view-section { /* ... */ }
  .view-section.active { /* ... */ }
  .bottom-nav-tab { /* ... */ }
  .bottom-nav-tab.active { /* ... */ }
}

:root {
  --primary-red: #E53935;
  --bg-light: #F5F5F5;
}

/* ... resto de estilos ... */
```

### 8.2 Carga en `+layout.svelte`

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import '../app.css';
</script>

{@render children()}
```

### 8.3 Clases de Utilidad a Preservar

| Clase | Propósito |
|-------|-----------|
| `.btn-primary` | Botón rojo principal |
| `.btn-secondary` | Botón outline rojo |
| `.btn-icon` | Botón circular 32x32 |
| `.card` | Tarjeta blanca con sombra y borde |
| `.view-section` | Contenedor de vista (hidden por defecto, flex cuando active) |
| `.view-section.active` | Visibilidad de la vista activa |
| `.bottom-nav-tab` | Tab de navegación inferior |
| `.bottom-nav-tab.active` | Tab activo (texto rojo) |
| `.drag-handle` | Área táctil para Sortable |
| `.sortable-ghost` | Fantasma durante drag |
| `.sortable-chosen` | Elemento seleccionado |
| `.sortable-drag` | Elemento siendo arrastrado |
| `.progress-bar-fill` | Barra de progreso animada |

### 8.4 Notas de Migración CSS

1. **View visibility**: En old-app, las vistas se muestran/ocultan con la clase `.active` (que pone `display: flex`). En SvelteKit, se usa `{#if activeTab === '...'}` que monta/desmonta el componente. Las clases `.view-section` se mantienen para scroll y padding, pero el `display` lo maneja Svelte.
2. **Bottom nav safe area**: `padding-bottom: env(safe-area-inset-bottom)` se mantiene.
3. **Scrollbar styling**: Se aplica globalmente en app.css.
4. **Font**: Se mantiene `font-family: 'Segoe UI', system-ui, sans-serif`.
5. **Drag & drop classes**: Sortable.js usa `ghostClass`, `chosenClass`, `dragClass`, `fallbackClass` — deben coincidir con las clases CSS definidas.

---

## 9. Key Implementation Sequences

### 9.1 Timer Sequence (Start → tick → UI Update)

```
Usuario click en Start en ExerciseCard #42
  → Dashboard.onStartStop('exercise-42')
    → toggleListExercise('exercise-42')
      → playExercise('exercise-42')
        1. activeExerciseId = 'exercise-42'
        2. exerciseRemaining = ex.remainingSec || ex.durationSec
        3. setBpm(ex.bpm)
        4. isExercisePlaying = true
        5. if sessionStartedAt === null → sessionStartedAt = Date.now()
        6. worker.postMessage('start')
        7. initAudio().then(() => {
             setMetronomeBpm(bpm)
             if ex.autoStart → isAudioOn=true, startMetronome(bpm)
           })
        8. saveData()
        → Svelte re-renderiza:
            - TimerBar muestra globalSeconds actualizado
            - ExerciseCard #42 se muestra "active" (verde claro, progress bar)
            - Botón cambia a "Stop"

Cada 1 segundo (Worker → onmessage → onWorkerTick):
  1. isExercisePlaying check → OK
  2. globalSeconds++
  3. exerciseRemaining--
  4. ex.remainingSec = exerciseRemaining
  5. if exerciseRemaining <= 0 → handleExerciseCompletion()
  → Svelte re-renderiza automáticamente:
      - TimerBar: nuevo tiempo
      - ExerciseCard #42: nueva barra de progreso
```

### 9.2 Exercise Completion Sequence

```
handleExerciseCompletion():
  1. playBellSound()
  2. if ex.statisticName && !ex.completed:
      a. pauseSequence()
      b. showStatModal = true
      c. statModalConfig = { statName: ex.statisticName }
      d. Usuario escribe valor y click Save:
          - ex.statisticLogs.push({ date: today, value })
          - saveData()
          - finalizeCompletion(false)
      e. Usuario click Skip:
          - finalizeCompletion(false)
  3. else:
      finalizeCompletion(false)

finalizeCompletion():
  1. if ex.currentRep < ex.reps:
      → Siguiente repetición:
        ex.currentRep++
        exerciseRemaining = ex.durationSec
        ex.remainingSec = ex.durationSec
        isExercisePlaying = true
        worker.postMessage('stop') → worker.postMessage('start')
        if ex.autoStart → startMetronome()
        saveData()
  2. else:
      → Ejercicio completado:
        pauseSequence()
        ex.completed = true
        ex.remainingSec = 0
        saveData()
        if autoplayRoutine:
          buscar siguiente ejercicio → setTimeout(playExercise(next), 1500)
          if no hay más ejercicios → finishRoutine()
```

### 9.3 Finish Routine Sequence

```
Usuario click "FINISH"
  → finishRoutine()
    1. pauseSequence()
    2. Calcular summary:
       completedCount, scheduledSec, elapsedSec
    3. showFinishModal = true
    4. finishModalConfig = { summary, onAccept }

Usuario click "Aceptar"
  → onAccept():
    1. addSession({ date, routineId, routineName, startedAt, completedAt,
                    scheduledSec, totalSec, elapsedSec, exercises })
    2. recordProgressSeconds(globalSeconds)
    3. sessionStartedAt = null
    4. activeExerciseId = null
    5. exerciseRemaining = 0
    6. globalSeconds = 0
    7. Resetear todos los ejercicios: completed=false, remainingSec=durationSec, currentRep=1
    8. saveData()
    9. syncNow() (cloud sync inmediato)
    → Svelte re-renderiza Dashboard con estado reseteado
```

### 9.4 Reset Routine Sequence

```
Usuario click "RESET"
  → resetRoutine()
    1. pauseSequence()
    2. showResetModal = true
    3. resetOnConfirm = () => { ... }

Usuario click "OK"
  → onConfirm():
    1. pauseSequence()
    2. sessionStartedAt = null
    3. activeExerciseId = null
    4. exerciseRemaining = 0
    5. globalSeconds = 0
    6. Resetear todos los ejercicios
    7. saveData()
    → Svelte re-renderiza
```

### 9.5 Detail Exercise Completion Sequence

```
Usuario en DetailsView click "Complete"
  → completeDetailExercise():
    1. if ex.statisticName && !ex.completed:
        a. pendingDetailCompletion = true
        b. activeExerciseId = ex.id
        c. if isExercisePlaying → pauseSequence()
        d. showStatModal = true
        e. OnSave → push log, saveData, forceFinishDetail()
        f. OnSkip → forceFinishDetail()
    2. else:
        forceFinishDetail()

forceFinishDetail():
  1. Calcular timeToAdd (remaining si activo, sino ex.remainingSec)
  2. globalSeconds += timeToAdd
  3. ex.completed = true
  4. ex.remainingSec = 0
  5. saveData()
  6. closeDetailsView()
```

### 9.6 Navigation Sequence

```
Usuario click en tab "Routines" en BottomNav
  → onTabChange('routines')
    1. activeTab = 'routines'  ($state)
    2. Svelte desmonta Dashboard/Details y monta RoutinesView
    3. RoutinesView.onMount() → renderiza lista de rutinas

Usuario click "Practice" en BottomNav
  → onTabChange('practice')
    1. activeTab = 'practice'
    2. Svelte desmonta RoutinesView y monta Dashboard
    3. Dashboard.onMount() → updateUI()
```

### 9.7 Cloud Sync Sequence

```
saveData() (no skipCloudSync)
  → scheduleCloudSync()
    → debounce 2000ms:
      if autoSyncToggle.checked && user autenticado:
        dispatchSyncEvent('syncing')
        uploadState(uid):
          - getState() → exportSyncState → setDoc
          - setLastSyncTime
          - dispatchSyncEvent('synced')

Listener remoto (startSyncListener):
  onSnapshot del doc:
    Skip if deviceId === propio
    Skip if !initialSyncDone
    If cloudTime > localTime:
      merge data → actualizar $state → saveData(true)
```

---

## 10. Implementation Order (Batches)

### Batch 1: Fundación (Types + Store + Persistencia + Tests)

**Archivos a crear:**
- `src/lib/state/types.ts` — Tipos TypeScript (Exercise, Routine, Session, etc.)
- `src/lib/state/store.svelte.ts` — Store con $state, getters, mutaciones
- `src/lib/state/utils.ts` — formatTime, getFirstUrl, stringToColor, sanitizeImportedRoutine, deepClone, etc.
- `src/lib/state/routines-sample.ts` — 12 módulos de rutinas (copia TS de old-app)

**Tests:**
- `src/lib/state/store.test.ts` — State tests migrados + nuevos
- `src/lib/state/utils.test.ts` — Utility tests migrados

**Criterio de éxito:** `pnpm test:unit` pasa sin errores. Store funcional con $state y persistencia localStorage.

---

### Batch 2: Layout + Page Raíz + App Shell

**Archivos a crear:**
- `src/app.html` — HTML con CDN scripts, meta tags, manifest
- `src/app.css` — CSS migrado de old-app/css/styles.css
- `src/app.d.ts` — Declaraciones globales (Sortable, Tone, Chart, ExcelJS)
- `src/routes/+layout.svelte` — Layout que carga app.css
- `src/routes/+page.svelte` — Shell SPA: BottomNav + modales + vistas condicionales
- `src/lib/components/BottomNav.svelte` — Bottom navigation con 5 tabs

**Criterio de éxito:** La app carga en el navegador, muestra la bottom nav, se puede cambiar entre pestañas (contenido placeholder).

---

### Batch 3: Dashboard + Timer + Worker

**Archivos a crear:**
- `src/lib/worker.ts` — Web Worker (copia exacta de old-app)
- `src/lib/components/Dashboard/Dashboard.svelte` — Vista principal
- `src/lib/components/Dashboard/TimerBar.svelte` — Barra de progreso
- `src/lib/components/Dashboard/ExerciseCard.svelte` — Card de ejercicio

**Integraciones:**
- Web Worker (creación en onMount + cleanup)
- Sortable.js (drag & drop en lista de ejercicios)
- Ciclo play/pause/stop del timer

**Criterio de éxito:** Se puede iniciar/detener un ejercicio, el timer cuenta, la UI se actualiza, el progreso se muestra.

---

### Batch 4: Details View + AttachmentList

**Archivos a crear:**
- `src/lib/components/Details/DetailsView.svelte` — Editor de ejercicio
- `src/lib/components/Details/AttachmentList.svelte` — Imágenes y links del comment

**Criterio de éxito:** Se puede abrir un ejercicio en detalle, editar título/BPM/reps/tiempo/comment, hacer start/reset/complete desde details.

---

### Batch 5: Modales

**Archivos a crear:**
- `src/lib/components/Modals/CreateExerciseModal.svelte` — Crear ejercicio
- `src/lib/components/Modals/StatInputModal.svelte` — Ingresar estadística
- `src/lib/components/Modals/FinishModal.svelte` — Finalizar rutina
- `src/lib/components/Modals/ResetModal.svelte` — Resetear rutina
- `src/lib/components/Modals/EditStatsModal.svelte` — Editar estadísticas
- `src/lib/components/Modals/EditSessionModal.svelte` — Editar sesión
- `src/lib/components/Modals/ImageLightbox.svelte` — Lightbox de imagen

**Criterio de éxito:** Todos los modales se abren/cierran correctamente, los callbacks funcionan, los datos persisten.

---

### Batch 6: Routines View

**Archivos a crear:**
- `src/lib/components/Routines/RoutinesView.svelte` — CRUD de rutinas
- `src/lib/components/Routines/RoutineCard.svelte` — Card de rutina

**Criterio de éxito:** Se puede crear, renombrar, duplicar, eliminar, importar y exportar rutinas. El sort por creado/A-Z/uso funciona.

---

### Batch 7: History View

**Archivos a crear:**
- `src/lib/components/History/HistoryView.svelte` — Historial mensual
- `src/lib/export.ts` — Export a ExcelJS (downloadDayXLSX, downloadMonthXLSX)

**Criterio de éxito:** El historial muestra sesiones agrupadas por día, navegación entre meses, export a Excel funciona.

---

### Batch 8: Stats View

**Archivos a crear:**
- `src/lib/components/Stats/StatsView.svelte` — Gráficos Chart.js
- `src/lib/components/Stats/StatCard.svelte` — Tarjetas de resumen

**4 gráficos Chart.js:**
1. WeeklyChart (barra apilada — últimos 7 días)
2. RoutineChart (dona — distribución por rutina)
3. ProgressChart (línea — evolución de estadísticas)
4. ScheduleChart (barra agrupada — programado vs real)

**Criterio de éxito:** Los 4 gráficos se renderizan con datos reales, los summary cards muestran valores correctos.

---

### Batch 9: Settings + Cloud Sync

**Archivos a crear:**
- `src/lib/components/Settings/SettingsView.svelte` — Vista de ajustes
- `src/lib/components/Settings/SyncSection.svelte` — Login Google + auto-sync
- `src/lib/components/Settings/BackupManager.svelte` — Backups en Firestore

**Firebase:**
- `src/lib/firebase/config.ts` — Firebase init
- `src/lib/firebase/auth.ts` — Google Auth
- `src/lib/firebase/sync.ts` — Cloud sync (upload, download, merge, listener, backups)
- `src/lib/firebase/serializer.ts` — Serialización SyncPayload
- `src/lib/firebase/merge.ts` — Merge last-write-wins
- `src/lib/firebase/device.ts` — Device ID

**Tests Firebase:**
- `src/lib/firebase/merge.test.ts`
- `src/lib/firebase/serializer.test.ts`

**Criterio de éxito:** Login con Google funcional, sync sube y descarga datos, auto-sync toggle funcional, backups en la nube (crear/listar/restaurar/eliminar).

---

### Batch 10: Audio + Metronome

**Archivos a crear:**
- `src/lib/audio.ts` — Tone.js metronome (misma lógica que old-app)

**Criterio de éxito:** Metrónomo suena al ritmo del BPM configurado, bell sound al completar ejercicio, toggle audio on/off funcional.

---

### Batch 11: PWA + Service Worker

**Archivos:**
- Copiar `old-app/public/manifest.json` a `static/manifest.json`
- Copiar iconos a `static/`
- Configurar Service Worker de SvelteKit (opciones de adapter)

**Criterio de éxito:** La app es instalable como PWA, el service worker está registrado.

---

### Batch 12: Tests de Componentes + Polish

**Tests nuevos:**
- `src/lib/components/BottomNav.test.ts`
- `src/lib/components/Dashboard/ExerciseCard.test.ts`
- `src/lib/components/Dashboard/TimerBar.test.ts`
- `src/lib/components/Modals/CreateExerciseModal.test.ts`
- `src/lib/components/Modals/StatInputModal.test.ts`
- `src/lib/components/Modals/FinishModal.test.ts`
- `src/lib/components/Modals/ResetModal.test.ts`
- `src/lib/components/Details/DetailsView.test.ts`
- `src/lib/components/History/HistoryView.test.ts`

**Worker test:**
- `src/lib/worker.test.ts`

**Polish:**
- `svelte-check` pasa sin errores
- `prettier --check .` pasa
- `eslint .` pasa
- Verificar que `pnpm run build` produce build exitoso

**Criterio de éxito:** Todos los tests pasan, svelte-check sin errores, build produce output funcional.

---

### Resumen de Dependencias entre Batches

```
Batch 1 (Types + Store) ─────────────────────────── Base de todo
  ├── Batch 2 (Layout + Shell) ─── Depende de types
  │     ├── Batch 3 (Dashboard + Timer) ─── Depende de Store + Worker
  │     │     ├── Batch 4 (Details) ─── Depende de Dashboard (play/pause)
  │     │     └── Batch 5 (Modales) ─── Depende de Store
  │     ├── Batch 6 (Routines) ─── Depende de Store
  │     ├── Batch 7 (History) ─── Depende de Store + export.ts
  │     ├── Batch 8 (Stats) ─── Depende de Store
  │     └── Batch 9 (Settings + Firebase) ─── Depende de Store
  │           └── Batch 10 (Audio) ─── Independiente (solo store flags)
  └── Batch 11 (PWA) ─── Independiente
      └── Batch 12 (Tests + Polish) ─── Depende de todos los anteriores
```

**Cada batch debe producir código compilable (`svelte-check` sin errores en los archivos del batch) y testeable.** Los imports entre batches pueden fallar hasta que el batch dependiente esté completo, pero cada batch individual debe ser coherente.
