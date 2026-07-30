import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";

import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Upload from "./pages/Upload.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Chat from "./pages/Chat.jsx";
import MLStudio from "./pages/MLStudio.jsx";
import Reports from "./pages/Reports.jsx";
import RootCause from "./pages/RootCause.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Recommendations from "./pages/Recommendations.jsx";

function ProtectedLayout({ children }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-slate-950 bg-grid-glow">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 overflow-x-hidden">
        {children}
      </main>
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
        path="/upload"
        element={
          <ProtectedLayout>
            <Upload />
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

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}