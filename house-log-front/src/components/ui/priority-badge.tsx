import type { BadgeProps } from '@/components/ui/badge';
import { Badge } from '@/components/ui/badge';
import { SERVICE_PRIORITY_LABELS } from '@/lib/utils';

export const PRIORITY_BADGE_VARIANT: Record<string, BadgeProps['variant']> = {
  urgent:     'urgent',
  normal:     'normal',
  preventive: 'preventive',
};

type PriorityBadgeProps = {
  priority: string;
  className?: string;
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const variant = PRIORITY_BADGE_VARIANT[priority] ?? 'default';
  const label = SERVICE_PRIORITY_LABELS[priority] ?? priority;
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
