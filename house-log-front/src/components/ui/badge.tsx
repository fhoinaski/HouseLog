import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-(--color-neutral-50) text-(--color-neutral-600)',
        secondary: 'bg-(--color-neutral-50) text-(--color-neutral-600)',
        destructive: 'bg-(--color-danger-light) text-(--color-danger)',
        outline: 'border border-(--color-neutral-200) bg-white text-(--color-neutral-800)',
        success: 'bg-(--color-success-light) text-(--color-success)',
        warning: 'bg-(--color-warning-light) text-(--color-warning)',
        urgent: 'bg-(--color-danger-light) text-(--color-danger)',
        normal: 'bg-(--color-neutral-50) text-(--color-neutral-600)',
        preventive: 'bg-(--color-success-light) text-(--color-success)',
        requested: 'bg-(--color-warning-light) text-(--color-warning)',
        approved: 'bg-(--color-danger-light) text-(--color-danger)',
        in_progress: 'bg-(--color-primary-light) text-(--color-primary)',
        completed: 'bg-(--color-success-light) text-(--color-success)',
        verified: 'bg-(--color-success-light) text-(--color-success)',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
