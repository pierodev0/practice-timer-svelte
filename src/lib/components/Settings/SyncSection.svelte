<script lang="ts">
	import { loginGoogle, logoutGoogle } from '$lib/firebase/auth.js';
	import { syncNow, scheduleCloudSync } from '$lib/firebase/sync.js';
	import { modal } from '$lib/state/modal-store.svelte.js';

	let currentUser = $derived(modal.currentUser);
	let syncStatus = $derived(modal.syncStatus);
	let lastSyncTime = $derived(modal.lastSyncTime);

	async function handleLogin() {
		try {
			await loginGoogle();
		} catch (err) {
			console.error('Login failed:', err);
			alert('Error al iniciar sesión: ' + (err instanceof Error ? err.message : 'Desconocido'));
		}
	}

	async function handleSyncNow() {
		try {
			await syncNow();
		} catch (err) {
			console.error('Sync failed:', err);
			alert('Error al sincronizar: ' + (err instanceof Error ? err.message : 'Desconocido'));
		}
	}

	function handleAutoSync(e: Event) {
		const checked = (e.target as HTMLInputElement).checked;
		if (checked) {
			scheduleCloudSync();
		}
	}

	async function handleLogout() {
		try {
			await logoutGoogle();
		} catch (err) {
			console.error('Logout failed:', err);
		}
	}
</script>

<div class="card p-4" id="cloud-sync-card">
	<h3 class="text-xs uppercase text-gray-500 font-bold tracking-wider mb-3">
		<i class="fas fa-cloud mr-1"></i>Sincronización Cloud
	</h3>

	{#if !currentUser}
		<!-- Logged out -->
		<button
			type="button"
			id="sync-login-btn"
			class="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
			onclick={handleLogin}
		>
			<div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
				<i class="fab fa-google"></i>
			</div>
			<div>
				<p class="font-medium text-gray-800 text-sm">Iniciar sesión con Google</p>
				<p class="text-xs text-gray-400">Activa la sincronización en la nube</p>
			</div>
		</button>
	{:else}
		<!-- Logged in -->
		<div class="flex items-center gap-3 mb-3 p-3 rounded-lg bg-green-50">
			<div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 flex-shrink-0">
				<i class="fas fa-cloud"></i>
			</div>
			<div class="flex-1 min-w-0">
				<p class="font-medium text-gray-800 text-sm truncate" id="sync-user-email">{currentUser.email || '—'}</p>
				<p class="text-xs text-gray-400">Conectado</p>
			</div>
			<span
				id="sync-status-dot"
				class="w-2 h-2 rounded-full {syncStatus === 'synced'
					? 'bg-green-500'
					: syncStatus === 'syncing'
						? 'bg-yellow-500'
						: syncStatus === 'error'
							? 'bg-red-500'
							: 'bg-green-500'}"
			></span>
		</div>

		<div class="text-xs text-gray-400 mb-3">
			Última sincronización: <span id="sync-last-time">{lastSyncTime}</span>
		</div>

		<div class="space-y-2">
			<button
				type="button"
				id="sync-now-btn"
				class="w-full flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left"
				onclick={handleSyncNow}
			>
				<div class="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
					<i class="fas fa-sync-alt"></i>
				</div>
				<div>
					<p class="font-medium text-gray-800 text-sm">Sincronizar ahora</p>
					<p class="text-xs text-gray-400">Sube y descarga los últimos cambios</p>
				</div>
			</button>

			<label class="flex items-center gap-3 p-3 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
				<div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0">
					<input type="checkbox" id="sync-auto-toggle" class="w-4 h-4 accent-[#E53935]" onchange={handleAutoSync} />
				</div>
				<div>
					<p class="font-medium text-gray-800 text-sm">Sincronización automática</p>
					<p class="text-xs text-gray-400">Sube cambios automáticamente al guardar</p>
				</div>
			</label>

			<button
				type="button"
				id="sync-logout-btn"
				class="w-full flex items-center gap-3 p-3 rounded-lg bg-red-50 hover:bg-red-100 transition-colors text-left"
				onclick={handleLogout}
			>
				<div class="w-10 h-10 rounded-full bg-red-200 flex items-center justify-center text-red-700 flex-shrink-0">
					<i class="fas fa-sign-out-alt"></i>
				</div>
				<div>
					<p class="font-medium text-red-800 text-sm">Cerrar sesión</p>
					<p class="text-xs text-red-500">Desconectar sincronización cloud</p>
				</div>
			</button>
		</div>
	{/if}
</div>
