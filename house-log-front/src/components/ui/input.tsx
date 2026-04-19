import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex min-h-11 w-full appearance-none border-0 border-b-[1.5px] border-(--field-border) bg-transparent px-0 py-2 text-[15px] text-(--field-text) transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-(--field-placeholder) hover:border-(--field-border-strong) focus-visible:border-(--field-border-strong) focus-visible:outline-none focus-visible:ring-0 sm:min-h-11',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };
