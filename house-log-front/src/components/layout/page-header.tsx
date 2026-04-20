import type * as React from 'react';
import { type VariantProps } from 'class-variance-authority';
import { pageHeaderVariants } from '@/components/ui/visual-system';
import { cn } from '@/lib/utils';

type PageHeaderProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof pageHeaderVariants> & {
    eyebrow?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
  };

export function PageHeader({
  className,
  density,
  eyebrow,
  title,
  description,
  actions,
  ...props
}: PageHeaderProps) {
  return (
    <header className={cn(pageHeaderVariants({ density, className }))} {...props}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          {eyebrow && (
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
              {eyebrow}
            </p>
          )}
          <h1 className="text-xl font-medium leading-tight text-text-primary sm:text-2xl">{title}</h1>
          {description && <p className="max-w-2xl text-sm leading-6 text-text-secondary">{description}</p>}
        </div>
        {actions && <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div>}
      </div>
    </header>
  );
}
