/**
 * TASK-PBR-003: Alert Adapters
 *
 * Pluggable delivery adapters for cross-platform alert dispatch.
 * Each adapter implements:
 *   send(alert) — deliver the alert
 *   isAvailable() — returns true if this platform can use this adapter
 */

// =============================================================================
// Console Adapter — always available, logs to developer console
// =============================================================================

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
      }
    },
  };
}

// =============================================================================
// Broadcast Adapter — Web BroadcastChannel API, cross-tab within same origin
// =============================================================================

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

      // Omit sensitive fields before broadcasting
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
// Requires user permission for non-persistent notifications.
// Falls back gracefully if permission denied or API unavailable.
// =============================================================================

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
// Adapter Set Factory — creates all adapters with defaults
// =============================================================================

/**
 * Creates all default adapters.
 * @param {object} config — { webhookUrl?, broadcastChannel?, notificationPermission? }
 * @returns {Array<{send, isAvailable, name}>}
 */
export function createDefaultAdapters(config = {}) {
  return [
    createConsoleAdapter(),
    createBroadcastAdapter({ channelName: config.broadcastChannel || 'fortify-alerts' }),
    createNotificationAdapter({ permission: config.notificationPermission || 'default' }),
    ...(config.webhookUrl ? [createWebhookAdapter({ url: config.webhookUrl })] : []),
  ].filter(Boolean);
}
