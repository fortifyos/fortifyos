import React, { useState, useCallback } from 'react';

/**
 * Route Guard PIN System for FORTIFY OS
 * PIN required for dashboard/settings, not for general browsing
 */

const PIN_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000;

// Hash function
async function hashPIN(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'fortify-salt-v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Hook for PIN management
export function usePINGuard() {
  const [isVerified, setIsVerified] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutEnd, setLockoutEnd] = useState(null);
  const [error, setError] = useState('');

  const isSetup = !!localStorage.getItem('fortify_pin_hash');

  const setupPIN = async (pin) => {
    if (pin.length !== PIN_LENGTH || !/^\d+$/.test(pin)) {
      return { success: false, error: 'PIN must be 6 digits' };
    }
    
    const hash = await hashPIN(pin);
    localStorage.setItem('fortify_pin_hash', hash);
    setIsVerified(true);
    return { success: true };
  };

  const verifyPIN = async (pin) => {
    setError('');
    
    // Check lockout
    if (lockoutEnd && Date.now() < lockoutEnd) {
      const remaining = Math.ceil((lockoutEnd - Date.now()) / 1000);
      setError(`Locked out. Try again in ${Math.ceil(remaining / 60)} minutes`);
      return { success: false, error: `Locked out. Try again in ${Math.ceil(remaining / 60)} minutes` };
    }

    if (pin.length !== PIN_LENGTH) {
      setError('Enter 6-digit PIN');
      return { success: false, error: 'Enter 6-digit PIN' };
    }

    const storedHash = localStorage.getItem('fortify_pin_hash');
    const inputHash = await hashPIN(pin);

    if (inputHash === storedHash) {
      setIsVerified(true);
      setAttempts(0);
      setLockoutEnd(null);
      return { success: true };
    }

    // Wrong PIN
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (newAttempts >= MAX_ATTEMPTS) {
      setLockoutEnd(Date.now() + LOCKOUT_DURATION);
      setAttempts(0);
      const errorMsg = 'Too many attempts. Locked for 5 minutes.';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    const errorMsg = `Wrong PIN. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`;
    setError(errorMsg);
    return { success: false, error: errorMsg };
  };

  const requirePIN = useCallback(() => {
    // Check if already verified this session
    if (isVerified) return true;
    
    // Check if PIN is set
    if (!isSetup) {
      // No PIN set, allow access (first time setup)
      return true;
    }
    
    // Require PIN
    return false;
  }, [isVerified, isSetup]);

  const clearVerification = useCallback(() => {
    setIsVerified(false);
  }, []);

  const resetPIN = () => {
    localStorage.removeItem('fortify_pin_hash');
    setIsVerified(false);
    setAttempts(0);
    setLockoutEnd(null);
  };

  return {
    isSetup,
    isVerified,
    error,
    attempts,
    setupPIN,
    verifyPIN,
    requirePIN,
    clearVerification,
    resetPIN
  };
}

// PIN Input Component (same as before but simplified)
export function PINInput({ length = 6, onComplete, disabled = false }) {
  const [pin, setPin] = useState('');
  const inputRef = React.useRef(null);

  const handleChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, length);
    setPin(value);
    
    if (value.length === length) {
      onComplete?.(value);
    }
  };

  return React.createElement('input', {
    ref: inputRef,
    type: 'password',
    inputMode: 'numeric',
    maxLength: length,
    value: pin,
    disabled,
    onChange: handleChange,
    placeholder: '●●●●●●',
    autoFocus: true,
    style: {
      width: '200px',
      height: '56px',
      fontSize: '24px',
      textAlign: 'center',
      letterSpacing: '8px',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      background: 'var(--bg3)',
      color: 'var(--text)',
      fontFamily: 'DM Mono, monospace'
    }
  });
}

// Guard Modal - appears when accessing protected routes
export function PINGuardModal({ isOpen, onVerify, onCancel, error, isSetup }) {
  if (!isOpen) return null;

  const [pin, setPin] = useState('');
  const [localError, setLocalError] = useState('');

  const handleVerify = async () => {
    setLocalError('');
    const result = await onVerify(pin);
    if (!result.success) {
      setLocalError(result.error);
      setPin('');
    }
  };

  const handleSetup = async () => {
    setLocalError('');
    const result = await onVerify(pin);
    if (!result.success) {
      setLocalError(result.error);
    }
  };

  return React.createElement('div', {
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    onClick: (e) => {
      if (e.target === e.currentTarget) onCancel?.();
    }
  }, [
    React.createElement('div', {
      key: 'modal',
      style: {
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '40px',
        minWidth: '320px',
        textAlign: 'center'
      }
    }, [
      // Title
      React.createElement('h2', {
        key: 'title',
        style: {
          fontFamily: 'Instrument Serif, serif',
          fontSize: '24px',
          marginBottom: '8px'
        }
      }, isSetup ? 'Enter PIN' : 'Create PIN'),
      
      // Subtitle
      React.createElement('p', {
        key: 'subtitle',
        style: {
          color: 'var(--text2)',
          fontSize: '14px',
          marginBottom: '24px'
        }
      }, isSetup 
        ? 'Enter your 6-digit PIN to access dashboard' 
        : 'Create a 6-digit PIN to protect dashboard'
      ),

      // PIN Input
      React.createElement(PINInput, {
        key: 'input',
        length: PIN_LENGTH,
        onComplete: isSetup ? handleVerify : handleSetup,
        disabled: false
      }),

      // Error
      (localError || error) && React.createElement('div', {
        key: 'error',
        style: {
          color: 'var(--danger)',
          fontSize: '13px',
          marginTop: '16px'
        }
      }, localError || error),

      // Cancel button
      React.createElement('button', {
        key: 'cancel',
        onClick: onCancel,
        style: {
          marginTop: '24px',
          padding: '10px 20px',
          background: 'transparent',
          color: 'var(--text3)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          fontSize: '13px',
          cursor: 'pointer',
          marginRight: '12px'
        }
      }, 'Cancel')
    ])
  ]);
}

// Protected Route Wrapper
export function ProtectedRoute({ children, requirePIN, isVerified, onVerify, error, isSetup }) {
  const [showGuard, setShowGuard] = useState(false);

  React.useEffect(() => {
    if (requirePIN && !isVerified) {
      setShowGuard(true);
    }
  }, [requirePIN, isVerified]);

  const handleVerify = async (pin) => {
    const result = await onVerify(pin);
    if (result.success) {
      setShowGuard(false);
    }
    return result;
  };

  const handleCancel = () => {
    setShowGuard(false);
    // Navigate away or show "access denied"
    window.history.back();
  };

  if (showGuard) {
    return React.createElement(PINGuardModal, {
      isOpen: true,
      onVerify: handleVerify,
      onCancel: handleCancel,
      error,
      isSetup
    });
  }

  return children;
}

export default { usePINGuard, PINInput, PINGuardModal, ProtectedRoute };
