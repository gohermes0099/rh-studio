import type { TaskStatus } from '@shared/types';

const COLORS: Record<TaskStatus, { bg: string; color: string }> = {
  PENDING: { bg: '#fdcb6e33', color: '#fdcb6e' },
  RUNNING: { bg: '#74b9ff33', color: '#74b9ff' },
  COMPLETED: { bg: '#00b89433', color: '#00b894' },
  FAILED: { bg: '#d6303133', color: '#d63031' },
  EXPIRED: { bg: '#636e7233', color: '#636e72' },
};

export default function StatusBadge({ status }: { status: TaskStatus }) {
  const c = COLORS[status];
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: '0.8rem',
      fontWeight: 600,
      background: c.bg,
      color: c.color,
    }}>
      {status}
    </span>
  );
}
