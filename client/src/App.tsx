import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Catalog from './pages/Catalog';
import RegisterTool from './pages/RegisterTool';
import ToolRunner from './pages/ToolRunner';
import TaskHistory from './pages/TaskHistory';
import TaskDetail from './pages/TaskDetail';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Catalog />} />
          <Route path="/register" element={<RegisterTool />} />
          <Route path="/tools/:id/run" element={<ToolRunner />} />
          <Route path="/history" element={<TaskHistory />} />
          <Route path="/history/:id" element={<TaskDetail />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
