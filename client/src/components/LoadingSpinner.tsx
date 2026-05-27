export default function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 60,
      gap: 16,
    }}>
      {/* AI-themed spinner: pulsing rings */}
      <div style={{ position: 'relative', width: 40, height: 40 }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: '2px solid transparent',
          borderTopColor: '#6366f1',
          borderRightColor: '#06b6d4',
          animation: 'spin 0.9s cubic-bezier(0.6, 0, 0.4, 1) infinite',
        }} />
        <div style={{
          position: 'absolute',
          inset: 4,
          borderRadius: '50%',
          border: '2px solid transparent',
          borderBottomColor: '#a855f7',
          borderLeftColor: '#6366f1',
          animation: 'spin 1.2s cubic-bezier(0.6, 0, 0.4, 1) infinite reverse',
        }} />
        <div style={{
          position: 'absolute',
          inset: 10,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(6,182,212,0.2))',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      </div>
      <span style={{
        color: 'var(--text-muted)',
        fontSize: '0.85rem',
        fontWeight: 450,
        letterSpacing: '0.02em',
      }}>
        {text}
      </span>
    </div>
  );
}
