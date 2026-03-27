/**
 * TASK-PBR-003: Cross-Platform Alert System
 *
 * Alert abstraction layer — separates alert producer from delivery adapters.
 * Supports graceful degradation when platform capabilities are unavailable.
 * Prevents duplicate alert emission via cooldown tracking.
 */

// =============================================================================
// Types
// =============================================================================

export const AlertLevel = Object.freeze({
  INFO: 'INFO',
  WARN: 'WARN',
  CRITICAL: 'CRITICAL',
});

export const AlertChannel = Object.freeze({
  CONSOLE: 'console',
  BROADCAST: 'broadcast',
  NOTIFICATION: 'notification',
  WEBHOOK: 'webhook',
});

export const DeliveryStatus = Object.freeze({
  SENT: 'SENT',
  DROPPED: 'DROPPED',
  ADAPTER_UNAVAILABLE: 'ADAPTER_UNAVAILABLE',
  REJECTED: 'REJECTED',
});

// =============================================================================
// Alert Structure
// =============================================================================

export function createAlert({ title, body, level = AlertLevel.INFO, tags = [], source = 'app' }) {
  if (!title) throw new Error('Alert title is required');
  return Object.freeze({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: String(title).slice(0, 256),
    body: body !== undefined ? String(body).slice(0, 1024) : '',
    level,
    tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
    source,
    timestamp: new Date().toISOString(),
  });
}

// =============================================================================
// Alert Emitter — deduplication via cooldown map
// =============================================================================

export class AlertEmitter {
  constructor() {
    /** @type {Map<string, number>} tag → last emit timestamp */
    this._cooldowns = new Map();
    /** Default cooldown window: 60 seconds */
    this._defaultCooldownMs = 60_000;
  }

  /**
   * Set cooldown for a specific tag.
   * @param {string} tag
   * @param {number} cooldownMs  0 = no dedup
   */
  setCooldown(tag, cooldownMs) {
    this._cooldowns.set(tag, cooldownMs);
  }

  /**
   * Check if an alert with this tag would be deduplicated.
   * @param {string} tag
   * @returns {boolean}
   */
  isInCooldown(tag) {
    if (!tag) return false;
    const cooldown = this._cooldowns.get(tag) ?? this._defaultCooldownMs;
    if (cooldown === 0) return false;
    const last = this._lastEmit.get(tag);
    return last !== undefined && (Date.now() - last) < cooldown;
  }

  /** @type {Map<string, number>} tag → last emit timestamp */
  _lastEmit = new Map();

  /**
   * Emit an alert if not in cooldown.
   * Returns the alert or null if deduplicated.
   * @param {object} alertData
   * @returns {object|null}
   */
  _emit(alertData) {
    const alert = createAlert(alertData);
    const tags = alert.tags;

    if (tags.length > 0) {
      const primaryTag = tags[0];
      if (this.isInCooldown(primaryTag)) return null;
      this._lastEmit.set(primaryTag, Date.now());
    }

    return alert;
  }

  /**
   * Public emit — wraps _emit for external callers.
   * @param {object} alertData
   * @returns {object|null}
   */
  emit(alertData) {
    return this._emit(alertData);
  }

  clearCooldowns() {
    this._lastEmit.clear();
  }
}

// =============================================================================
// Dispatcher — routes to first available adapter
// =============================================================================

export class AlertDispatcher {
  constructor(adapters = []) {
    /** @type {Array<{send: Function, isAvailable: Function, name: string}>} */
    this._adapters = adapters;
    /** Composed emitter for deduplication */
    this._emitter = new AlertEmitter();
  }

  addAdapter(adapter) {
    this._adapters.push(adapter);
  }

  /**
   * Set cooldown for a tag across the dispatcher.
   * @param {string} tag
   * @param {number} cooldownMs
   */
  setCooldown(tag, cooldownMs) {
    this._emitter.setCooldown(tag, cooldownMs);
  }

  /**
   * Returns the first available adapter, or null if none available.
   * @returns {object|null}
   */
  getAvailableAdapter() {
    for (const adapter of this._adapters) {
      try {
        if (adapter.isAvailable?.() !== false) {
          return adapter;
        }
      } catch {
        // isAvailable threw — treat as unavailable
      }
    }
    return null;
  }

  /**
   * Dispatch an alert to the first available adapter.
   * Returns { status, adapter, error }.
   * @param {object} alert
   * @returns {Promise<{status: string, adapter?: object, error?: string}>}
   */
  async dispatch(alert) {
    const adapter = this.getAvailableAdapter();

    if (!adapter) {
      return { status: DeliveryStatus.ADAPTER_UNAVAILABLE };
    }

    try {
      await adapter.send(alert);
      return { status: DeliveryStatus.SENT, adapter: adapter.name };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: DeliveryStatus.REJECTED, adapter: adapter.name, error: message };
    }
  }

  /**
   * Full dispatch pipeline: emit (with dedup) → dispatch.
   * @param {object} alertData
   * @returns {Promise<{alert?: object, status: string, adapter?: object, error?: string}>}
   */
  async emit(alertData) {
    const alert = this._emitter.emit(alertData);
    if (!alert) {
      return { status: DeliveryStatus.DROPPED };
    }
    const result = await this.dispatch(alert);
    return { alert, ...result };
  }
}
