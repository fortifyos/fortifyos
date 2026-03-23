import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { usePINGuard, PINGuardModal } from './security/PINGuard';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import About from './pages/About';
import Menu from './components/Menu';
import './App.css';

// Protected Route Component - PIN required for dashboard/settings
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

function App() {
  const { isVerified } = usePINGuard();

  return (
    <div className="app">
      <Routes>
        {/* Public routes - no PIN required */}
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        
        {/* Protected routes - PIN required for dashboard and settings */}
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
        
        {/* Redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      <Menu isVerified={isVerified} />
    </div>
  );
}

export default App;
