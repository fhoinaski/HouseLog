import { describe, expect, it } from 'vitest';
import { STATUS_TONE } from '@/components/ui/status-badge';
import { PRIORITY_BADGE_VARIANT } from '@/components/ui/priority-badge';
import { SERVICE_PRIORITY_LABELS, SERVICE_STATUS_LABELS } from '@/lib/utils';

// ── StatusBadge ─────────────────────────────────────────────────────────────

describe('STATUS_TONE', () => {
  const knownStatuses = [
    // ServiceOrder
    'requested', 'approved', 'in_progress', 'completed', 'verified',
    // Warranty
    'active', 'expired', 'expiring', 'claimed', 'void',
    // Renovation
    'planned', 'cancelled',
    // Handover
    'draft', 'in_review', 'ready_to_issue', 'issued', 'accepted', 'revoked',
    // Checklist
    'pending', 'done', 'issue', 'not_applicable',
    // Inventory
    'low_stock', 'warranty_active', 'warranty_expired',
    // Commercial
    'submitted', 'rejected', 'converted', 'commercial_cancelled',
    // Misc
    'archived',
  ];

  it('covers all known domain statuses', () => {
    const missing = knownStatuses.filter((s) => !(s in STATUS_TONE));
    expect(missing).toEqual([]);
  });

  it('every entry produces a non-empty class string', () => {
    for (const [status, classes] of Object.entries(STATUS_TONE)) {
      expect(classes.trim().length, `STATUS_TONE["${status}"] is empty`).toBeGreaterThan(0);
    }
  });

  it('fallback for unknown status does not throw', () => {
    const tone = STATUS_TONE['totally_unknown_xyz'];
    // Should be undefined — caller is expected to apply fallback
    expect(tone).toBeUndefined();
  });

  it('all Calm OS class strings use --hl-* tokens or hl- utilities', () => {
    for (const [status, classes] of Object.entries(STATUS_TONE)) {
      const usesHlTokens =
        classes.includes('--hl-') ||
        classes.includes('hl-surface') ||
        classes.includes('hl-text') ||
        classes.includes('hl-success') ||
        classes.includes('hl-danger') ||
        classes.includes('hl-warning') ||
        classes.includes('hl-info') ||
        classes.includes('hl-primary');
      expect(usesHlTokens, `STATUS_TONE["${status}"] does not use --hl-* tokens`).toBe(true);
    }
  });

  it('does not contain legacy token names', () => {
    const legacyPatterns = ['bg-bg-', 'text-text-', 'bg-surface-', 'text-primary'];
    for (const [status, classes] of Object.entries(STATUS_TONE)) {
      for (const pattern of legacyPatterns) {
        expect(classes, `STATUS_TONE["${status}"] still uses legacy token "${pattern}"`).not.toContain(pattern);
      }
    }
  });
});

// ── PriorityBadge ───────────────────────────────────────────────────────────

describe('PRIORITY_BADGE_VARIANT', () => {
  const knownPriorities = Object.keys(SERVICE_PRIORITY_LABELS);

  it('covers all known domain priorities', () => {
    const missing = knownPriorities.filter((p) => !(p in PRIORITY_BADGE_VARIANT));
    expect(missing).toEqual([]);
  });

  it('every variant value is a non-empty string', () => {
    for (const [priority, variant] of Object.entries(PRIORITY_BADGE_VARIANT)) {
      expect(typeof variant, `PRIORITY_BADGE_VARIANT["${priority}"] is not a string`).toBe('string');
      expect((variant as string).length, `PRIORITY_BADGE_VARIANT["${priority}"] is empty`).toBeGreaterThan(0);
    }
  });

  it('urgent maps to an urgent/danger tone variant', () => {
    expect(PRIORITY_BADGE_VARIANT['urgent']).toBe('urgent');
  });

  it('preventive maps to a success/done tone variant', () => {
    expect(PRIORITY_BADGE_VARIANT['preventive']).toBe('preventive');
  });

  it('normal maps to a neutral variant', () => {
    expect(PRIORITY_BADGE_VARIANT['normal']).toBe('normal');
  });
});

// ── SERVICE_STATUS_LABELS ────────────────────────────────────────────────────

describe('SERVICE_STATUS_LABELS', () => {
  it('has pt-BR label for every ServiceOrder status', () => {
    const serviceOrderStatuses = ['requested', 'approved', 'in_progress', 'completed', 'verified'];
    for (const status of serviceOrderStatuses) {
      expect(SERVICE_STATUS_LABELS[status], `Missing label for status "${status}"`).toBeTruthy();
    }
  });
});

// ── SERVICE_PRIORITY_LABELS ──────────────────────────────────────────────────

describe('SERVICE_PRIORITY_LABELS', () => {
  it('has pt-BR label for urgent, normal, preventive', () => {
    expect(SERVICE_PRIORITY_LABELS['urgent']).toBeTruthy();
    expect(SERVICE_PRIORITY_LABELS['normal']).toBeTruthy();
    expect(SERVICE_PRIORITY_LABELS['preventive']).toBeTruthy();
  });
});
