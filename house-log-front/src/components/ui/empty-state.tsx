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
    <div className={cn(emptyStateVariants({ tone, density, className }))} {...props}>
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-bg-accent-subtle text-text-accent">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-medium text-text-primary">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm leading-6 text-text-secondary">{description}</p>}
      {actions && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}
