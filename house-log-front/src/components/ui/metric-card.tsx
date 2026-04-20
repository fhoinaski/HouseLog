import type * as React from 'react';
import { type VariantProps } from 'class-variance-authority';
import { metricCardVariants, metricIconVariants } from '@/components/ui/visual-system';
import { cn } from '@/lib/utils';

type MetricCardProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof metricCardVariants> & {
    label: React.ReactNode;
    value: React.ReactNode;
    icon?: React.ComponentType<{ className?: string }>;
    helper?: React.ReactNode;
    iconClassName?: string;
    valueClassName?: string;
    labelClassName?: string;
  };

export function MetricCard({
  className,
  tone,
  density,
  label,
  value,
  icon: Icon,
  helper,
  iconClassName,
  valueClassName,
  labelClassName,
  ...props
}: MetricCardProps) {
  return (
    <div className={cn(metricCardVariants({ tone, density, className }))} {...props}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <div className={cn(metricIconVariants({ tone }), iconClassName)}>
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0">
          <p className={cn('text-xl font-medium leading-tight text-text-primary', valueClassName)}>{value}</p>
          <p className={cn('truncate text-xs text-text-secondary', labelClassName)}>{label}</p>
        </div>
      </div>
      {helper && <p className="mt-3 text-xs leading-5 text-text-tertiary">{helper}</p>}
    </div>
  );
}
