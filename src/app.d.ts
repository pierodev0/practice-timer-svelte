// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Sortable.js CDN
	const Sortable: {
		new (element: HTMLElement, options: SortableOptions): SortableInstance;
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
	const Chart: new (ctx: CanvasRenderingContext2D, config: any) => any;
}

export {};
