import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:     'border-transparent bg-primary-600 text-white',
        secondary:   'border-transparent bg-[var(--muted)] text-[var(--muted-foreground)]',
        destructive: 'border-transparent bg-rose-500 text-white',
        outline:     'border-[var(--border)] text-[var(--foreground)]',
        success:     'border-transparent bg-emerald-100 text-emerald-700',
        warning:     'border-transparent bg-amber-100 text-amber-700',
        urgent:      'border-rose-200 bg-rose-50 text-rose-700',
        normal:      'border-sky-200 bg-sky-50 text-sky-700',
        preventive:  'border-emerald-200 bg-emerald-50 text-emerald-700',
        requested:   'border-slate-200 bg-slate-50 text-slate-600',
        approved:    'border-blue-200 bg-blue-50 text-blue-700',
        in_progress: 'border-amber-200 bg-amber-50 text-amber-700',
        completed:   'border-emerald-200 bg-emerald-50 text-emerald-700',
        verified:    'border-violet-200 bg-violet-50 text-violet-700',
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
