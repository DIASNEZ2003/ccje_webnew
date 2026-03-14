import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';
import AdminDash from './Admin/AdminDash';
import EduDash from './Educator/EduDash';

function App() {
  return (
    <Router>
      <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md flex flex-col items-center">
          
          <Routes>
            {/* The main login route */}
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<AdminDash />} />
            <Route path="/educator" element={<EduDash />} />
          </Routes>

        </div>
      </div>
    </Router>
  );
}

export default App;