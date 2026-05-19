import type * as React from 'react';
import { type VariantProps } from 'class-variance-authority';
import { emptyStateVariants } from '@/components/ui/visual-system';
import { cn } from '@/lib/utils';

type EmptyStateProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof emptyStateVariants> & {
    icon?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
  };

export function EmptyState({
  className,
  tone,
  density,
  icon,
  title,
  description,
  actions,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn('empty-state', emptyStateVariants({ tone, density, className }))}
      role="status"
      {...props}
    >
      {icon && (
        <div className="empty-state-icon mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--hl-radius-card)] bg-hl-surface-muted text-hl-primary">
          {icon}
        </div>
      )}
      <h3 className="max-w-sm text-sm font-medium text-hl-text">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm leading-6 text-hl-text-muted">{description}</p>
      )}
      {actions && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{actions}</div>
      )}
    </div>
  );
}
