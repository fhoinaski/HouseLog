import { cva } from 'class-variance-authority';

export const surfaceVariants = cva('', {
  variants: {
    tone: {
      page: 'bg-hl-bg text-hl-text',
      base: 'bg-hl-surface text-hl-text',
      raised: 'bg-hl-surface text-hl-text shadow-hl-soft',
      strong: 'bg-hl-surface-muted text-hl-text',
      glass: 'bg-hl-surface text-hl-text',
      inverse: 'bg-[var(--surface-inverse)] text-text-inverse',
    },
    radius: {
      none: 'rounded-none',
      sm: 'rounded-[var(--radius-sm)]',
      md: 'rounded-[var(--radius-md)]',
      lg: 'rounded-[var(--radius-lg)]',
      xl: 'rounded-[var(--radius-xl)]',
    },
    depth: {
      none: 'shadow-none',
      subtle: 'shadow-[var(--shadow-xs)]',
      raised: 'shadow-[var(--surface-shadow-raised)]',
    },
  },
  defaultVariants: {
    tone: 'base',
    radius: 'md',
    depth: 'none',
  },
});

export const cardVariants = cva('hl-card text-hl-text', {
  variants: {
    variant: {
      default: '',
      tonal: 'bg-hl-surface-muted',
      section: 'rounded-[var(--hl-radius-card)] bg-hl-surface',
      raised: 'bg-hl-surface shadow-hl-soft',
      glass: 'bg-hl-surface',
      interactive: 'cursor-pointer bg-hl-surface hover:bg-hl-surface-muted',
    },
    density: {
      compact: '[--card-padding:12px]',
      default: '',
      comfortable: '[--card-padding:20px]',
      editorial: '[--card-padding:20px]',
    },
  },
  defaultVariants: {
    variant: 'default',
    density: 'default',
  },
});

export const buttonVariants = cva(
  'inline-flex min-h-input-md items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all duration-150 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'hl-btn-primary',
        destructive: 'hl-btn-danger',
        outline: 'hl-btn-secondary',
        secondary: 'hl-btn-secondary',
        ghost: 'hl-btn-ghost',
        premium: 'bg-[var(--button-premium-bg)] text-[var(--button-premium-text)] shadow-[var(--button-premium-shadow)] hover:bg-[var(--button-premium-hover)] focus-visible:shadow-[var(--button-premium-focus)]',
        tonal: 'bg-hl-surface-muted text-hl-text hover:bg-hl-border focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--hl-primary)_15%,transparent)]',
        link: 'h-auto min-h-0 px-0 py-0 text-hl-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'px-4 py-2',
        sm: 'px-4 py-2',
        lg: 'min-h-12 px-4 py-3 text-base',
        icon: 'w-input-md rounded-md px-0 py-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export const badgeVariants = cva('hl-badge transition-colors', {
  variants: {
    variant: {
      default: 'hl-badge-draft',
      secondary: 'hl-badge-draft',
      destructive: 'hl-badge-approval',
      outline: 'hl-badge-draft border border-hl-border bg-hl-surface',
      success: 'hl-badge-done',
      warning: 'hl-badge-pending',
      urgent: 'hl-badge-urgent',
      normal: 'hl-badge-draft',
      preventive: 'hl-badge-done',
      requested: 'hl-badge-pending',
      approved: 'hl-badge-approval',
      in_progress: 'hl-badge-progress',
      completed: 'hl-badge-done',
      verified: 'hl-badge-done',
    },
  },
  defaultVariants: { variant: 'default' },
});

export const chipVariants = cva(
  'min-h-11 rounded-[var(--hl-radius-control)] px-4 py-2 text-left text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--hl-primary)_15%,transparent)]',
  {
    variants: {
      active: {
        true: 'bg-hl-primary text-white',
        false: 'bg-hl-surface-muted text-hl-text hover:bg-hl-border',
      },
    },
    defaultVariants: {
      active: false,
    },
  }
);

export const fieldVariants = cva('', {
  variants: {
    variant: {
      default: '',
      tonal: 'bg-hl-surface-muted',
      ghost: 'border-transparent bg-transparent hover:bg-hl-surface-muted',
    },
    density: {
      compact: 'min-h-9 text-sm',
      default: '',
      comfortable: 'min-h-input-lg text-base',
    },
  },
  defaultVariants: {
    variant: 'default',
    density: 'default',
  },
});

export const sensitiveFieldVariants = cva(
  'group/sensitive flex min-h-11 items-center gap-2 rounded-[var(--hl-radius-control)] bg-hl-surface border border-hl-border px-3 py-2 text-hl-text transition-all duration-150 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--hl-primary)_15%,transparent)] hover:bg-hl-surface-muted',
  {
    variants: {
      tone: {
        default: '',
        subtle: 'bg-hl-surface',
        strong: 'bg-hl-surface-muted',
      },
      state: {
        masked: 'text-hl-text-muted',
        revealed: 'text-hl-text',
        empty: 'text-hl-text-muted',
      },
    },
    defaultVariants: {
      tone: 'default',
      state: 'masked',
    },
  }
);

export const pageHeaderVariants = cva('flex flex-col gap-3 text-hl-text', {
  variants: {
    density: {
      compact: 'py-1',
      default: 'py-2',
      spacious: 'py-4',
      editorial: 'py-3 sm:py-5',
    },
  },
  defaultVariants: {
    density: 'default',
  },
});

export const pageSectionVariants = cva('space-y-3', {
  variants: {
    tone: {
      plain: '',
      surface: 'rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle',
      strong:  'rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface-muted p-4',
    },
    density: {
      compact: 'space-y-2',
      default: 'space-y-3',
      comfortable: 'space-y-4',
      editorial: 'space-y-4 sm:space-y-5',
    },
  },
  defaultVariants: {
    tone: 'plain',
    density: 'default',
  },
});

export const metricCardVariants = cva(
  'rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface p-4 text-hl-text shadow-hl-subtle transition-colors duration-150',
  {
    variants: {
      tone: {
        default: '',
        accent:  'bg-[color-mix(in_srgb,var(--hl-primary)_6%,var(--hl-surface))] border-[color-mix(in_srgb,var(--hl-primary)_20%,var(--hl-border))]',
        success: 'bg-[color-mix(in_srgb,var(--hl-success)_6%,var(--hl-surface))] border-[color-mix(in_srgb,var(--hl-success)_20%,var(--hl-border))]',
        warning: 'bg-[color-mix(in_srgb,var(--hl-warning)_6%,var(--hl-surface))] border-[color-mix(in_srgb,var(--hl-warning)_20%,var(--hl-border))]',
        danger:  'bg-[color-mix(in_srgb,var(--hl-danger)_6%,var(--hl-surface))]  border-[color-mix(in_srgb,var(--hl-danger)_20%,var(--hl-border))]',
        strong: 'bg-hl-surface-muted',
      },
      density: {
        compact: 'p-3',
        default: 'p-4',
        comfortable: 'p-5',
      },
    },
    defaultVariants: {
      tone: 'default',
      density: 'default',
    },
  }
);

export const metricIconVariants = cva(
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface-muted',
  {
    variants: {
      tone: {
        default: 'text-hl-text-muted',
        accent: 'text-hl-primary',
        success: 'text-hl-success',
        warning: 'text-hl-warning',
        danger: 'text-hl-danger',
        strong: 'text-hl-text',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  }
);

export const actionTileVariants = cva(
  'group/action-tile flex min-h-28 flex-col items-center justify-center gap-2 rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface p-4 text-center text-hl-text shadow-hl-subtle transition-[background-color,transform] duration-150 hover:bg-hl-surface-muted focus-visible:outline-none focus-visible:shadow-focus active:scale-[0.98]',
  {
    variants: {
      tone: {
        default: '',
        accent: '',
        warning: '',
        success: '',
        muted: '',
      },
      density: {
        compact: 'min-h-24 p-3',
        default: 'min-h-28 p-4',
        comfortable: 'min-h-32 p-5',
      },
    },
    defaultVariants: {
      tone: 'default',
      density: 'default',
    },
  }
);

export const actionTileIconVariants = cva(
  'flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] transition-colors',
  {
    variants: {
      tone: {
        default: 'bg-hl-surface-muted text-hl-text-muted',
        accent: 'bg-hl-surface-muted text-hl-primary',
        warning: 'bg-[color-mix(in_srgb,var(--hl-warning)_12%,var(--hl-surface))] text-hl-warning',
        success: 'bg-[color-mix(in_srgb,var(--hl-success)_12%,var(--hl-surface))] text-hl-success',
        muted: 'bg-hl-surface-muted text-hl-text-muted',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  }
);

export const documentRowVariants = cva('rounded-[var(--hl-radius-card)] bg-hl-surface p-4 text-hl-text', {
  variants: {
    interactive: {
      true: 'transition-colors hover:bg-hl-surface-muted',
      false: '',
    },
  },
  defaultVariants: {
    interactive: false,
  },
});

export const documentTypeIconVariants = cva(
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)]',
  {
    variants: {
      tone: {
        default: 'bg-hl-surface-muted text-hl-text-muted',
        accent: 'bg-hl-surface-muted text-hl-primary',
        warning: 'bg-[color-mix(in_srgb,var(--hl-warning)_12%,var(--hl-surface))] text-hl-warning',
        success: 'bg-[color-mix(in_srgb,var(--hl-success)_12%,var(--hl-surface))] text-hl-success',
        danger: 'bg-[color-mix(in_srgb,var(--hl-danger)_12%,var(--hl-surface))] text-hl-danger',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  }
);

export const inventoryItemCardVariants = cva(
  'group/inventory cursor-pointer overflow-hidden rounded-[var(--hl-radius-card)] bg-hl-surface text-hl-text transition-[background-color,transform] duration-150 hover:bg-hl-surface-muted active:scale-[0.98]',
  {
    variants: {
      state: {
        default: '',
        lowStock: 'bg-[color-mix(in_srgb,var(--hl-warning)_12%,var(--hl-surface))]',
      },
    },
    defaultVariants: {
      state: 'default',
    },
  }
);

export const inventoryPhotoFrameVariants = cva('relative h-32 overflow-hidden bg-hl-surface-muted', {
  variants: {
    tone: {
      default: '',
      empty: 'bg-hl-surface-muted',
    },
  },
  defaultVariants: {
    tone: 'default',
  },
});

export const serviceOrderCardVariants = cva(
  'group/service-order rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-4 py-3 text-hl-text shadow-hl-subtle transition-[background-color,transform] duration-150 hover:-translate-y-0.5 hover:bg-hl-surface-muted',
  {
    variants: {
      density: {
        compact: 'px-3 py-2',
        default: 'px-4 py-3',
        comfortable: 'px-5 py-4',
      },
      interactive: {
        true: 'cursor-pointer active:scale-[0.99]',
        false: '',
      },
    },
    defaultVariants: {
      density: 'default',
      interactive: false,
    },
  }
);

export const propertySummaryCardVariants = cva('rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface text-hl-text shadow-hl-subtle', {
  variants: {
    density: {
      compact: 'p-4',
      default: 'p-5',
      comfortable: 'p-6',
    },
  },
  defaultVariants: {
    density: 'default',
  },
});

export const propertySummaryItemVariants = cva('rounded-[var(--hl-radius-control)] bg-hl-surface-muted p-3', {
  variants: {
    tone: {
      default: '',
      muted: 'bg-hl-surface',
    },
  },
  defaultVariants: {
    tone: 'default',
  },
});

export const emptyStateVariants = cva(
  'flex flex-col items-center justify-center rounded-[var(--hl-radius-card)] bg-hl-surface px-6 py-12 text-center text-hl-text',
  {
    variants: {
      tone: {
        default: '',
        subtle:  'border border-hl-border shadow-hl-subtle',
        strong:  'bg-hl-surface-muted',
      },
      density: {
        compact: 'py-8',
        default: 'py-12',
        spacious: 'py-16',
      },
    },
    defaultVariants: {
      tone: 'default',
      density: 'default',
    },
  }
);

export const chatPanelVariants = cva(
  'min-h-56 max-h-[24rem] overflow-y-auto rounded-[var(--hl-radius-card)] border border-hl-border p-3 text-hl-text sm:p-4',
  {
    variants: {
      tone: {
        default: 'bg-hl-surface-muted',
        subtle: 'bg-hl-surface',
      },
      density: {
        compact: 'space-y-2',
        default: 'space-y-3',
      },
    },
    defaultVariants: {
      tone: 'default',
      density: 'default',
    },
  }
);

export const chatBubbleVariants = cva('max-w-[min(88%,34rem)] rounded-[var(--hl-radius-card)] px-3 py-2 text-sm leading-6', {
  variants: {
    mine: {
      true: 'bg-hl-primary text-white',
      false: 'bg-hl-surface text-hl-text',
    },
  },
  defaultVariants: {
    mine: false,
  },
});
