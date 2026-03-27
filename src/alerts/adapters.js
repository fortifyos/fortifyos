/**
 * TASK-FOS-003: JSDoc Documentation — Cross-Platform Alert System
 *
 * Documented exports:
 * - createConsoleAdapter, createBroadcastAdapter, createNotificationAdapter,
 *   createWebhookAdapter, createDefaultAdapters
 */

// =============================================================================
// Console Adapter — always available, logs to developer console
// =============================================================================

/**
 * Creates a ConsoleAdapter — the fallback alert adapter.
 * Always available in any JS environment with a console.
 *
 * @param {{ logLevel?: string }} [options]
 * @param {string} [options.logLevel='info'] - Minimum log level ('debug'|'info'|'warn'|'error')
 * @returns {{ name: string, isAvailable: function(): boolean, send: function(object): Promise<void> }}
 */
export function createConsoleAdapter({ logLevel = 'info' } = {}) {
  const levels = ['debug', 'info', 'warn', 'error'];
  const effective = levels.includes(logLevel) ? logLevel : 'info';

  return {
    name: 'ConsoleAdapter',

    isAvailable() {
      return typeof console !== 'undefined';
    },

    async send(alert) {
      const prefix = `[${alert.level}] ${alert.title}`;
      const msg = `${prefix}${alert.body ? ' — ' + alert.body : ''} [${alert.source}]`;

      switch (alert.level) {
        case 'CRITICAL':
        case 'WARN':
          console.warn(msg);
          break;
        case 'INFO':
        default:
          console.info(msg);
          break;
      }
    },
  };
}

// =============================================================================
// Broadcast Adapter — Web BroadcastChannel API, cross-tab within same origin
// =============================================================================

/**
 * Creates a BroadcastAdapter — delivers alerts via BroadcastChannel API.
 * Allows other tabs/windows of the same origin to receive alerts.
 * Requires browsers that support the BroadcastChannel API (not available in all workers).
 *
 * @param {{ channelName?: string, enabled?: boolean }} [options]
 * @param {string} [options.channelName='fortify-alerts'] - BroadcastChannel name
 * @param {boolean} [options.enabled=true] - Set false to disable
 * @returns {{ name: string, isAvailable: function(): boolean, send: function(object): Promise<void> }}
 */
export function createBroadcastAdapter({ channelName = 'fortify-alerts', enabled = true } = {}) {
  let bc = null;
  let available = null; // cached isAvailable result

  function getChannel() {
    if (!enabled) return null;
    if (bc) return bc;
    try {
      bc = new BroadcastChannel(channelName);
    } catch {
      bc = null;
    }
    return bc;
  }

  return {
    name: 'BroadcastAdapter',

    isAvailable() {
      if (!enabled) return false;
      if (available !== null) return available;
      try {
        const ch = new BroadcastChannel('__test__');
        ch.close();
        available = true;
      } catch {
        available = false;
      }
      return available;
    },

    async send(alert) {
      const ch = getChannel();
      if (!ch) throw new Error('BroadcastChannel not available');

      // Only public alert fields are broadcast — no sensitive data
      const payload = {
        id: alert.id,
        title: alert.title,
        body: alert.body,
        level: alert.level,
        tags: alert.tags,
        source: alert.source,
        timestamp: alert.timestamp,
      };

      ch.postMessage(payload);
    },
  };
}

// =============================================================================
// Notification Adapter — Web Notifications API
// =============================================================================

/**
 * Creates a NotificationAdapter — delivers native OS notifications via the Web Notifications API.
 * Requires user permission to be granted separately from the app.
 * If permission is 'default' (not yet asked), isAvailable returns false and send throws.
 * CRITICAL alerts remain open until dismissed; INFO/WARN auto-close after 8 seconds.
 *
 * @param {{ permission?: string }} [options]
 * @param {string} [options.permission='default'] - 'default'|'granted'|'denied'
 * @returns {{ name: string, isAvailable: function(): boolean, send: function(object): Promise<void> }}
 */
export function createNotificationAdapter({ permission = 'default' } = {}) {
  return {
    name: 'NotificationAdapter',

    isAvailable() {
      return (
        typeof Notification !== 'undefined' &&
        Notification.permission !== 'denied'
      );
    },

    async send(alert) {
      if (Notification.permission !== 'granted') {
        throw new Error(`Notification permission not granted (current: ${Notification.permission})`);
      }

      const icon = alert.level === 'CRITICAL'
        ? 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><text y="12" font-size="12">🚨</text></svg>'
        : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><text y="12" font-size="12">ℹ️</text></svg>';

      try {
        const n = new Notification(alert.title, {
          body: alert.body,
          icon,
          tag: alert.tags[0] || alert.id,
          requireInteraction: alert.level === 'CRITICAL',
        });
        // Auto-close after 8 seconds unless CRITICAL
        if (alert.level !== 'CRITICAL') {
          setTimeout(() => n.close(), 8_000);
        }
      } catch (err) {
        throw new Error(`Notification failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

// =============================================================================
// Webhook Adapter — HTTP POST to a configurable endpoint
// =============================================================================

/**
 * Creates a WebhookAdapter — POSTs JSON alert payload to a configurable HTTP endpoint.
 * Fails fast on network errors (5 second timeout by default).
 * The webhook URL must be a valid, parseable URL.
 *
 * @param {{ url?: string, headers?: object.<string,string>, timeoutMs?: number }} [options]
 * @param {string} [options.url] - Full HTTPS (or HTTP) URL to POST alerts to
 * @param {object.<string,string>} [options.headers={}] - Additional HTTP headers (e.g. Authorization)
 * @param {number} [options.timeoutMs=5000] - Request timeout in milliseconds
 * @returns {{ name: string, isAvailable: function(): boolean, send: function(object): Promise<void> }}
 */
export function createWebhookAdapter({ url, headers = {}, timeoutMs = 5_000 } = {}) {
  return {
    name: 'WebhookAdapter',

    isAvailable() {
      return typeof url === 'string' && url.length > 0 && URL.canParse(url);
    },

    async send(alert) {
      if (!url) throw new Error('Webhook URL not configured');

      const payload = {
        alert: {
          id: alert.id,
          title: alert.title,
          body: alert.body,
          level: alert.level,
          tags: alert.tags,
          source: alert.source,
          timestamp: alert.timestamp,
        },
      };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'FortifyOS-Alerts/1.0',
            ...headers,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Webhook returned ${res.status} ${res.statusText}`);
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          throw new Error(`Webhook timed out after ${timeoutMs}ms`);
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

// =============================================================================
// Adapter Set Factory
// =============================================================================

/**
 * Creates all default adapters with sensible defaults.
 * ConsoleAdapter is always present as fallback.
 * WebhookAdapter is only included if webhookUrl is provided.
 *
 * @param {{ webhookUrl?: string, broadcastChannel?: string, notificationPermission?: string }} [config]
 * @param {string} [config.webhookUrl] - If provided, a WebhookAdapter is added
 * @param {string} [config.broadcastChannel='fortify-alerts'] - BroadcastChannel name
 * @param {string} [config.notificationPermission='default'] - Notification permission state
 * @returns {Array<{send: function, isAvailable: function, name: string}>}
 */
export function createDefaultAdapters(config = {}) {
  return [
    createConsoleAdapter(),
    createBroadcastAdapter({ channelName: config.broadcastChannel || 'fortify-alerts' }),
    createNotificationAdapter({ permission: config.notificationPermission || 'default' }),
    ...(config.webhookUrl ? [createWebhookAdapter({ url: config.webhookUrl })] : []),
  ].filter(Boolean);
}
