import { useState, useEffect } from 'react';

export default function BadgeToast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const badge = e.detail;
      const id = Date.now();
      setToasts((prev) => [...prev, { id, ...badge }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    };
    window.addEventListener('badge-unlocked', handler);
    return () => window.removeEventListener('badge-unlocked', handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="badge-toast-container">
      {toasts.map((t) => (
        <div key={t.id} className="badge-toast">
          <span className="badge-toast-icon">{t.icon}</span>
          <div className="badge-toast-text">
            <span className="badge-toast-title">Badge Unlocked!</span>
            <span className="badge-toast-name">{t.name}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
