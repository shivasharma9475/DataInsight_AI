import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";

import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Signup from "./pages/Signup.jsx";
import Upload from "./pages/Upload.jsx";
import Connectors from "./pages/Connectors.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Chat from "./pages/Chat.jsx";
import MLStudio from "./pages/MLStudio.jsx";
import WhatIfSimulator from "./pages/WhatIfSimulator.jsx";
import Reports from "./pages/Reports.jsx";
import RootCause from "./pages/RootCause.jsx";
import Sidebar from "./components/Sidebar.jsx";
import TopBar from "./components/TopBar.jsx";
import Recommendations from "./pages/Recommendations.jsx";

function ProtectedLayout({ children }) {
  const { isAuthenticated } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-[#050606] bg-grid-glow bg-grid-pattern overflow-hidden">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
  path="/forgot-password"
  element={<ForgotPassword />}
/>

<Route
  path="/reset-password"
  element={<ResetPassword />}
/>

      <Route
        path="/upload"
        element={
          <ProtectedLayout>
            <Upload />
          </ProtectedLayout>
        }
      />

      <Route
        path="/connectors"
        element={
          <ProtectedLayout>
            <Connectors />
          </ProtectedLayout>
        }
      />

      <Route
        path="/dashboard/:datasetId"
        element={
          <ProtectedLayout>
            <Dashboard />
          </ProtectedLayout>
        }
      />

      <Route
        path="/root-cause/:datasetId"
        element={
          <ProtectedLayout>
            <RootCause />
          </ProtectedLayout>
        }
      />

      <Route
        path="/chat/:datasetId"
        element={
          <ProtectedLayout>
            <Chat />
          </ProtectedLayout>
        }
      />

      <Route
        path="/ml/:datasetId"
        element={
          <ProtectedLayout>
            <MLStudio />
          </ProtectedLayout>
        }
      />

      <Route
        path="/reports/:datasetId"
        element={
          <ProtectedLayout>
            <Reports />
          </ProtectedLayout>
        }
      />

      <Route
        path="/recommendations/:datasetId"
        element={
          <ProtectedLayout>
            <Recommendations />
          </ProtectedLayout>
        }
      />

      <Route
        path="/what-if/:datasetId"
        element={
          <ProtectedLayout>
            <WhatIfSimulator />
          </ProtectedLayout>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}