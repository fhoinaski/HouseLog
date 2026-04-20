import type * as React from 'react';
import { type VariantProps } from 'class-variance-authority';
import { pageSectionVariants } from '@/components/ui/visual-system';
import { cn } from '@/lib/utils';

type PageSectionProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof pageSectionVariants> & {
    title?: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    contentClassName?: string;
  };

export function PageSection({
  className,
  contentClassName,
  tone,
  density,
  title,
  description,
  actions,
  children,
  ...props
}: PageSectionProps) {
  const hasHeader = title || description || actions;

  return (
    <section className={cn(pageSectionVariants({ tone, density, className }))} {...props}>
      {hasHeader && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            {title && <h2 className="text-base font-medium text-text-primary">{title}</h2>}
            {description && <p className="max-w-2xl text-sm leading-6 text-text-secondary">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(contentClassName)}>{children}</div>
    </section>
  );
}
