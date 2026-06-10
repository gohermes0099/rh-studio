import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Catalog from './pages/Catalog';
import RegisterTool from './pages/RegisterTool';
import ToolRunner from './pages/ToolRunner';
import TaskHistory from './pages/TaskHistory';
import TaskDetail from './pages/TaskDetail';
import Settings from './pages/Settings';
import Gallery from './pages/Gallery';
import UploadGallery from './pages/UploadGallery';
import Prompts from './pages/Prompts';
import AgentStudio from './pages/AgentStudio';
import { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a6478' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Catalog />} />
            <Route path="/register" element={<RegisterTool />} />
            <Route path="/tools/:id/run" element={<ToolRunner />} />
            <Route path="/history" element={<TaskHistory />} />
            <Route path="/history/:id" element={<TaskDetail />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/prompts" element={<Prompts />} />
            <Route path="/agent" element={<AgentStudio />} />
            <Route path="/uploads" element={<UploadGallery />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}