/**
 * Cash-register chime played on incoming payments.
 * Plays /sounds/cash-register.mp3 via a singleton HTMLAudioElement so concurrent
 * triggers don't pile up; volume is capped and rapid re-plays are throttled.
 *
 * Browser autoplay policy: the element is created lazily on the first call so
 * that the very first invocation happens inside a user gesture (e.g. clicking
 * "Save" in AddPaymentModal). Subsequent invocations reuse the same element.
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

const SOUND_SRC = "/sounds/cash-register.mp3";
/** Don't restart the clip more than once per this many ms. */
const REPLAY_THROTTLE_MS = 400;

let audioEl: HTMLAudioElement | null = null;
let lastPlayAt = 0;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (audioEl) return audioEl;
  try {
    audioEl = new Audio(SOUND_SRC);
    audioEl.preload = "auto";
  } catch {
    audioEl = null;
  }
  return audioEl;
}

/** localStorage key shared with the Profile mute toggle. */
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
  const a = getAudio();
  if (!a) return;

  const now = Date.now();
  if (now - lastPlayAt < REPLAY_THROTTLE_MS) return;
  lastPlayAt = now;

  const volume = Math.max(0, Math.min(1, opts.volume ?? 0.6));
  if (volume === 0) return;

  try {
    a.volume = volume;
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof (p as Promise<void>).then === "function") {
      await (p as Promise<void>).catch(() => {
        // Autoplay can reject if invoked outside a user gesture — silent.
      });
    }
    markLocalChime();
  } catch {
    // ignore — sound is non-critical
  }
}
