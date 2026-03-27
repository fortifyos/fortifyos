export type SecureLogSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export type SecureLogFn = (
  eventType: string,
  message: string,
  stage: string,
  severity: SecureLogSeverity,
  context: Record<string, unknown>
) => Promise<void>;

export function setSecureLog(fn: SecureLogFn | null): void;
export function secureLogRef(): SecureLogFn;
