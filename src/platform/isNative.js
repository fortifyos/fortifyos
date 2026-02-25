export function isNativeRuntime() {
  return !!(window?.Capacitor && window?.Capacitor?.isNativePlatform?.());
}
