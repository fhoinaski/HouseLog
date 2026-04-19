import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary-border) disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-(--color-primary) text-white hover:opacity-95',
        destructive: 'bg-(--color-danger) text-white hover:opacity-95',
        outline: 'border border-(--color-neutral-200) bg-transparent text-(--color-neutral-800) hover:bg-(--color-neutral-50)',
        secondary: 'border border-(--color-neutral-200) bg-transparent text-(--color-neutral-800) hover:bg-(--color-neutral-50)',
        ghost: 'bg-transparent text-(--color-neutral-800) hover:bg-(--color-neutral-50)',
        link: 'text-(--color-primary) underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-4 py-2.5',
        sm: 'h-11 px-4 py-2 text-[13px]',
        lg: 'h-12 px-4 py-2.5 text-[13px]',
        icon: 'h-11 w-11 rounded-xl px-0 py-0',
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
