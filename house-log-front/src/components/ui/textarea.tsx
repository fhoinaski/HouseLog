import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        'flex min-h-28 w-full rounded-[12px] border-[1.5px] border-(--field-border) bg-(--field-bg) px-4 py-3 text-base text-(--field-text) shadow-sm placeholder:text-(--field-placeholder) hover:bg-(--field-bg-hover) hover:border-(--field-border-strong) focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-(--field-focus-ring) focus-visible:border-primary-700 disabled:cursor-not-allowed disabled:opacity-50 resize-none',
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export { Textarea };
