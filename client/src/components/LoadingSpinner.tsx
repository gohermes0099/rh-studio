export default function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 48,
      gap: 12,
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid var(--border)',
        borderTopColor: 'var(--info)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{text}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
