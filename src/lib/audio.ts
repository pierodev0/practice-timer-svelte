/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Audio module — Tone.js metronome and bell completion sound.
 *
 * Tone.js is loaded dynamically (not included in app.html).
 * Usage:
 *   import { initAudio, startMetronome, stopMetronome, playBellSound } from '$lib/audio.js';
 */

import { loadScript } from '$lib/load-script.js';

const TONE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js';

/**
 * Get Tone from the global scope (CDN-loaded).
 */
function getTone(): any {
	return (globalThis as any).Tone;
}

let metroSynth: any = null;
let bellSynth: any = null;
let beat = 0;
let _initialized = false;
let _isAudioOn = false;

/**
 * Initialize Tone.js and create synthesizers.
 * Safe to call multiple times (only creates once).
 * Loads Tone.js dynamically if not already loaded.
 */
export async function initAudio(): Promise<void> {
	if (_initialized) return;

	// Lazy-load Tone.js from CDN
	await loadScript(TONE_CDN);

	const Tone = getTone();
	if (!Tone) return;
	await Tone.start();

	metroSynth = new Tone.Synth({
		oscillator: { type: 'sine' },
		envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.1 }
	}).toDestination();

	bellSynth = new Tone.PolySynth(Tone.Synth, {
		oscillator: { type: 'sine' },
		envelope: { attack: 0.01, decay: 1, sustain: 0, release: 1 }
	}).toDestination();

	// Schedule the metronome pattern
	Tone.Transport.scheduleRepeat((time: any) => {
		if (_isAudioOn && metroSynth) {
			const freq = beat === 0 ? 'C6' : 'G5';
			metroSynth.triggerAttackRelease(freq, '32n', time);
		}
		beat = (beat + 1) % 4;
	}, '4n');

	_initialized = true;
}

/**
 * Set the internal audio-on flag (no circular import needed).
 */
export function setAudioOn(val: boolean): void {
	_isAudioOn = val;
}

/**
 * Play the bell completion sound (C5, E5, G5 chord).
 */
export function playBellSound(): void {
	if (!bellSynth) return;
	bellSynth.set({
		oscillator: { type: 'sine' },
		envelope: { attack: 0.05, decay: 0.6, sustain: 0.1, release: 0.8 },
		volume: -5
	});
	bellSynth.triggerAttackRelease(['C5', 'E5', 'G5'], '2n');
}

/**
 * Start the metronome audio (Transport).
 * @param bpm - beats per minute
 */
export function startMetronome(bpm: number): void {
	const Tone = getTone();
	if (!Tone) return;
	beat = 0;
	Tone.Transport.bpm.value = bpm;
	if (Tone.Transport.state !== 'started') {
		Tone.Transport.start();
	}
}

/**
 * Stop the metronome audio.
 */
export function stopMetronome(): void {
	const Tone = getTone();
	if (!Tone) return;
	Tone.Transport.stop();
	beat = 0;
}

/**
 * Update the BPM on the Transport without restarting.
 */
export function setMetronomeBpm(bpm: number): void {
	const Tone = getTone();
	if (!Tone) return;
	Tone.Transport.bpm.value = bpm;
}
