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
  approved:       'bg-bg-success text-text-success',
  archived:       'bg-bg-subtle text-text-tertiary',
  // Checklist item
  pending:        'bg-bg-warning text-text-warning',
  done:           'bg-bg-success text-text-success',
  issue:          'bg-bg-danger text-text-danger',
  not_applicable: 'bg-bg-subtle text-text-tertiary',
};

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <Badge className={cn('border-0 text-xs', STATUS_TONE[status] ?? 'bg-bg-subtle text-text-secondary')}>
      {label}
    </Badge>
  );
}
