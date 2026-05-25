import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '../hooks/useTasks';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import type { TaskStatus } from '@shared/types';

const STATUSES: (TaskStatus | '')[] = ['', 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'EXPIRED'];

export default function TaskHistory() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const { tasks, loading, remove } = useTasks(search || undefined, statusFilter || undefined);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await remove(deleteId);
    } catch {
      // ignore
    }
    setDeleteId(null);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page">
      <h1>Task History</h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search tasks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 300 }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ maxWidth: 160 }}
        >
          <option value="">All Statuses</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {tasks.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No tasks found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map((task) => (
            <div
              key={task.id}
              className="card"
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px' }}
              onClick={() => navigate(`/history/${task.id}`)}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{task.toolName || `Tool #${task.toolId}`}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {new Date(task.createdAt).toLocaleString()}
                </div>
              </div>

              <StatusBadge status={task.status} />

              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {task.resultCount ?? 0} results
              </span>

              <button
                className="btn-danger"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                onClick={(e) => { e.stopPropagation(); setDeleteId(task.id); }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete Task"
        message="Are you sure you want to delete this task?"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        danger
      />
    </div>
  );
}
