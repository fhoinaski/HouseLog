import * as React from 'react';
import { type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { fieldVariants } from '@/components/ui/visual-system';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & VariantProps<typeof fieldVariants>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, density, ...props }, ref) => (
    <input
      data-slot="input"
      type={type}
      className={cn(
        'hl-input disabled:cursor-not-allowed disabled:opacity-60 file:border-0 file:bg-transparent file:text-sm file:font-medium',
        fieldVariants({ variant, density }),
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };
