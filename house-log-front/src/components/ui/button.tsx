import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary-700/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:     'bg-linear-to-r from-primary-400 to-primary-700 text-white shadow-[0_10px_30px_-10px_rgba(46,91,255,0.25)] hover:scale-[1.02] hover:brightness-110 active:scale-95',
        destructive: 'bg-rose-500 text-white shadow-sm hover:bg-rose-600 active:scale-[0.98]',
        outline:     'border border-zinc-600 bg-transparent text-[var(--foreground)] hover:bg-zinc-700/20 hover:scale-[1.02] active:scale-95',
        secondary:   'bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)]',
        ghost:       'border border-zinc-600 bg-transparent text-[var(--foreground)] hover:bg-zinc-700/20 hover:shadow-[0_0_20px_rgba(46,91,255,0.08)] hover:scale-[1.02] active:scale-95',
        link:        'text-primary-700 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-[52px] px-4 py-2',
        sm:      'h-10 rounded-[12px] px-3 text-xs',
        lg:      'h-[52px] rounded-[12px] px-6 text-base',
        icon:    'h-10 w-10 rounded-[12px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {asChild ? children : (
          <>
            {loading && (
              <svg className="animate-spin -ml-1 mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {children}
          </>
        )}
      </Comp>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
