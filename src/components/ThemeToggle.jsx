export default function ThemeToggle({ theme, setTheme }) {
  const options = [
    { value: 'light', icon: '☀️', label: 'Light' },
    { value: 'system', icon: '💻', label: 'System' },
    { value: 'dark', icon: '🌙', label: 'Dark' },
  ];

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Theme">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`theme-toggle-btn ${theme === opt.value ? 'active' : ''}`}
          onClick={() => setTheme(opt.value)}
          aria-pressed={theme === opt.value}
          title={`${opt.label} theme`}
        >
          <span className="theme-toggle-icon">{opt.icon}</span>
        </button>
      ))}
    </div>
  );
}
