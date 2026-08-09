import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'error' | 'info';
}

// Global hook placeholder for triggering toasts
let toastListener: (msg: ToastMessage) => void = () => {};

export function toast(title: string, description?: string, type: ToastMessage['type'] = 'info') {
  toastListener({
    id: Math.random().toString(36).substring(2, 9),
    title,
    description,
    type,
  });
}

export function ToastProvider() {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  React.useEffect(() => {
    toastListener = (msg) => {
      setToasts((prev) => [...prev, msg]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id));
      }, 4000);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.9 }}
            className="flex flex-col gap-1 rounded-md border border-border bg-popover/80 p-4 shadow-lg backdrop-blur-md pointer-events-auto select-none"
          >
            <div className="flex items-center gap-2">
              {t.type === 'success' && <span className="h-2 w-2 rounded-full bg-success" />}
              {t.type === 'error' && <span className="h-2 w-2 rounded-full bg-danger" />}
              {t.type === 'info' && <span className="h-2 w-2 rounded-full bg-primary" />}
              <span className="font-semibold text-sm text-foreground">{t.title}</span>
            </div>
            {t.description && (
              <span className="text-3xs text-muted-foreground ml-4">{t.description}</span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
