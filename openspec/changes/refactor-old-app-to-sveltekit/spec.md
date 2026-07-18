# SDD Spec: refactor-old-app-to-sveltekit

## 1. Resumen

Refactor completo de la aplicación `old-app/` (Vanilla JS con pub/sub, manipulación directa del DOM, vistas modulares) a SvelteKit 2 + Svelte 5 (runes mode) + TypeScript 6 strict. Se reemplaza la arquitectura de vistas basadas en `document.getElementById` y `innerHTML` por un modelo de componentes Svelte con estado reactivo (`$state`, `$derived`, `$effect`). No hay cambios funcionales — es un refactor que preserva exactamente el comportamiento existente, el esquema de persistencia (clave `musicRoutineApp_v36_stats`), y todas las funcionalidades incluyendo el Web Worker, Firebase sync offline-first, Chart.js, Tone.js, ExcelJS, Sortable.js, y los 12 módulos de rutinas de muestra.

La app refactorizada mantiene el patrón SPA con bottom-nav (5 tabs: Práctica, Rutinas, Historial, Stats, Ajustes) y NO usa SvelteKit routing entre páginas. Un único `+page.svelte` contiene toda la UI con `{#if}` condicional para la vista activa.

---

## 2. Estado Global (Store Spec)

### 2.1 Archivo: `src/lib/state/store.svelte.ts`

Módulo Svelte 5 con extensión `.svelte.ts` para que el compilador procese los runes `$state`. Sigue el patrón de old-app: NO es una clase, es un módulo que exporta funciones.

### 2.2 Variables de Estado (`$state`)

| Nombre | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `isExercisePlaying` | `boolean` | `false` | True cuando el temporizador de un ejercicio está corriendo |
| `isAudioOn` | `boolean` | `false` | True cuando el metrónomo está activo |
| `bpm` | `number` | `120` | BPM global actual (display y metrónomo) |
| `globalSeconds` | `number` | `0` | Total de segundos transcurridos en la sesión actual |
| `sessionStartedAt` | `number \| null` | `null` | `Date.now()` cuando se inició el primer ejercicio de la sesión |
| `activeExerciseId` | `string \| null` | `null` | ID del ejercicio que se está reproduciendo actualmente |
| `exerciseRemaining` | `number` | `0` | Segundos restantes del ejercicio activo |
| `viewingExerciseId` | `string \| null` | `null` | ID del ejercicio abierto en la vista Details |
| `autoplayRoutine` | `boolean` | `false` | Auto-avance al siguiente ejercicio al completar uno |
| `pendingDetailCompletion` | `boolean` | `false` | Flag interno para flujo de completado desde Details |
| `routines` | `Routine[]` | `[module1..module12]` | Array de todas las rutinas del usuario |
| `currentRoutineId` | `string` | `'module-1'` | ID de la rutina activa actualmente |
| `newExerciseForm` | `NewExerciseForm` | `{ bpm:100, min:2, sec:0, reps:1 }` | Valores del formulario de creación de ejercicio |
| `stats` | `Record<string, StatsEntry>` | `{}` | Estadísticas diarias claveadas por fecha YYYY-MM-DD |
| `sessions` | `Session[]` | `[]` | Historial de sesiones completadas |

### 2.3 Funciones Exportadas

#### Getters

| Función | Firma | Descripción |
|---------|-------|-------------|
| `getState()` | `() => StateProxy` | Retorna un proxy con getters de solo lectura para todas las variables `$state`. Los componentes acceden a `getState()` en templates — la reactividad fluye automáticamente porque Svelte 5 trackea los getters en tiempo de render. **No reemplaza al acceso directo a las variables `$state` exportadas** — se usa para compatibilidad con patrón old-app. |
| `getCurrentRoutine()` | `() => Routine` | Retorna la rutina cuyo ID coincide con `currentRoutineId`. Si no existe, fallback a la primera rutina del array. Si el array está vacío, crea una "Rutina Recuperada". |
| `getExerciseById()` | `(id: string) => Exercise \| undefined` | Busca un ejercicio por ID dentro de `getCurrentRoutine().exercises` |
| `getVisibleExercises()` | `() => Exercise[]` | Retorna `getCurrentRoutine().exercises` filtrados por `archived === false` |
| `getSessions()` | `(options?: { startDate?: string, endDate?: string, routineId?: string }) => Session[]` | Retorna sesiones filtradas, ordenadas por `completedAt` descendente |

#### Mutaciones de Estado

| Función | Firma | Comportamiento / Side Effects |
|---------|-------|-------------------------------|
| `setBpm()` | `(val: number) => void` | Asigna `bpm = Math.max(1, Math.min(300, val))` |
| `adjustBpm()` | `(delta: number) => void` | `setBpm(bpm + delta)`; si hay ejercicio activo, sincroniza su BPM |
| `recordProgressSeconds()` | `(seconds: number) => void` | Acumula segundos en `stats[todayStr()].totalSec` y `stats[todayStr()].routines[routineName]` |
| `addSession()` | `(sessionData: Omit<Session, 'id'>) => void` | Genera nanoid, pushea a `sessions[]`, asocia `sessionId` a `statisticLogs`, llama `saveData()` |
| `updateSession()` | `(id: string, data: Partial<Session>) => boolean` | Actualiza campos de sesión; si cambia `date`, reajusta `stats` vía `_adjustStatsForSession`. Retorna `false` si no encuentra. |
| `deleteSession()` | `(id: string) => boolean` | Elimina sesión, resta su contribución de `stats`, desasocia `sessionId` de `statisticLogs`. Retorna `false` si no encuentra. |
| `resetRoutine()` | `() => void` | Reinicia todos los ejercicios: `completed=false, remainingSec=durationSec, currentRep=1`. Limpia `activeExerciseId, exerciseRemaining, globalSeconds`. |

#### Persistencia

| Función | Firma | Comportamiento |
|---------|-------|----------------|
| `saveData()` | `(skipCloudSync?: boolean) => void` | Serializa `routines, currentRoutineId, stats, globalSeconds, sessionStartedAt, sessions` a JSON → `localStorage.setItem('musicRoutineApp_v36_stats', ...)`. Si `!skipCloudSync`, importa `firebase/sync` y llama `scheduleCloudSync()`. **Importante:** antes de guardar, sincroniza `exerciseRemaining → activeExercise.remainingSec`. |
| `loadData()` | `() => void` | Lee `localStorage.getItem(...)`, parsea JSON, asigna a cada variable `$state`. Ejecuta migración/normalización de campos legacy (`duration → durationSec`, defaults para `autoStart, archived, reps, currentRep, comment, statisticName, statisticLogs`). |
| `resetAllData()` | `() => void` | Elimina localStorage, restaura todas las variables `$state` a sus valores iniciales (con 12 rutinas de muestra), llama `saveData()`. |

#### Privadas (no exportadas)

| Función | Firma | Descripción |
|---------|-------|-------------|
| `_adjustStatsForSession()` | `(dateStr: string, session: Session, operation: 'add' \| 'subtract') => void` | Suma o resta `session.totalSec` de `stats[dateStr]`. Si `subtract` y `totalSec === 0`, elimina la entrada. |

### 2.4 Comparación: Old-App API → Nueva API

| old-app (`state.js`) | SvelteKit (`store.svelte.ts`) | Notas |
|----------------------|-------------------------------|-------|
| `_state` (objeto mutable) | Variables `$state` individuales | Reactividad granular automática |
| `getState()` → `_state` (referencia) | Exportación directa de getters $state | Los templates Svelte trackean automáticamente |
| `subscribe(fn)` → `unsubscribe()` | Eliminado | Los componentes leen `$state` directamente; no hay pub/sub manual |
| `_notify()` | Eliminado | `$state` notifica automáticamente |
| `saveData(skipCloudSync)` → `void` | `saveData(skipCloudSync?)` → `void` | Misma firma, mismo comportamiento |
| `loadData()` → `void` | `loadData()` → `void` | Misma firma, misma lógica de migración |
| `resetAllData()` → `void` | `resetAllData()` → `void` | Idéntico |
| `getCurrentRoutine()` → `Routine` | `getCurrentRoutine()` → `Routine` | Idéntico |
| `getExerciseById(id)` → `Exercise\|undefined` | `getExerciseById(id)` → `Exercise\|undefined` | Idéntico |
| `getVisibleExercises()` → `Exercise[]` | `getVisibleExercises()` → `Exercise[]` | Idéntico |
| `setBpm(val)` / `adjustBpm(delta)` → `void` | `setBpm(val)` / `adjustBpm(delta)` → `void` | Idéntico |
| `recordProgressSeconds(sec)` → `void` | `recordProgressSeconds(sec)` → `void` | Idéntico |
| `addSession(data)` → `void` | `addSession(data)` → `void` | Idéntico |
| `getSessions(opts)` → `Session[]` | `getSessions(opts)` → `Session[]` | Idéntico; tipado completo |
| `updateSession(id, data)` → `boolean` | `updateSession(id, data)` → `boolean` | Idéntico |
| `deleteSession(id)` → `boolean` | `deleteSession(id)` → `boolean` | Idéntico |
| `resetRoutine()` → `void` | `resetRoutine()` → `void` | Idéntico |
| `migrateOldStateIfNeeded()` | Eliminado | La migración es parte de `loadData()` |

---

## 3. Componentes

### 3.1 `+page.svelte` (raíz, ruta única)

**Ubicación:** `src/routes/+page.svelte`

**Propósito:** Layout raíz SPA. Inicializa Web Worker, Sortable.js, Firebase auth observer, service worker. Renderiza el tab activo condicionalmente.

**Estado interno:** (ninguno — usa `getState()` de store)

**Efectos (`$effect`):**
- `onMount`: Crea Web Worker (`new Worker(new URL('$lib/worker.ts', import.meta.url))`), registra `worker.onmessage` → llama `onWorkerTick()` del store
- `onMount`: setupSortable.js en el contenedor de ejercicios
- `onMount`: `loadData()`, `handleRedirectResult()`, `observeAuth()` → `downloadAndMergeState()` / `startSyncListener()`
- `onMount`: `registerServiceWorker()`
- `beforeunload` (vía `onMount` cleanup): `saveData()`

**Slots/Children:** Renderiza todos los componentes modales y condicionalmente las vistas según `activeTab`.

**Eventos:** Ninguno directo — delega a store.

### 3.2 BottomNav

**Ubicación:** `src/lib/components/BottomNav.svelte`

**Props (vía `$props()`):** Ninguna

**Estado interno:** Lee `activeTab` del store (variable `$state`). Sin estado interno adicional.

**Eventos:**
- Click en `[data-tab="practice"]` → `activateTab('practice')`
- Click en `[data-tab="routines"]` → `activateTab('routines')`
- Click en `[data-tab="history"]` → `activateTab('history')`
- Click en `[data-tab="stats"]` → `activateTab('stats')`
- Click en `[data-tab="settings"]` → `activateTab('settings')`

**Efecto:** Al hacer tap en el mismo tab activo, hace scroll-to-top del contenido (para Practice y Stats).

**Slots:** Ninguno

### 3.3 Dashboard (Práctica)

#### `Dashboard.svelte`

**Ubicación:** `src/lib/components/Dashboard/Dashboard.svelte`

**Props:** Ninguna

**Estado interno:** Lee store completo vía `$state`/getters. Renderiza condicionalmente.

**Eventos/Actions:**
- BPM arriba (+1) → `adjustBpm(1)` + `setMetronomeBpm(bpm)`
- BPM abajo (-1) → `adjustBpm(-1)` + `setMetronomeBpm(bpm)`
- Botón play/pause global → `toggleGlobalAudioOnly()` (toggle `isAudioOn`, init/start/stop metronome)
- Toggle autoplay → asigna `autoplayRoutine`
- Botón FINISH → `finishRoutine()`
- Botón RESET → `resetRoutine()` (vía confirmación modal)
- FAB (+) → abre `CreateExerciseModal`

**Slots/Children:**
- `TimerBar` — muestra `globalPracticeTimer / totalRoutineTime`
- `ExerciseCard` (x N) — lista de ejercicios visibles, con drag handle Sortable.js
- `{#if viewingExerciseId}` → `DetailsView`

#### `TimerBar.svelte`

**Ubicación:** `src/lib/components/Dashboard/TimerBar.svelte`

**Props:**
| Prop | Tipo | Descripción |
|------|------|-------------|
| `globalSeconds` | `number` | Segundos totales acumulados |
| `totalRoutineTime` | `number` | Duración total programada (segundos) |

**Estado interno:** Ninguno

**Eventos:** Ninguno

#### `ExerciseCard.svelte`

**Ubicación:** `src/lib/components/Dashboard/ExerciseCard.svelte`

**Props:**
| Prop | Tipo | Descripción |
|------|------|-------------|
| `exercise` | `Exercise` | Datos completos del ejercicio |
| `isActive` | `boolean` | Si es el ejercicio actualmente reproduciéndose |
| `isTimerRunning` | `boolean` | Si el temporizador está activo para este ejercicio |
| `remaining` | `number` | Segundos restantes (viene de store) |

**Estado interno:** Ninguno (todo deriva de props/store)

**Eventos/Actions:**
| Evento | Trigger | Efecto |
|--------|---------|--------|
| Click en botón Start/Stop | Click en el badge de acción | Si no completado: `toggleListExercise(exercise.id)` (play/pause alterna) |
| Click en chevron detail | Click en `>` | Abre `DetailsView` para este ejercicio (`viewingExerciseId = exercise.id`) |
| Click en imagen lightbox | Click en thumbnail | Abre `ImageLightbox` con la URL |
| Click en link externo | Click en icono de link | `window.open(url, '_blank')` |
| Drag handle | Arrastre del `fa-grip-vertical` | Sortable.js maneja el reorden |

**Renderizado condicional:**
- Badge de reps: `Rep {currentRep}/{reps}` (solo si `reps > 1`)
- Badge de estadística: `{statisticName}: {lastValue}` (solo si `statisticName` no es null)
- Barra de progreso: ancho `progressPercent%`
- Color de fondo: verde si `completed`, verde claro si `active`, blanco por defecto
- Imagen thumbnail si `getFirstImage(comment)` existe
- Botón de link externo si `getFirstUrl(comment)` existe

### 3.4 Details (Editor de Ejercicio)

#### `DetailsView.svelte`

**Ubicación:** `src/lib/components/Details/DetailsView.svelte`

**Props:** Ninguna (usa `viewingExerciseId` del store para obtener el ejercicio)

**Estado interno:** Lee `viewingExerciseId` → `getExerciseById(viewingExerciseId)`.

**Eventos/Actions:**
| Evento | Efecto |
|--------|--------|
| Back (flecha) | `closeDetailsView()` — limpia `viewingExerciseId`, vuelve a Dashboard |
| Input título (oninput) | `updateExerciseTitle(newTitle)` → asigna `ex.title`, saveData, rerender |
| Input stat name (oninput) | `updateDetailStatName(newVal)` → asigna `ex.statisticName`, saveData |
| Botón Start/Pause | `toggleDetailPlay()` — si activo → pause, si no → play |
| Botón Reset | `resetCurrentDetailExercise()` — reinicia remainingSec, completed, currentRep |
| Botón Complete | `completeDetailExercise()` — si tiene statisticName → muestra StatInputModal, luego `forceFinishDetail()` |
| Reps +/- | `adjustDetailReps(delta)` — clamp min 1 |
| Minutos +/- | `adjustDetailTime('min', val)` — `durationSec += val*60` |
| Segundos +/- | `adjustDetailTime('sec', val)` — `durationSec += val` (val=±5) |
| BPM +/- | `adjustDetailBPM(delta)` — delta=±5, clamp min 1 |
| Autostart checkbox | `updateDetailAutoStart(checked)` — sincroniza con audio si está activo |
| Comment textarea | `updateComment(text)` — saveData, rerender attachments |
| Menú avanzado (engranaje) | `toggleDetailsMenu()` — toggle dropdown |
| Duplicate | `duplicateExercise()` — deep clone, inserta después del original, cierra Details |
| Archive | `archiveExercise()` — marca `archived=true`, cierra Details |
| Delete | `deleteDetailExercise()` — confirma, elimina del array, cierra Details |

**Slots/Children:**
- `AttachmentList` — muestra imágenes y links extraídos del comment

#### `AttachmentList.svelte`

**Ubicación:** `src/lib/components/Details/AttachmentList.svelte`

**Props:**
| Prop | Tipo | Descripción |
|------|------|-------------|
| `comment` | `string` | Texto del comentario para extraer URLs |

**Estado interno:** Ninguno — deriva todo de `comment`.

**Comportamiento:** Extrae imágenes (`.png|jpg|jpeg|gif|webp|svg`) y links (cualquier URL). Renderiza thumbnails de imágenes clickeables (abren ImageLightbox) y links como botones `<a>`.

### 3.5 Routines (Rutinas)

#### `RoutinesView.svelte`

**Ubicación:** `src/lib/components/Routines/RoutinesView.svelte`

**Props:** Ninguna

**Estado interno:**
- `sortMode: 'created' | 'alpha' | 'usage'` (local component state, no persiste)
- `sortAsc: boolean`

**Eventos/Actions:**
| Evento | Efecto |
|--------|--------|
| Nueva Rutina | `showNewRoutineInput()` — prompt → push routine con nanoid + `createdAt: Date.now()` |
| Importar | `triggerImport()` → click en input file oculto → `importRoutines(input)` → parsea JSON, sanitiza, añade |
| Sort tag click | `handleSortClick(key)` — cambia modo/orden, rerenderiza |
| Select routine (play) | `switchRoutine(id)` — pausa si está reproduciendo, cambia `currentRoutineId`, navega a Practice |
| Rename | `renameRoutine(id)` — prompt → asigna `r.name` |
| Export single | `exportSingleRoutine(id)` — `downloadJSON(JSON.stringify(routine), filename)` |
| Duplicate | `duplicateRoutine(id)` — deep clone con nuevos nanoids, pushea al array |
| Delete | `deleteRoutine(id)` — si es la única, alert; si es la actual, switch a otra; elimina |
| Menu toggle (tres puntos) | Toggle dropdown con posicionamiento dinámico (arriba/abajo según espacio) |

**Slots/Children:**
- `RoutineCard.svelte` (x N) — cada item de rutina en la lista

#### `RoutineCard.svelte`

**Ubicación:** `src/lib/components/Routines/RoutineCard.svelte`

**Props:**
| Prop | Tipo | Descripción |
|------|------|-------------|
| `routine` | `Routine` | Datos de la rutina |
| `isCurrent` | `boolean` | Si es la rutina activa |
| `activeCount` | `number` | Ejercicios no archivados |
| `archivedCount` | `number` | Ejercicios archivados |

**Eventos:** Ninguno directo — emite eventos al RoutinesView.

### 3.6 History (Historial)

#### `HistoryView.svelte`

**Ubicación:** `src/lib/components/History/HistoryView.svelte`

**Props:** Ninguna

**Estado interno:**
- `currentYear: number` (inicial: `new Date().getFullYear()`)
- `currentMonth: number` (inicial: `new Date().getMonth()`, 0-indexed)

**Eventos/Actions:**
| Evento | Efecto |
|--------|--------|
| Mes anterior | `currentMonth--` (wrap anual), rerender |
| Mes siguiente | `currentMonth++` (wrap anual), rerender |
| Exportar mes | `exportMonth()` → filtra sesiones del mes, agrupa por día, llama `downloadMonthXLSX()` |
| Exportar día (botón en cada día) | `_exportDay(dateStr)` → filtra sesiones del día, llama `downloadDayXLSX()` |
| Editar sesión | `_editSession(sessionId)` → abre `EditSessionModal` |

**Renderizado:**
- Agrupa sesiones por mes (`YYYY-MM` prefix)
- Por cada día: header con nombre de día + botón Excel
- Por cada sesión: nombre rutina, tiempo programado, tiempo real, ejercicios completados
- Muestra mensaje "Sin práctica este mes" si no hay sesiones

### 3.7 Stats (Estadísticas)

#### `StatsView.svelte`

**Ubicación:** `src/lib/components/Stats/StatsView.svelte`

**Props:** Ninguna

**Estado interno:** Referencias a instancias de Chart.js (4 gráficos). Lee store para datos.

**Eventos/Actions:**
| Evento | Efecto |
|--------|--------|
| Back | Vuelve a Dashboard |
| Filtrar (progreso) | Rerenderiza ProgressChart con nuevo rango de fechas |
| Gestionar Datos | Abre `EditStatsModal` para editar/eliminar statisticLogs |

**Renderizado (4 gráficos Chart.js):**
1. **WeeklyChart** (barra apilada): Últimos 7 días, minutos por rutina, colores por `stringToColor(routineName)`. Stacked.
2. **RoutineChart** (dona): Distribución total por rutina en minutos.
3. **ProgressChart** (línea): Evolución de `statisticLogs` por ejercicio con filtro de fechas. `spanGaps: true`.
4. **ScheduleChart** (barra agrupada): Últimos 14 días, programado vs real en minutos.

**Summary cards (4 stat cards):**
- Total practicado: `totalSecondsAllTime → Xh Ym`
- Racha: días consecutivos con práctica (hoy o ayer hasta atrás)
- Sesiones: cantidad de fechas únicas en `stats`
- Promedio: `totalSecondsAllTime / 60 / sessionsCount → Ym`

#### `StatCard.svelte`

**Ubicación:** `src/lib/components/Stats/StatCard.svelte`

**Props:**
| Prop | Tipo | Descripción |
|------|------|-------------|
| `title` | `string` | Título de la tarjeta |
| `value` | `string` | Valor principal |
| `subtitle` | `string` | Texto secundario |
| `icon` | `string` | Clase FontAwesome (ej. `'fa-clock'`) |

### 3.8 Settings (Ajustes)

#### `SettingsView.svelte`

**Ubicación:** `src/lib/components/Settings/SettingsView.svelte`

**Props:** Ninguna

**Estado interno:** Ninguno — todo leído del store o de Firebase.

**Eventos/Actions:**
| Evento | Efecto |
|--------|--------|
| Ver archivados | `showArchivedExercises()` — alert con lista |
| Backup completo | `exportAllData()` — `downloadJSON({ routines, stats, sessions })` |
| Restaurar | `triggerRestore()` → input file → `restoreAllData(input)` — parsea JSON, sobreescribe estado, resetea ejercicios |
| Copias en la nube | `openBackupManager()` — overlay con lista de backups |
| Ir a Stats | `openStatsView()` — cambia a tab Stats |
| Borrar todos los datos | `deleteAllData()` — confirmación doble (confirm + prompt "BORRAR"), llama `resetAllData()` |

**Slots/Children:**
- `SyncSection.svelte`
- `BackupManager.svelte` (overlay condicional)

#### `SyncSection.svelte`

**Ubicación:** `src/lib/components/Settings/SyncSection.svelte`

**Props:** Ninguna

**Estado interno:** Lee `auth.currentUser` de Firebase Auth (exposición reactiva vía store).

**Eventos/Actions:**
| Evento | Efecto |
|--------|--------|
| Iniciar sesión Google | `loginGoogle()` → popup/redirect |
| Sincronizar ahora | `downloadAndMergeState(uid)` + `uploadState(uid)`. Actualiza "Última sincronización" |
| Toggle auto-sync | Alterna flag que `scheduleCloudSync()` chequea |
| Cerrar sesión | `logoutGoogle()` |

**Renderizado condicional:**
- Si `!user`: Muestra botón "Iniciar sesión con Google"
- Si `user`: Muestra email, estado (punto verde/amarillo/rojo), última sincronización, botones sync now/auto-sync/logout

#### `BackupManager.svelte`

**Ubicación:** `src/lib/components/Settings/BackupManager.svelte`

**Props:** `show: boolean` (controlado por SettingsView)

**Estado interno:** Lista de backups cargada asíncronamente.

**Eventos/Actions:**
| Evento | Efecto |
|--------|--------|
| Guardar copia ahora | `saveBackup(uid, label)` → crea snapshot en Firestore |
| Restaurar (click en backup) | `restoreFromBackup(backupId)` → carga y remplaza estado local |
| Exportar JSON (backup) | `exportBackup(backupId)` → descarga backup como JSON |
| Eliminar backup | `deleteBackup(uid, backupId)` → elimina de Firestore |

### 3.9 Modales

#### `CreateExerciseModal.svelte`

**Ubicación:** `src/lib/components/Modals/CreateExerciseModal.svelte`

**Props:**
| Prop | Tipo | Descripción |
|------|------|-------------|
| `show` | `boolean` | Control de visibilidad |

**Estado interno:** Lee `newExerciseForm` del store.

**Eventos:**
- Reps +/- → `adjustNewReps(delta)`
- BPM +/- → `adjustNewBPM(delta)` (delta=±5)
- Min +/- → `adjustNewTime('min', delta)` (delta=±1)
- Sec +/- → `adjustNewTime('sec', delta)` (delta=±5)
- Autostart checkbox → toggle en `newExerciseForm` (lectura directa del DOM temporalmente o vía bind)
- Cancel → cierra modal
- Create → `addNewExercise()` — valida título, construye Exercise, pushea, saveData, scroll abajo, cierra modal

#### `StatInputModal.svelte`

**Ubicación:** `src/lib/components/Modals/StatInputModal.svelte`

**Props:**
| Prop | Tipo | Descripción |
|------|------|-------------|
| `show` | `boolean` | Visibilidad |
| `statName` | `string` | Nombre de la estadística a mostrar |
| `onSave` | `(value: number) => void` | Callback al guardar |
| `onSkip` | `() => void` | Callback al saltar |

**Estado interno:** `inputValue: string` (bind al input)

**Eventos:**
- Save → parseFloat → `onSave(val)` si es válido
- Skip → `onSkip()`

#### `FinishModal.svelte`

**Ubicación:** `src/lib/components/Modals/FinishModal.svelte`

**Props:**
| Prop | Tipo | Descripción |
|------|------|-------------|
| `show` | `boolean` | Visibilidad |
| `summary` | `{ exercises: number, scheduledSec: number, elapsedSec: number, startedAt: string \| null, completedAt: string }` | Resumen de la sesión |
| `onAccept` | `() => void` | Callback al aceptar |

**Eventos:** Aceptar (`onAccept`), Cancelar (cierra modal).

#### `ResetModal.svelte`

**Ubicación:** `src/lib/components/Modals/ResetModal.svelte`

**Props:**
| Prop | Tipo | Descripción |
|------|------|-------------|
| `show` | `boolean` | Visibilidad |
| `onConfirm` | `() => void` | Callback al confirmar |

**Eventos:** OK (`onConfirm`), Cancelar (cierra modal).

#### `EditStatsModal.svelte`

**Ubicación:** `src/lib/components/Modals/EditStatsModal.svelte`

**Props:**
| Prop | Tipo | Descripción |
|------|------|-------------|
| `show` | `boolean` | Visibilidad |

**Estado interno:** Carga todos los `statisticLogs` de todos los ejercicios de todas las rutinas, ordenados por fecha descendente. Renderiza lista con botones editar/eliminar por item.

**Eventos:**
- Editar log → `prompt()` → `parseFloat` → asigna nuevo valor → saveData, rerender Stats si visible
- Eliminar log → confirm → `splice` → saveData, rerender Stats si visible
- Close → cierra modal

#### `EditSessionModal.svelte`

**Ubicación:** `src/lib/components/Modals/EditSessionModal.svelte`

**Props:**
| Prop | Tipo | Descripción |
|------|------|-------------|
| `show` | `boolean` | Visibilidad |
| `sessionId` | `string \| null` | ID de la sesión a editar |

**Estado interno:** Carga `session` de `getSessions()`.

**Eventos:**
- Cambiar fecha → input date
- Guardar → `updateSession(sessionId, { date })` → rerender History + Stats
- Eliminar sesión → confirm → `deleteSession(sessionId)` → rerender
- Cancelar → cierra modal

#### `ImageLightbox.svelte`

**Ubicación:** `src/lib/components/Modals/ImageLightbox.svelte`

**Props:**
| Prop | Tipo | Descripción |
|------|------|-------------|
| `show` | `boolean` | Visibilidad |
| `imageUrl` | `string` | URL de la imagen a mostrar |

**Eventos:** Click fuera o en X → cierra.

---

## 4. Servicios

### 4.1 `audio.ts`

**Ubicación:** `src/lib/audio.ts`

**Dependencia CDN:** `Tone` (global vía `window.Tone`)

**Variables internas:**
- `metroSynth: Tone.Synth | null`
- `bellSynth: Tone.PolySynth | null`
- `beat: number` (0-3, contador de compás)
- `_initialized: boolean`
- `_isAudioOn: boolean` (toggle manual para evitar circular imports)

**Funciones exportadas:**

| Función | Firma | Descripción |
|---------|-------|-------------|
| `initAudio()` | `() => Promise<void>` | Inicializa Tone.js (`Tone.start()`), crea `metroSynth` (Synth, sine wave, 32n) y `bellSynth` (PolySynth, sine, 2n). Programa `scheduleRepeat` cada 4n: si `_isAudioOn`, toca C6 en beat 0, G5 en beats 1-3. Safe to call multiple times. |
| `setAudioOn()` | `(val: boolean) => void` | Asigna `_isAudioOn` |
| `playBellSound()` | `() => void` | Toca acorde C5-E5-G5 con `bellSynth.triggerAttackRelease(['C5','E5','G5'], '2n')` |
| `startMetronome()` | `(bpm: number) => void` | Resetea beat=0, asigna `Tone.Transport.bpm.value = bpm`, inicia Transport si no está corriendo |
| `stopMetronome()` | `() => void` | Detiene Transport, resetea beat=0 |
| `setMetronomeBpm()` | `(bpm: number) => void` | Solo actualiza `Tone.Transport.bpm.value` sin restart |

### 4.2 `worker.ts`

**Ubicación:** `src/lib/worker.ts`

**Propósito:** Web Worker que ejecuta un intervalo de 1 segundo. Misma lógica exacta que old-app.

**Mensajes (entrada → `self.onmessage`):**
| Mensaje | Comportamiento |
|---------|----------------|
| `'start'` | Si no hay intervalo activo, inicia `setInterval(() => self.postMessage('tick'), 1000)` |
| `'stop'` | Si hay intervalo activo, `clearInterval`, setea a null |

**Mensajes (salida → `self.postMessage`):**
| Mensaje | Cuándo |
|---------|--------|
| `'tick'` | Cada 1000ms mientras el worker esté corriendo |

**Inicialización en `+page.svelte`:**
```typescript
const worker = new Worker(new URL('$lib/worker.ts', import.meta.url), { type: 'module' });
worker.onmessage = (e) => {
  if (e.data === 'tick') onWorkerTick();
};
```

### 4.3 `export.ts`

**Ubicación:** `src/lib/export.ts`

**Dependencia CDN:** `ExcelJS` (global vía `window.ExcelJS`)

**Constantes:**
- `MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']`
- `COLUMNS = [{ header: 'Titulo', width: 40 }, { header: 'Reps', width: 8 }, { header: 'Bpm', width: 8 }, { header: 'duracion', width: 10 }, { header: 'Series', width: 8 }, { header: 'total', width: 10 }, { header: 'notas', width: 45 }]`

**Funciones exportadas:**

| Función | Firma | Descripción |
|---------|-------|-------------|
| `secToMin()` | `(sec: number) => number` | `Math.round(sec / 60)` |
| `downloadDayXLSX()` | `(daySessions: Session[], resolveRoutineName: (s: Session) => string, dateStr: string) => Promise<void>` | Crea workbook, una hoja por día (dd-mm-yyyy), escribe sesiones apiladas. Guard: si `!window.ExcelJS`, alert. |
| `downloadMonthXLSX()` | `(monthDayGroups: Record<string, Session[]>, resolveRoutineName: (s: Session) => string, year: number, month: number, monthLabel: string) => Promise<void>` | Crea workbook, una hoja por día (ej. "4 Mayo"), escribe sesiones. Guard: si `!window.ExcelJS`, alert. |

**Funciones privadas:**
| Función | Comportamiento |
|---------|----------------|
| `styleHeaderRow(row)` | Bold, blanco, fondo #E53935, bordes delgados, centrado |
| `styleDataRow(row)` | Bordes grises delgados, alineación vertical middle |
| `writeSessionSheet(ws, daySessions, resolveRoutineName)` | Por sesión: título (Rutina N: Nombre, bold rojo, merged A:G), headers, filas de ejercicios con zebra striping. Columnas: Titulo, Reps, Bpm, duracion (min), Series, total (series*dur), notas |

---

## 5. Firebase Module

### 5.1 `config.ts`

**Ubicación:** `src/lib/firebase/config.ts`

**Exports:**
```typescript
export const app: FirebaseApp;     // initializeApp(firebaseConfig)
export const db: Firestore;        // initializeFirestore(app, { localCache: persistentLocalCache() })
export const auth: Auth;           // getAuth(app)
```

**Firebase Config (mismas credenciales):**
```typescript
const firebaseConfig = {
  apiKey: 'AIzaSyCvI_IAAcpBFMRpWSJ7wt2RND9fhCgpSRw',
  authDomain: 'music-routine-app.firebaseapp.com',
  projectId: 'music-routine-app',
  storageBucket: 'music-routine-app.firebasestorage.app',
  messagingSenderId: '908433154492',
  appId: '1:908433154492:web:36c81821c5b5b7f183cbb9'
};
```

**Nota:** `persistentLocalCache()` garantiza operaciones offline-first.

### 5.2 `auth.ts`

**Ubicación:** `src/lib/firebase/auth.ts`

**Funciones exportadas:**

| Función | Firma | Descripción |
|---------|-------|-------------|
| `loginGoogle()` | `() => Promise<UserCredential \| null>` | `signInWithPopup(auth, provider)`. Si `auth/popup-blocked`, fallback a `signInWithRedirect`. |
| `handleRedirectResult()` | `() => Promise<UserCredential \| null>` | `getRedirectResult(auth)` — procesa resultado de redirect mobile |
| `logoutGoogle()` | `() => Promise<void>` | `signOut(auth)` |
| `observeAuth()` | `(callback: (user: User \| null) => void) => () => void` | `onAuthStateChanged(auth, callback)`. Retorna unsubscribe. |

### 5.3 `sync.ts`

**Ubicación:** `src/lib/firebase/sync.ts`

**Variables internas:**
- `CLOUD_SYNC_KEY = 'music-cloud-sync'`
- `syncTimeout: number | null`
- `unsubscribeSnapshot: (() => void) | null`
- `initialSyncDone: boolean`

**Funciones exportadas:**

| Función | Firma | Descripción |
|---------|-------|-------------|
| `uploadState()` | `(uid: string) => Promise<void>` | Lee `getState()`, construye payload con `schemaVersion:1, updatedAt: serverTimestamp(), deviceId, data: exportSyncState(state)`, hace `setDoc(users/{uid}/app/state, payload)`. Dispara evento de UI 'synced'. |
| `downloadState()` | `(uid: string) => Promise<object \| null>` | `getDoc(users/{uid}/app/state)`. Si no existe, retorna null. Convierte `updatedAt` de Timestamp a millis. |
| `downloadAndMergeState()` | `(uid: string) => Promise<void>` | Flujo completo: `downloadState()`. Si cloud vacío → upload local. Si `neverSynced` → cloud reemplaza local (primera vez). Si ya sincronizado → `mergeState(localData, cloudDoc)`. Si `result.changed`, actualiza `_state` y `saveData(true)`. Actualiza `lastSyncTime`. |
| `syncNow()` | `() => Promise<void>` | Sincronización inmediata (sin debounce, sin check de toggle). Upload + dispatch evento. |
| `scheduleCloudSync()` | `() => void` | Debounce 2000ms. Si auto-sync toggle está checked, hace `uploadState()`. |
| `startSyncListener()` | `(uid: string, onRemoteChange: (data: any) => void) => () => void` | `onSnapshot(users/{uid}/app/state)`. Skip si `deviceId === ours` (propia escritura). Skip si `!initialSyncDone`. Si `cloudTime > localTime`, llama `onRemoteChange(merged)`. Retorna unsubscribe. |
| `stopSyncListener()` | `() => void` | Si hay listener activo, lo desuscribe. |
| `saveBackup()` | `(uid: string, label?: string) => Promise<string>` | Crea documento en `users/{uid}/backups/{backupId}` con `createdAt, label, data: exportSyncState(state)`. |
| `listBackups()` | `(uid: string) => Promise<BackupMeta[]>` | Query `orderBy('createdAt', 'desc')` en subcolección backups. Retorna array con id, label, createdAt. |
| `loadBackup()` | `(uid: string, backupId: string) => Promise<object \| null>` | `getDoc(backups/{backupId})`. |
| `deleteBackup()` | `(uid: string, backupId: string) => Promise<void>` | `deleteDoc(backups/{backupId})`. |

**Funciones privadas:**
| Función | Descripción |
|---------|-------------|
| `getDocRef(uid)` | Retorna `doc(db, 'users', uid, 'app', 'state')` |
| `getBackupCollRef(uid)` | Retorna `collection(db, 'users', uid, 'backups')` |
| `getBackupDocRef(uid, backupId)` | Retorna `doc(db, 'users', uid, 'backups', backupId)` |
| `getLastSyncTime()` | Lee `localStorage.getItem(CLOUD_SYNC_KEY)` → parsea → `updatedAt \| 0` |
| `setLastSyncTime(uid, updatedAt)` | Escribe `{ uid, updatedAt }` en localStorage |
| `dispatchSyncEvent(status)` | Dispara `CustomEvent('sync-status', { detail: { status } })` en la `window` |

### 5.4 `serializer.ts`

**Ubicación:** `src/lib/firebase/serializer.ts`

| Función | Firma | Descripción |
|---------|-------|-------------|
| `exportSyncState()` | `(state: State) => SyncPayload` | Extrae `{ routines, stats, sessions, currentRoutineId }` del estado completo (excluye flags transitorios como `bpm, isExercisePlaying`) |
| `importSyncState()` | `(data: any) => SyncPayload` | Retorna objeto con defaults seguros: `routines: data?.routines \| [], stats: data?.stats \| {}, sessions: data?.sessions \| [], currentRoutineId: data?.currentRoutineId \| null` |

### 5.5 `merge.ts`

**Ubicación:** `src/lib/firebase/merge.ts`

| Función | Firma | Descripción |
|---------|-------|-------------|
| `mergeState()` | `(localData: { _syncedAt: number, data: SyncPayload } \| null, cloudData: { updatedAt: number \| Timestamp, data: SyncPayload } \| null) => { changed: boolean, data: SyncPayload \| null }` | Estrategia last-write-wins. Reglas: (1) cloud null → no change; (2) local null → cloud wins; (3) `local._syncedAt === 0` (nunca sincronizado) → cloud wins; (4) `cloudTime > localTime` → cloud wins; (5) local más nuevo → keep local. Deep clone del resultado. |

### 5.6 `device.ts`

**Ubicación:** `src/lib/firebase/device.ts`

| Función | Firma | Descripción |
|---------|-------|-------------|
| `getDeviceId()` | `() => string` | Lee `localStorage.getItem('music-device-id')`. Si no existe, genera `crypto.randomUUID()`, persiste. Retorna el UUID. |

---

## 6. Tipos TypeScript

### 6.1 `types.ts`

**Ubicación:** `src/lib/state/types.ts`

```typescript
// === Exercise ===
interface Exercise {
  id: string;                    // nanoid
  title: string;
  bpm: number;                   // BPM específico del ejercicio
  durationSec: number;           // Duración total en segundos
  remainingSec: number;          // Segundos restantes (para progreso)
  completed: boolean;            // Marcado como completado en la sesión actual
  autoStart: boolean;            // Iniciar metrónomo automáticamente
  archived: boolean;             // Archivado (oculto de la vista principal)
  reps: number;                  // Número de repeticiones configuradas
  currentRep: number;            // Repetición actual (1-indexed)
  comment: string;               // Notas del usuario (puede contener URLs)
  statisticName: string | null;  // Nombre de la estadística (ej. "Changes", "Clean Hits")
  statisticLogs: StatLog[];      // Historial de valores registrados
}

// === StatLog ===
interface StatLog {
  date: string;                  // YYYY-MM-DD
  value: number;                 // Valor registrado
  sessionId?: string;            // ID de sesión asociada (para trazabilidad)
}

// === Routine ===
interface Routine {
  id: string;                    // nanoid
  name: string;
  exercises: Exercise[];
  createdAt?: number;            // timestamp (para ordenar por "creado")
}

// === Session (History) ===
interface Session {
  id: string;                    // nanoid
  date: string;                  // YYYY-MM-DD
  routineId: string;             // ID de la rutina (resuelve nombre actual)
  routineName: string;           // Nombre al momento de completar (fallback)
  startedAt: string;             // ISO datetime — inicio del primer ejercicio
  completedAt: string;           // ISO datetime — click en FINISH
  scheduledSec: number;          // Duración programada total (durationSec * reps)
  totalSec: number;              // Segundos activos de práctica
  elapsedSec: number;            // Segundos pared (startedAt → completedAt)
  exercises: SessionExercise[];
}

// === SessionExercise ===
interface SessionExercise {
  exerciseId: string;
  title: string;
  bpm: number;
  durationSec: number;
  statName: string | null;
  statValue: number | null;
  repsCompleted: number;
  comment: string;
}

// === StatsEntry (diario) ===
interface StatsEntry {
  totalSec: number;              // Segundos totales de práctica ese día
  routines: Record<string, number>;  // Desglose por nombre de rutina (segundos)
}

// === NewExerciseForm (formulario modal) ===
interface NewExerciseForm {
  bpm: number;                   // Default: 100
  min: number;                   // Default: 2
  sec: number;                   // Default: 0
  reps: number;                  // Default: 1
}

// === SyncPayload (Firestore) ===
interface SyncPayload {
  routines: Routine[];
  stats: Record<string, StatsEntry>;
  sessions: Session[];
  currentRoutineId: string | null;
}

// === BackupMeta (lista de backups) ===
interface BackupMeta {
  id: string;
  label: string;
  createdAt: number;             // millis
}

// === StateProxy (getState return) ===
interface StateProxy {
  readonly isExercisePlaying: boolean;
  readonly isAudioOn: boolean;
  readonly bpm: number;
  readonly globalSeconds: number;
  readonly sessionStartedAt: number | null;
  readonly activeExerciseId: string | null;
  readonly exerciseRemaining: number;
  readonly viewingExerciseId: string | null;
  readonly autoplayRoutine: boolean;
  readonly pendingDetailCompletion: boolean;
  readonly routines: Routine[];
  readonly currentRoutineId: string;
  readonly newExerciseForm: NewExerciseForm;
  readonly stats: Record<string, StatsEntry>;
  readonly sessions: Session[];
}
```

### 6.2 `app.d.ts` (declaraciones globales)

**Ubicación:** `src/app.d.ts`

```typescript
declare global {
  // Sortable.js CDN
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

  // Tone.js CDN
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

  // ExcelJS CDN
  const ExcelJS: {
    Workbook: new () => any;
  };

  // Chart.js CDN
  const Chart: new(ctx: CanvasRenderingContext2D, config: any) => any;
}
```

---

## 7. Persistencia

### 7.1 localStorage

| Clave | Valor | Descripción |
|-------|-------|-------------|
| `musicRoutineApp_v36_stats` | JSON string con `{ routines, currentRoutineId, stats, globalSeconds, sessionStartedAt, sessions }` | Estado completo de la aplicación |
| `music-cloud-sync` | JSON string con `{ uid, updatedAt }` | Metadata de última sincronización cloud |
| `music-device-id` | UUID string | Identificador único del dispositivo |

### 7.2 Schema y Migración

El schema es el **mismo** que old-app. `loadData()` ejecuta migración/normalización:

```typescript
// En loadData(), después de parsear JSON:
r.exercises.forEach(ex => {
  if (ex.durationSec === undefined && ex.duration !== undefined) {
    ex.durationSec = ex.duration * 60; // legacy: duration en minutos
    delete ex.duration;
  }
  if (ex.remainingSec === undefined) ex.remainingSec = ex.durationSec;
  ex.autoStart = ex.autoStart ?? true;
  ex.archived = ex.archived ?? false;
  ex.reps = ex.reps ?? 1;
  ex.currentRep = ex.currentRep ?? 1;
  ex.comment = ex.comment ?? '';
  ex.statisticName = ex.statisticName || null;
  ex.statisticLogs = ex.statisticLogs || [];
});
```

### 7.3 Flujo de persistencia

```
User Action → state mutation → saveData()
  ├── Sync: exerciseRemaining → activeExercise.remainingSec
  ├── JSON.stringify → localStorage.setItem('musicRoutineApp_v36_stats', ...)
  ├── (if auto-sync enabled) scheduleCloudSync() → debounce 2s → uploadState()
  └── (subscriber eliminado — reactividad Svelte maneja UI)

loadData()
  ├── localStorage.getItem(...)
  ├── JSON.parse → asignar a variables $state
  ├── Migrar/normalizar campos legacy
  └── UI reactivo automático
```

---

## 8. Tests

### 8.1 `store.test.ts` (state tests)

**Ubicación:** `src/lib/state/store.test.ts`

**Mocks necesarios:**
- `nanoid` → retorna `'test-nanoid'`
- `date-fns/format` → retorna `'2026-07-18'`
- `localStorage` mock
- `firebase/sync` mock (para que `saveData()` no intente cloud sync)

**Suites a migrar desde old-app:**

| Suite | Casos clave |
|-------|-------------|
| `getState` | Retorna objeto con `routines[]`, `currentRoutineId === 'module-1'`, `bpm === 120` |
| `saveData / loadData` | `saveData` guarda en localStorage con clave correcta; sincroniza `remainingSec` del ejercicio activo; `loadData` restaura estado; maneja localStorage vacío gracefulmente; normaliza campos legacy (`duration → durationSec`, defaults) |
| `getCurrentRoutine` | Retorna rutina por `currentRoutineId`; fallback a primera rutina si no encuentra; crea "Rutina Recuperada" si el array está vacío |
| `getExerciseById` | Encuentra por ID; retorna undefined para inexistente |
| `getVisibleExercises` | Filtra archivados; retorna solo no-archivados |
| `setBpm / adjustBpm` | Clamp min 1, max 300; ajuste con delta; sincroniza BPM del ejercicio activo |
| `recordProgressSeconds` | Acumula por día; acumula por llamadas múltiples; desglose por rutina |
| `addSession / getSessions` | Genera ID con nanoid; ordena newest first; filtra por `startDate, endDate, routineId` |
| `updateSession` | Actualiza campos; retorna false para ID desconocido |
| `deleteSession` | Elimina sesión; retorna false para ID desconocido |
| `resetRoutine` | Resetea todos los ejercicios (completed, remainingSec, currentRep); limpia activeExerciseId, exerciseRemaining, globalSeconds |
| `resetAllData` | Elimina localStorage, restaura 12 rutinas de muestra, valores por defecto |

### 8.2 `utils.test.ts`

**Ubicación:** `src/lib/state/utils.test.ts`

**Mocks:** `nanoid`, `date-fns/format`

**Suites:**
| Suite | Casos |
|-------|-------|
| `formatTime` | 0:00, segundos < 60, minutos exactos, minutos+segundos, valores grandes (>1000h), valores negativos (debe mostrar -1:-1) |
| `getFirstUrl` | Primera URL, http sin https, sin URL, URLs con query params |
| `getFirstImage` | Primera imagen, extensiones (jpg, jpeg, png, gif, webp, svg), sin imagen |
| `stringToColor` | Hex válido (#XXXXXX), determinista, diferentes colores para distintos inputs, string vacío, strings largos |
| `sanitizeImportedRoutine` | Mínimo con defaults; preserva valores; archived=true; autoStart=false; genera nanoid |
| `todayStr` | Retorna fecha mockeada YYYY-MM-DD |
| `deepClone` | Clona objeto plano, anidado, arrays, null, primitivos; undefined lanza error |
| `formatISOTime` | Formato h:mm a.m/p.m; medianoche 12:00 a.m; mediodía 12:00 p.m; null/undefined → '--:--'; inválido → '--:--' |

### 8.3 `worker.test.ts`

**Ubicación:** `src/lib/worker.test.ts`

**Mocks:** `self` global con `onmessage` y `postMessage`

**Suites:**
| Suite | Casos |
|-------|-------|
| Worker lifecycle | `'start'` comienza ticking cada 1s; tickea repetidamente; `'stop'` detiene; duplicado `'start'` no crea doble intervalo; puede restart después de stop |

**Migración:** El worker es idéntico — código JS plano compatible con Vite. No hay cambios de lógica.

### 8.4 `firebase-merge.test.ts`

**Ubicación:** `src/lib/firebase/merge.test.ts`

**Mocks:** `deepClone` de utils (implementación simple JSON)

**Suites (idéntico a old-app):**
| Suite | Casos |
|-------|-------|
| `mergeState` | cloud data cuando local es null; no change cuando cloud es null; no change cuando ambos null; cloud wins cuando local._syncedAt === 0; cloud wins cuando cloudTime > localTime; local wins cuando localTime > cloudTime; local wins cuando tiempos iguales; Firestore Timestamp con toMillis; deep clone del resultado |

### 8.5 `firebase-serializer.test.ts`

**Ubicación:** `src/lib/firebase/serializer.test.ts`

**Suites (idéntico a old-app):**
| Suite | Casos |
|-------|-------|
| `exportSyncState` | Extrae routines, stats, sessions, currentRoutineId; excluye flags transitorios (bpm, isExercisePlaying); maneja state vacío |
| `importSyncState` | Extrae datos de payload; defaults seguros para null/undefined; defaults para campos faltantes; datos parciales |

### 8.6 Tests de Componentes (NUEVOS en SvelteKit)

**Herramienta:** Vitest + `@testing-library/svelte` (browser mode)

**Suites a crear:**

| Componente | Casos a cubrir |
|------------|----------------|
| `BottomNav` | Renderiza 5 tabs; click cambia `activeTab`; tab activo tiene clase `active` |
| `ExerciseCard` | Renderiza título, tiempo, BPM; muestra badge de reps si `reps > 1`; muestra badge de stat si `statisticName`; muestra imagen si hay URL en comment; click en Start llama `toggleListExercise`; click en chevron abre Details |
| `TimerBar` | Muestra tiempo formateado correctamente; barra de progreso con ancho correcto |
| `CreateExerciseModal` | Botón Create crea ejercicio; valida título vacío; campos +/- modifican newExerciseForm |
| `StatInputModal` | Save llama onSave con valor parseado; Skip llama onSkip; valor vacío no llama save |
| `FinishModal` | Muestra resumen correcto; Accept llama onAccept; Cancelar cierra |
| `ResetModal` | Confirm llama onConfirm; Cancelar cierra |
| `DetailsView` | Carga datos del ejercicio en inputs; cambios en título/stat/BPM/reps/time persisten; Complete con statisticName abre StatInputModal; Duplicate clona y cierra; Archive archiva y cierra; Delete elimina y cierra |
| `HistoryView` | Navegación entre meses; muestra "Sin práctica" cuando no hay sesiones; botón Excel dispara export |

### 8.7 Notas de Migración de Tests

1. **Mocks de `localStorage`**: En old-app se mockea `globalThis.localStorage`. En SvelteKit + Vitest, usar `vi.stubGlobal('localStorage', mock)`. Mismo patrón.

2. **Mocks de `nanoid` y `date-fns`**: Mismo enfoque (`vi.mock(...)`). Asegurar que las rutas de import apunten a `$lib/state/...` en lugar de `../js/...`.

3. **Import de `worker.ts`**: El test de worker importa el archivo y captura `self.onmessage`. En SvelteKit, el worker debe testearse igual (archivo JS plano). La ruta cambia a `$lib/worker.ts`.

4. **Estado compartido entre tests**: old-app usaba `vi.resetModules()` + `beforeEach` reimport. En SvelteKit con `$state`, se necesita un mecanismo de reset de estado entre tests — exportar una función `__resetTestState()` o usar `vi.reloadModules()`.

5. **Tests de Firebase**: `merge` y `serializer` son funciones puras — no requieren cambios de lógica, solo actualizar rutas de import.

6. **Nuevos tests de componentes**: Usar `render(Component, { props })` de `@testing-library/svelte`. Mockear `getState()` cuando sea necesario.
