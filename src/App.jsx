import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { usePINGuard, PINGuardModal } from './security/PINGuard';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import About from './pages/About';
import Menu from './components/Menu';
import './App.css';

// Protected Route Component
function ProtectedRoute({ children }) {
  const { isVerified, requirePIN, verifyPIN, error, isSetup } = usePINGuard();
  const [showPin, setShowPin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (requirePIN()) {
      setShowPin(true);
    }
  }, []);

  const handleVerify = async (pin) => {
    const result = await verifyPIN(pin);
    if (result.success) {
      setShowPin(false);
    }
    return result;
  };

  const handleCancel = () => {
    setShowPin(false);
    navigate('/'); // Go back to home
  };

  if (showPin) {
    return (
      <PINGuardModal
        isOpen={true}
        onVerify={handleVerify}
        onCancel={handleCancel}
        error={error}
        isSetup={isSetup}
      />
    );
  }

  return children;
}

// App with PIN protection
function App() {
  const { isVerified, clearVerification } = usePINGuard();
  const location = useLocation();

  // Clear verification when app is closed (optional - for stricter security)
  // useEffect(() => {
  //   const handleBeforeUnload = () => clearVerification();
  //   window.addEventListener('beforeunload', handleBeforeUnload);
  //   return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  // }, [clearVerification]);

  return (
    <div className="app">
      <Routes>
        {/* Public routes - no PIN */}
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        
        {/* Protected routes - PIN required */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        <Route path="/settings" element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } />
        
        {/* Redirect unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      <Menu isVerified={isVerified} />
    </div>
  );
}

export default App;
