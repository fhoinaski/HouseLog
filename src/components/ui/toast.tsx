'use client';

import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const ToastProvider = ToastPrimitive.Provider;
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      'fixed bottom-4 right-4 z-[100] flex max-h-screen w-full max-w-sm flex-col gap-2 p-4',
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

const toastVariants = {
  default:     'border-[var(--border)] bg-[var(--card)]',
  success:     'border-emerald-200 bg-emerald-50 text-emerald-800',
  destructive: 'border-rose-200 bg-rose-50 text-rose-800',
  warning:     'border-amber-200 bg-amber-50 text-amber-800',
};

type ToastVariant = keyof typeof toastVariants;

type ToastProps = React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & {
  variant?: ToastVariant;
};

const Toast = React.forwardRef<React.ElementRef<typeof ToastPrimitive.Root>, ToastProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <ToastPrimitive.Root
      ref={ref}
      className={cn(
        'group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-[var(--radius-lg)] border p-4 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-full',
        toastVariants[variant],
        className
      )}
      {...props}
    />
  )
);
Toast.displayName = ToastPrimitive.Root.displayName;

const ToastIcon = ({ variant = 'default' }: { variant?: ToastVariant }) => {
  if (variant === 'success')     return <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />;
  if (variant === 'destructive') return <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />;
  if (variant === 'warning')     return <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />;
  return <Info className="h-4 w-4 text-primary-600 flex-shrink-0 mt-0.5" />;
};

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    className={cn('absolute right-2 top-2 rounded-sm p-1 opacity-60 hover:opacity-100', className)}
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitive.Close>
));
ToastClose.displayName = ToastPrimitive.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title ref={ref} className={cn('text-sm font-semibold', className)} {...props} />
));
ToastTitle.displayName = ToastPrimitive.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description ref={ref} className={cn('text-xs opacity-80', className)} {...props} />
));
ToastDescription.displayName = ToastPrimitive.Description.displayName;

export {
  ToastProvider, ToastViewport, Toast, ToastIcon,
  ToastClose, ToastTitle, ToastDescription,
  type ToastVariant,
};

// ── useToast hook ─────────────────────────────────────────────────────────────

type ToastData = {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastState = { toasts: ToastData[] };

type Action =
  | { type: 'add'; toast: ToastData }
  | { type: 'remove'; id: string };

function toastReducer(state: ToastState, action: Action): ToastState {
  if (action.type === 'add') {
    return { toasts: [...state.toasts, action.toast] };
  }
  return { toasts: state.toasts.filter((t) => t.id !== action.id) };
}

const ToastContext = React.createContext<{
  toasts: ToastData[];
  toast: (opts: Omit<ToastData, 'id'>) => void;
} | null>(null);

export function ToastContextProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(toastReducer, { toasts: [] });

  const toast = React.useCallback((opts: Omit<ToastData, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    dispatch({ type: 'add', toast: { ...opts, id } });
    setTimeout(() => dispatch({ type: 'remove', id }), opts.duration ?? 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts: state.toasts, toast }}>
      <ToastProvider>
        {children}
        <ToastViewport>
          {state.toasts.map((t) => (
            <Toast key={t.id} variant={t.variant} open>
              <ToastIcon variant={t.variant} />
              <div className="flex-1 min-w-0">
                <ToastTitle>{t.title}</ToastTitle>
                {t.description && <ToastDescription>{t.description}</ToastDescription>}
              </div>
              <ToastClose onClick={() => dispatch({ type: 'remove', id: t.id })} />
            </Toast>
          ))}
        </ToastViewport>
      </ToastProvider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastContextProvider');
  return ctx.toast;
}
