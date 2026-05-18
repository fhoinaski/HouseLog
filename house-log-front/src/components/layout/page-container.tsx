import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type PageContainerVariant = 'default' | 'narrow' | 'form';

const variants: Record<PageContainerVariant, string> = {
  default: 'max-w-[1200px]',
  narrow:  'max-w-[1024px]',
  form:    'max-w-3xl',
};

type PageContainerProps = {
  children: ReactNode;
  className?: string;
  variant?: PageContainerVariant;
};

export function PageContainer({ children, className, variant = 'default' }: PageContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-5 sm:px-5 md:px-6 md:py-6',
        variants[variant],
        className,
      )}
    >
      {children}
    </div>
  );
}
