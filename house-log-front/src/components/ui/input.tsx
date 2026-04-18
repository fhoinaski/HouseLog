import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-13 w-full appearance-none rounded-lg border-[1.5px] border-(--field-border) bg-(--field-bg) px-4 py-3 text-base text-(--field-text) shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-(--field-placeholder) hover:bg-(--field-bg-hover) hover:border-(--field-border-strong) focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-(--field-focus-ring) focus-visible:border-primary-700 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };
