/**
 * Dynamically load a script from a URL and resolve when loaded.
 * Used to lazy-load CDN scripts that aren't needed on every page.
 */
export function loadScript(url: string): Promise<void> {
	return new Promise((resolve, reject) => {
		// Check if already loaded
		const existing = document.querySelector(`script[src="${url}"]`);
		if (existing) {
			resolve();
			return;
		}

		const script = document.createElement('script');
		script.src = url;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error(`Failed to load script: ${url}`));
		document.head.appendChild(script);
	});
}
