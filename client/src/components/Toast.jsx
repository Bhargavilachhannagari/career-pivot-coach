import { createContext, useCallback, useContext, useRef, useState } from 'react';

const DURATION_MS = 4000;
const MAX_TOASTS = 3;

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);

  const showToast = useCallback(
    (message, type = 'success') => {
      const id = ++nextId.current;
      setToasts((list) => [...list, { id, message, type }].slice(-MAX_TOASTS));
      setTimeout(() => dismiss(id), DURATION_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span className="toast-icon" aria-hidden="true">
              {toast.type === 'success' ? '✓' : '!'}
            </span>
            <span className="toast-message">{toast.message}</span>
            <button
              type="button"
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
