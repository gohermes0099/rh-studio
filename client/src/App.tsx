import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Catalog from './pages/Catalog';
import RegisterTool from './pages/RegisterTool';
import ToolRunner from './pages/ToolRunner';
import TaskHistory from './pages/TaskHistory';
import TaskDetail from './pages/TaskDetail';
import Settings from './pages/Settings';
import Gallery from './pages/Gallery';
import UploadGallery from './pages/UploadGallery';
import Prompts from './pages/Prompts';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Catalog />} />
          <Route path="/login" element={<Navigate to="/settings" replace />} />
          <Route path="/register" element={<RegisterTool />} />
          <Route path="/tools/:id/run" element={<ToolRunner />} />
          <Route path="/history" element={<TaskHistory />} />
          <Route path="/history/:id" element={<TaskDetail />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/prompts" element={<Prompts />} />
          <Route path="/uploads" element={<UploadGallery />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
