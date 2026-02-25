import { isNativeRuntime } from '../../platform/isNative';
import { WebKeyProvider } from './webProvider';
import { NativeKeyProvider } from './nativeProvider';

export function getKeyProvider() {
  return isNativeRuntime() ? NativeKeyProvider : WebKeyProvider;
}
