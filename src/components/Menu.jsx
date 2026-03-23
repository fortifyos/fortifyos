import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { usePINGuard, PINGuardModal } from '../security/PINGuard';
import './Menu.css';

// Menu with PIN protection for sensitive routes
function Menu({ isVerified }) {
  const { verifyPIN, error, isSetup, clearVerification } = usePINGuard();
  const navigate = useNavigate();
  const [showPin, setShowPin] = useState(false);
  const [pendingPath, setPendingPath] = useState(null);

  // Paths that require PIN
  const PROTECTED_PATHS = ['/dashboard', '/settings'];

  const handleNavigation = (path) => {
    // If path is protected and not verified, show PIN modal
    if (PROTECTED_PATHS.includes(path) && !isVerified) {
      setPendingPath(path);
      setShowPin(true);
      return;
    }
    
    // Otherwise navigate normally
    navigate(path);
  };

  const handleVerify = async (pin) => {
    const result = await verifyPIN(pin);
    if (result.success) {
      setShowPin(false);
      if (pendingPath) {
        navigate(pendingPath);
        setPendingPath(null);
      }
    }
    return result;
  };

  const handleCancel = () => {
    setShowPin(false);
    setPendingPath(null);
  };

  const handleLock = () => {
    clearVerification();
    navigate('/');
  };

  return (
    <>
      <nav className="menu">
        <div className="menu-brand">
          <NavLink to="/" className="menu-logo">
            FORTIFY
          </NavLink>
        </div>
        
        <div className="menu-links">
          <button 
            className="menu-link" 
            onClick={() => handleNavigation('/')}
          >
            Home
          </button>
          
          <button 
            className="menu-link protected"
            onClick={() => handleNavigation('/dashboard')}
          >
            Dashboard {isVerified ? '' : '🔒'}
          </button>
          
          <button 
            className="menu-link protected"
            onClick={() => handleNavigation('/settings')}
          >
            Settings {isVerified ? '' : '🔒'}
          </button>
          
          <button 
            className="menu-link" 
            onClick={() => handleNavigation('/about')}
          >
            About
          </button>
        </div>
        
        <div className="menu-actions">
          {isVerified ? (
            <button className="menu-action lock" onClick={handleLock}>
              🔒 Lock
            </button>
          ) : (
            <span className="menu-status">🔓 Unlocked</span>
          )}
        </div>
      </nav>
      
      {/* PIN Guard Modal */}
      <PINGuardModal
        isOpen={showPin}
        onVerify={handleVerify}
        onCancel={handleCancel}
        error={error}
        isSetup={isSetup}
      />
    </>
  );
}

export default Menu;
