export function UpdateBanner() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      background: '#5c4a38',
      color: '#faf7f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      padding: '10px 16px',
      fontFamily: "'IBM Plex Sans', Helvetica Neue, Arial, sans-serif",
      fontSize: '13px',
    }}>
      <span>Dostępna jest nowa wersja aplikacji.</span>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: '#faf7f0',
          color: '#5c4a38',
          border: 'none',
          borderRadius: '1px',
          padding: '4px 12px',
          fontFamily: "'IBM Plex Sans', Helvetica Neue, Arial, sans-serif",
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Odśwież
      </button>
    </div>
  );
}
