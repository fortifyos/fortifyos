import { isNativeRuntime } from './isNative';

/**
 * Native biometric prompt (FaceID/TouchID/Fingerprint) for Capacitor builds.
 *
 * Uses @capgo/capacitor-native-biometric (pinned >= 8.3.6).
 * Web/PWA: returns false (no prompt).
 */
export async function verifyBiometric({ reason = 'Unlock Sovereign Vault' } = {}) {
  if (!isNativeRuntime()) return { supported: false, ok: false };

  try {
    // Dynamic import keeps web bundle clean.
    const mod = await import('@capgo/capacitor-native-biometric');
    const NativeBiometric = mod.NativeBiometric;

    const availability = await NativeBiometric.isAvailable();
    if (!availability?.isAvailable) {
      return { supported: false, ok: false, reason: 'NOT_AVAILABLE' };
    }

    await NativeBiometric.verifyIdentity({ reason, title: 'Authentication Required' });
    return { supported: true, ok: true };
  } catch (e) {
    return { supported: true, ok: false, reason: e?.message || String(e) };
  }
}
