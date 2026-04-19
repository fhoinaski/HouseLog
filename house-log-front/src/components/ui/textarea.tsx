import * as React from 'react';
import { type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { fieldVariants } from '@/components/ui/visual-system';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & VariantProps<typeof fieldVariants>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, density, ...props }, ref) => (
    <textarea
      data-slot="textarea"
      className={cn(
        'hl-textarea resize-none disabled:cursor-not-allowed disabled:opacity-60',
        fieldVariants({ variant, density }),
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

export { Textarea };
