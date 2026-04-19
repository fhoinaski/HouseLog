import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'hl-badge transition-colors',
  {
    variants: {
      variant: {
        default: 'hl-badge-draft',
        secondary: 'hl-badge-draft',
        destructive: 'hl-badge-approval',
        outline: 'hl-badge-draft border-half border-border-default bg-bg-surface',
        success: 'hl-badge-done',
        warning: 'hl-badge-pending',
        urgent: 'hl-badge-urgent',
        normal: 'hl-badge-draft',
        preventive: 'hl-badge-done',
        requested: 'hl-badge-pending',
        approved: 'hl-badge-approval',
        in_progress: 'hl-badge-progress',
        completed: 'hl-badge-done',
        verified: 'hl-badge-done',
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
