'use client';
import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      theme="light"
      className="toaster group"
      position="bottom-right"
      style={{ zIndex: 'var(--z-toast)' }}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'group toast group-[.toaster]:rounded-md group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-(--hl-border-light)',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:rounded-lg group-[.toast]:bg-(--color-primary) group-[.toast]:text-white group-[.toast]:text-[13px] group-[.toast]:font-medium',
          cancelButton: 'group-[.toast]:rounded-lg group-[.toast]:border group-[.toast]:border-(--color-neutral-200) group-[.toast]:bg-transparent group-[.toast]:text-(--color-neutral-800) group-[.toast]:text-[13px] group-[.toast]:font-medium',
        },
      }}
    />
  );
}
