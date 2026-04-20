import type * as React from 'react';
import { type VariantProps } from 'class-variance-authority';
import { ChevronRight } from 'lucide-react';
import { serviceOrderCardVariants } from '@/components/ui/visual-system';
import { cn } from '@/lib/utils';

type ServiceOrderCardProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof serviceOrderCardVariants> & {
    title: React.ReactNode;
    meta?: React.ReactNode;
    value?: React.ReactNode;
    status?: React.ReactNode;
    actionIcon?: React.ReactNode;
    leadingIcon?: React.ReactNode;
    footer?: React.ReactNode;
  };

export function ServiceOrderCard({
  className,
  density,
  interactive,
  title,
  meta,
  value,
  status,
  actionIcon,
  leadingIcon,
  footer,
  ...props
}: ServiceOrderCardProps) {
  return (
    <div className={cn(serviceOrderCardVariants({ density, interactive, className }))} {...props}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {leadingIcon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-accent-subtle text-text-accent">
              {leadingIcon}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">{title}</p>
            {meta && <p className="mt-0.5 truncate text-xs text-text-secondary">{meta}</p>}
          </div>
        </div>

        {(value || status || actionIcon !== null) && (
          <div className="flex shrink-0 items-center gap-3">
            {(value || status) && (
              <div className="flex flex-col items-end gap-1">
                {value && <span className="text-sm font-medium text-text-success">{value}</span>}
                {status}
              </div>
            )}
            {actionIcon === undefined ? (
              <ChevronRight className="h-4 w-4 text-text-tertiary transition-colors group-hover/service-order:text-text-secondary" />
            ) : (
              actionIcon
            )}
          </div>
        )}
      </div>
      {footer && <div className="mt-3 text-xs text-text-tertiary">{footer}</div>}
    </div>
  );
}
