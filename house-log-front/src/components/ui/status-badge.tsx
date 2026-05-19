import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const S = 'color-mix(in_srgb,var(--hl-success)_12%,var(--hl-surface))';
const D = 'color-mix(in_srgb,var(--hl-danger)_12%,var(--hl-surface))';
const W = 'color-mix(in_srgb,var(--hl-warning)_12%,var(--hl-surface))';
const I = 'color-mix(in_srgb,var(--hl-info)_12%,var(--hl-surface))';
const P = 'color-mix(in_srgb,var(--hl-primary)_12%,var(--hl-surface))';

export const STATUS_TONE: Record<string, string> = {
  // ── success ────────────────────────────────────────────────────────────
  active:               `bg-[${S}] text-hl-success`,
  completed:            `bg-[${S}] text-hl-success`,
  done:                 `bg-[${S}] text-hl-success`,
  accepted:             `bg-[${S}] text-hl-success`,
  approved:             `bg-[${S}] text-hl-success`,
  verified:             `bg-[${S}] text-hl-success`,
  warranty_active:      `bg-[${S}] text-hl-success`,
  converted:            `bg-[${S}] text-hl-success`,
  // ── danger ─────────────────────────────────────────────────────────────
  expired:              `bg-[${D}] text-hl-danger`,
  cancelled:            `bg-[${D}] text-hl-danger`,
  revoked:              `bg-[${D}] text-hl-danger`,
  rejected:             `bg-[${D}] text-hl-danger`,
  issue:                `bg-[${D}] text-hl-danger`,
  warranty_expired:     `bg-[${D}] text-hl-danger`,
  // ── warning ────────────────────────────────────────────────────────────
  expiring:             `bg-[${W}] text-hl-warning`,
  claimed:              `bg-[${W}] text-hl-warning`,
  planned:              `bg-[${W}] text-hl-warning`,
  pending:              `bg-[${W}] text-hl-warning`,
  requested:            `bg-[${W}] text-hl-warning`,
  issued:               `bg-[${W}] text-hl-warning`,
  in_review:            `bg-[${W}] text-hl-warning`,
  low_stock:            `bg-[${W}] text-hl-warning`,
  // ── info / in-progress ─────────────────────────────────────────────────
  in_progress:          `bg-[${I}] text-hl-info`,
  submitted:            `bg-[${I}] text-hl-info`,
  ready_to_issue:       `bg-[${P}] text-hl-primary`,
  // ── neutral ────────────────────────────────────────────────────────────
  void:                 'bg-hl-surface-muted text-hl-text-muted',
  draft:                'bg-hl-surface-muted text-hl-text-muted',
  archived:             'bg-hl-surface-muted text-hl-text-soft',
  not_applicable:       'bg-hl-surface-muted text-hl-text-soft',
  commercial_cancelled: 'bg-hl-surface-muted text-hl-text-soft',
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
    <Badge
      className={cn(
        'border-0 text-xs',
        STATUS_TONE[status] ?? 'bg-hl-surface-muted text-hl-text-muted',
        className,
      )}
    >
      {icon}
      {label}
    </Badge>
  );
}
