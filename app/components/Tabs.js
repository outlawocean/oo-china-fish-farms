export default function Tabs({ activeTab, onTabChange }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-black)',
      borderBottom: '1.5px solid hsla(0, 0%, 100%, 0.2)',
      padding: '0 1.5em',
      display: 'flex',
      gap: '0.5em',
      alignItems: 'flex-end'
    }}>
      <button
        onClick={() => onTabChange('western')}
        style={{
          padding: '0.75em 1.25em',
          border: 'none',
          background: activeTab === 'western' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
          color: activeTab === 'western' ? 'var(--color-white)' : 'hsla(0, 0%, 100%, 0.5)',
          fontWeight: activeTab === 'western' ? '700' : '500',
          fontSize: '0.875em',
          cursor: 'pointer',
          borderRadius: '0.375rem 0.375rem 0 0',
          transition: 'background-color 0.2s ease, color 0.2s ease, opacity 0.2s ease',
          opacity: activeTab === 'western' ? '1' : '0.7'
        }}
        onMouseEnter={(e) => {
          if (activeTab !== 'western') {
            e.target.style.opacity = '1';
          }
        }}
        onMouseLeave={(e) => {
          if (activeTab !== 'western') {
            e.target.style.opacity = '0.7';
          }
        }}
      >
        Western China Fish Farms
      </button>

      <button
        onClick={() => onTabChange('table')}
        style={{
          padding: '0.75em 1.25em',
          border: 'none',
          background: activeTab === 'table' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
          color: activeTab === 'table' ? 'var(--color-white)' : 'hsla(0, 0%, 100%, 0.5)',
          fontWeight: activeTab === 'table' ? '700' : '500',
          fontSize: '0.875em',
          cursor: 'pointer',
          borderRadius: '0.375rem 0.375rem 0 0',
          transition: 'background-color 0.2s ease, color 0.2s ease, opacity 0.2s ease',
          opacity: activeTab === 'table' ? '1' : '0.7'
        }}
        onMouseEnter={(e) => {
          if (activeTab !== 'table') {
            e.target.style.opacity = '1';
          }
        }}
        onMouseLeave={(e) => {
          if (activeTab !== 'table') {
            e.target.style.opacity = '0.7';
          }
        }}
      >
        All China - Table
      </button>
    </div>
  );
}
