/**
 * Synthesized "cash register" / cha-ching chime.
 * Generated on demand via Web Audio API — no audio file needed and avoids any
 * licensing issues. Plays a short two-note bell sequence (~500 ms total).
 *
 * Browser autoplay policy: the AudioContext is created lazily on the first
 * call so that the very first invocation happens inside a user gesture
 * (e.g. clicking "Save" in AddPaymentModal). Subsequent invocations resume
 * the existing context.
 *
 * Usage:
 *   import { playCashRegisterChime } from "@/lib/sound/cashRegister";
 *   await playCashRegisterChime();          // default volume 0.6
 *   await playCashRegisterChime({ volume: 0.3 });
 */

type ChimeOptions = {
  /** 0..1, default 0.6 */
  volume?: number;
};

let ctx: AudioContext | null = null;
let unlockPromise: Promise<void> | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

function ensureRunning(c: AudioContext): Promise<void> {
  if (c.state !== "suspended") return Promise.resolve();
  if (!unlockPromise) {
    unlockPromise = c
      .resume()
      .catch(() => undefined)
      .finally(() => {
        unlockPromise = null;
      });
  }
  return unlockPromise;
}

function playBell(
  c: AudioContext,
  startAt: number,
  freq: number,
  duration: number,
  gain: number
) {
  // Two stacked sines (fundamental + 2x partial) with a fast attack and
  // exponential decay → bell-ish "ting" suitable for a cash register.
  const env = c.createGain();
  env.gain.setValueAtTime(0, startAt);
  env.gain.linearRampToValueAtTime(gain, startAt + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  env.connect(c.destination);

  const oscA = c.createOscillator();
  oscA.type = "triangle";
  oscA.frequency.value = freq;
  oscA.connect(env);
  oscA.start(startAt);
  oscA.stop(startAt + duration);

  const partial = c.createGain();
  partial.gain.value = 0.35;
  partial.connect(env);

  const oscB = c.createOscillator();
  oscB.type = "sine";
  oscB.frequency.value = freq * 2;
  oscB.connect(partial);
  oscB.start(startAt);
  oscB.stop(startAt + duration);
}

/** localStorage key shared with the Profile mute toggle (Step 4). */
export const PAYMENT_SOUND_LS_KEY = "payment_sound_enabled";

/** Returns the user's mute preference. Default: enabled. */
export function isPaymentSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(PAYMENT_SOUND_LS_KEY);
    if (raw === null) return true;
    return raw === "true" || raw === "1";
  } catch {
    return true;
  }
}

export function setPaymentSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PAYMENT_SOUND_LS_KEY, enabled ? "true" : "false");
  } catch {
    // ignore quota / privacy mode failures
  }
}

/**
 * Track when this browser tab last triggered a local chime (e.g. on Save in
 * AddPaymentModal). Used by TopBar to suppress the polling-driven duplicate
 * chime that would otherwise fire ~60 s later for the same payment.
 */
const LAST_LOCAL_CHIME_KEY = "payment_sound_last_local_chime_at";

function markLocalChime(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_LOCAL_CHIME_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function wasLocalPaymentChimeRecent(maxAgeMs: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(LAST_LOCAL_CHIME_KEY);
    if (!raw) return false;
    const t = Number(raw);
    if (!Number.isFinite(t)) return false;
    return Date.now() - t < maxAgeMs;
  } catch {
    return false;
  }
}

export async function playCashRegisterChime(opts: ChimeOptions = {}): Promise<void> {
  if (!isPaymentSoundEnabled()) return;
  const c = getContext();
  if (!c) return;
  await ensureRunning(c);
  const volume = Math.max(0, Math.min(1, opts.volume ?? 0.6));
  if (volume === 0) return;
  markLocalChime();

  const now = c.currentTime;
  // Two ascending bell strikes ~150 ms apart — classic "cha-ching".
  playBell(c, now, 1320, 0.35, volume); // E6
  playBell(c, now + 0.12, 1760, 0.55, volume); // A6
}
