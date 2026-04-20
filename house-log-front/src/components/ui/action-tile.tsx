import Link from 'next/link';
import type * as React from 'react';
import { type VariantProps } from 'class-variance-authority';
import { actionTileIconVariants, actionTileVariants } from '@/components/ui/visual-system';
import { cn } from '@/lib/utils';

type ActionTileProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> &
  VariantProps<typeof actionTileVariants> & {
    href: string;
    icon?: React.ComponentType<{ className?: string }>;
    label: React.ReactNode;
    description?: React.ReactNode;
    iconClassName?: string;
  };

export function ActionTile({
  className,
  iconClassName,
  tone,
  density,
  href,
  icon: Icon,
  label,
  description,
  ...props
}: ActionTileProps) {
  return (
    <Link href={href} className={cn(actionTileVariants({ tone, density, className }))} {...props}>
      {Icon && (
        <div className={cn(actionTileIconVariants({ tone }), iconClassName)}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <span className="text-xs font-medium leading-5 text-text-primary">{label}</span>
      {description && <span className="text-[11px] leading-4 text-text-tertiary">{description}</span>}
    </Link>
  );
}
