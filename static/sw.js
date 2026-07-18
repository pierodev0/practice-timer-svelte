const CACHE_NAME = 'music-routine-v3-offline';

// Assets that exist in the build output
const STATIC_ASSETS = [
	'/',
	'/manifest.json',
	'/icon-192.png',
	'/icon-512.png'
];

// 1. Install: cache static assets
self.addEventListener('install', (e) => {
	e.waitUntil(
		caches.open(CACHE_NAME)
			.then((cache) => {
				console.log('[SW] Caching static assets');
				return cache.addAll(STATIC_ASSETS);
			})
			.then(() => self.skipWaiting())
	);
});

// 2. Activate: take control + clean old caches
self.addEventListener('activate', (e) => {
	e.waitUntil(
		Promise.all([
			clients.claim(),
			caches.keys().then((keyList) =>
				Promise.all(
					keyList
						.filter((key) => key !== CACHE_NAME)
						.map((key) => caches.delete(key))
				)
			)
		])
	);
});

// 3. Fetch: network-first, fallback to cache
self.addEventListener('fetch', (e) => {
	if (!e.request.url.startsWith('http')) return;
	if (e.request.method !== 'GET') return;

	e.respondWith(
		fetch(e.request)
			.then((response) => {
				if (response.ok) {
					const clone = response.clone();
					caches.open(CACHE_NAME).then((cache) => {
						const contentType = response.headers.get('content-type') || '';
						if (!contentType.includes('text/event-stream')) {
							cache.put(e.request, clone);
						}
					});
				}
				return response;
			})
			.catch(() => {
				return caches.match(e.request).then((cached) => {
					if (cached) return cached;
					if (e.request.mode === 'navigate') {
						return caches.match('/');
					}
					return new Response('', { status: 200, statusText: 'OK' });
				});
			})
	);
});
