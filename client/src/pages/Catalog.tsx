import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTools } from '../hooks/useTools';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Catalog() {
  const navigate = useNavigate();
  const { tools, loading, remove } = useTools();
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const filtered = tools.filter((t) =>
    t.webappName.toLowerCase().includes(search.toLowerCase()),
  );

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
      <h1>Tool Catalog</h1>

      <input
        type="text"
        placeholder="Search tools..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 24, maxWidth: 400 }}
      />

      {filtered.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>
          {tools.length === 0 ? 'No tools registered yet. Register one first.' : 'No tools match your search.'}
        </p>
      ) : (
        <div className="grid grid-2">
          {filtered.map((tool) => {
            let tags: { name: string }[] = [];
            try { tags = JSON.parse(tool.tags); } catch {}
            return (
              <div
                key={tool.id}
                className="card"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/tools/${tool.id}/run`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>{tool.webappName}</h3>
                  <button
                    className="btn-danger"
                    style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                    onClick={(e) => { e.stopPropagation(); setDeleteId(tool.id); }}
                  >
                    Delete
                  </button>
                </div>

                {tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                    {tags.map((tag, i) => (
                      <span key={i} style={{
                        background: 'var(--primary)',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: '0.75rem',
                      }}>
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Tools: {tool.taskCount ?? 0} &middot; ID: {tool.webappId}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete Tool"
        message="Are you sure you want to delete this tool? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        danger
      />
    </div>
  );
}
