import { createContext, useCallback, useContext, useRef, useState } from 'react';
import './toast.css';

type ToastKind = 'success' | 'error';
interface ToastItem { id: number; message: string; kind: ToastKind; }

const AUTO_DISMISS_MS: Record<ToastKind, number> = { success: 4000, error: 7000 };

interface ToastContextValue {
    success: (message: string) => void;
    error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const nextId = useRef(0);

    const dismiss = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const push = useCallback((message: string, kind: ToastKind) => {
        const id = nextId.current++;
        setToasts((prev) => [...prev, { id, message, kind }]);
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS[kind]);
    }, [dismiss]);

    const value: ToastContextValue = {
        success: (message) => push(message, 'success'),
        error: (message) => push(message, 'error'),
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="toastStack">
                {toasts.map((t) => (
                    <div key={t.id} className={`toast toast-${t.kind}`} onClick={() => dismiss(t.id)}>
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast(): ToastContextValue {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within a ToastProvider');
    return ctx;
}
