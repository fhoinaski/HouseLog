import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const STATUS_TONE: Record<string, string> = {
  // Warranty
  active:         'bg-bg-success text-text-success',
  expired:        'bg-bg-danger text-text-danger',
  expiring:       'bg-bg-warning text-text-warning',
  claimed:        'bg-bg-warning text-text-warning',
  void:           'bg-bg-subtle text-text-tertiary',
  // Renovation
  planned:        'bg-bg-warning text-text-warning',
  in_progress:    'bg-bg-accent-subtle text-text-accent',
  completed:      'bg-bg-success text-text-success',
  cancelled:      'bg-bg-danger text-text-danger',
  // Handover package
  draft:          'bg-bg-subtle text-text-secondary',
  in_review:      'bg-bg-warning text-text-warning',
  ready_to_issue: 'bg-bg-accent-subtle text-text-accent',
  issued:         'bg-bg-warning text-text-warning',
  accepted:       'bg-bg-success text-text-success',
  revoked:        'bg-bg-danger text-text-danger',
  approved:       'bg-bg-success text-text-success',
  archived:       'bg-bg-subtle text-text-tertiary',
  // Checklist item
  pending:        'bg-bg-warning text-text-warning',
  done:           'bg-bg-success text-text-success',
  issue:          'bg-bg-danger text-text-danger',
  not_applicable: 'bg-bg-subtle text-text-tertiary',
  // Service order
  requested:      'bg-bg-warning text-text-warning',
  verified:       'bg-bg-success text-text-success',
  // Inventory
  low_stock:      'bg-bg-warning text-text-warning',
  warranty_active: 'bg-bg-success text-text-success',
  warranty_expired: 'bg-bg-danger text-text-danger',
  // Commercial requests and proposals
  submitted:      'bg-bg-accent-subtle text-text-accent',
  rejected:       'bg-bg-danger text-text-danger',
  converted:      'bg-bg-success text-text-success',
  commercial_cancelled: 'bg-bg-subtle text-text-tertiary',
};

export function StatusBadge({
  status,
  label,
  className,
  icon,
}: {
  status: string;
  label: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <Badge className={cn('border-0 text-xs', STATUS_TONE[status] ?? 'bg-bg-subtle text-text-secondary', className)}>
      {icon}
      {label}
    </Badge>
  );
}
