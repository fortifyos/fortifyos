let _secureLog = null;

export function setSecureLog(fn) {
  _secureLog = fn;
}

export function secureLogRef() {
  if (!_secureLog) throw new Error('secureLog not initialized');
  return _secureLog;
}
