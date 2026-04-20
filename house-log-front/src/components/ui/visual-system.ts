import { cva } from 'class-variance-authority';

export const surfaceVariants = cva('', {
  variants: {
    tone: {
      page: 'bg-[var(--surface-page)] text-text-primary',
      base: 'bg-[var(--surface-base)] text-text-primary',
      raised: 'bg-[var(--surface-raised)] text-text-primary',
      strong: 'bg-[var(--surface-strong)] text-text-primary',
      glass: 'bg-[var(--surface-glass)] text-text-primary backdrop-blur-[var(--surface-blur)]',
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

export const cardVariants = cva('hl-card text-text-primary', {
  variants: {
    variant: {
      default: '',
      tonal: 'bg-[var(--surface-strong)]',
      section: 'rounded-[var(--radius-xl)] bg-[var(--surface-base)]',
      raised: 'bg-[var(--surface-raised)] shadow-[var(--surface-shadow-raised)]',
      glass: 'bg-[var(--surface-glass)] backdrop-blur-[var(--surface-blur)]',
      interactive: 'card-hover cursor-pointer bg-[var(--surface-base)]',
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
        tonal: 'bg-[var(--button-tonal-bg)] text-[var(--button-tonal-text)] hover:bg-[var(--button-tonal-hover)] focus-visible:shadow-[var(--field-focus-ring)]',
        link: 'h-auto min-h-0 px-0 py-0 text-text-accent underline-offset-4 hover:underline',
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
      outline: 'hl-badge-draft border-half border-border-default bg-bg-surface',
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
  'min-h-11 rounded-[var(--radius-md)] px-4 py-2 text-left text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]',
  {
    variants: {
      active: {
        true: 'bg-[var(--chip-bg-active)] text-[var(--chip-text-active)]',
        false: 'bg-[var(--chip-bg)] text-[var(--chip-text)] hover:bg-[var(--field-bg-hover)]',
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
      tonal: 'bg-[var(--field-bg-hover)]',
      ghost: 'border-transparent bg-transparent hover:bg-[var(--field-bg-hover)]',
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
  'group/sensitive flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--field-bg)] px-3 py-2 text-text-primary transition-all duration-150 focus-within:shadow-[var(--field-focus-ring)] hover:bg-[var(--field-bg-hover)]',
  {
    variants: {
      tone: {
        default: '',
        subtle: 'bg-[var(--surface-base)]',
        strong: 'bg-[var(--surface-strong)]',
      },
      state: {
        masked: 'text-text-secondary',
        revealed: 'text-text-primary',
        empty: 'text-text-tertiary',
      },
    },
    defaultVariants: {
      tone: 'default',
      state: 'masked',
    },
  }
);

export const pageHeaderVariants = cva('flex flex-col gap-3 text-text-primary', {
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
      surface: 'rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4',
      strong: 'rounded-[var(--radius-xl)] bg-[var(--surface-strong)] p-4',
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
  'rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4 text-text-primary transition-all duration-150',
  {
    variants: {
      tone: {
        default: '',
        accent: 'bg-bg-accent-subtle',
        success: 'bg-bg-success',
        warning: 'bg-bg-warning',
        danger: 'bg-bg-danger',
        strong: 'bg-[var(--surface-strong)]',
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
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)]',
  {
    variants: {
      tone: {
        default: 'bg-[var(--surface-strong)] text-text-secondary',
        accent: 'bg-bg-accent-subtle text-text-accent',
        success: 'bg-bg-success text-text-success',
        warning: 'bg-bg-warning text-text-warning',
        danger: 'bg-bg-danger text-text-danger',
        strong: 'bg-[var(--surface-strong)] text-text-primary',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  }
);

export const actionTileVariants = cva(
  'group/action-tile flex min-h-28 flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-4 text-center text-text-primary transition-all duration-150 hover:bg-[var(--field-bg-hover)] focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)] active:scale-[0.98]',
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
        default: 'bg-[var(--surface-strong)] text-text-primary',
        accent: 'bg-bg-accent-subtle text-text-accent',
        warning: 'bg-bg-warning text-text-warning',
        success: 'bg-bg-success text-text-success',
        muted: 'bg-bg-subtle text-text-secondary',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  }
);

export const documentRowVariants = cva('rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4 text-text-primary', {
  variants: {
    interactive: {
      true: 'transition-colors hover:bg-[var(--field-bg-hover)]',
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
        default: 'bg-bg-subtle text-text-secondary',
        accent: 'bg-bg-accent-subtle text-text-accent',
        warning: 'bg-bg-warning text-text-warning',
        success: 'bg-bg-success text-text-success',
        danger: 'bg-bg-danger text-text-danger',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  }
);

export const inventoryItemCardVariants = cva(
  'group/inventory cursor-pointer overflow-hidden rounded-[var(--radius-xl)] bg-[var(--surface-base)] text-text-primary transition-all duration-150 hover:bg-[var(--field-bg-hover)] active:scale-[0.98]',
  {
    variants: {
      state: {
        default: '',
        lowStock: 'bg-bg-warning',
      },
    },
    defaultVariants: {
      state: 'default',
    },
  }
);

export const inventoryPhotoFrameVariants = cva('relative h-32 overflow-hidden bg-bg-subtle', {
  variants: {
    tone: {
      default: '',
      empty: 'bg-[var(--surface-strong)]',
    },
  },
  defaultVariants: {
    tone: 'default',
  },
});

export const serviceOrderCardVariants = cva(
  'group/service-order rounded-[var(--radius-xl)] bg-[var(--surface-base)] px-4 py-3 text-text-primary transition-all duration-150 hover:bg-[var(--field-bg-hover)]',
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

export const propertySummaryCardVariants = cva('rounded-[var(--radius-xl)] bg-[var(--surface-base)] text-text-primary', {
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

export const propertySummaryItemVariants = cva('rounded-[var(--radius-lg)] bg-[var(--surface-strong)] p-3', {
  variants: {
    tone: {
      default: '',
      muted: 'bg-[var(--surface-base)]',
    },
  },
  defaultVariants: {
    tone: 'default',
  },
});

export const emptyStateVariants = cva(
  'flex flex-col items-center justify-center rounded-[var(--radius-xl)] bg-[var(--surface-base)] px-6 py-12 text-center text-text-primary',
  {
    variants: {
      tone: {
        default: '',
        subtle: 'bg-[var(--surface-base)]',
        strong: 'bg-[var(--surface-strong)]',
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
  'min-h-56 max-h-[24rem] overflow-y-auto rounded-[var(--radius-xl)] p-3 text-text-primary sm:p-4',
  {
    variants: {
      tone: {
        default: 'bg-[var(--surface-strong)]',
        subtle: 'bg-[var(--surface-base)]',
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

export const chatBubbleVariants = cva('max-w-[min(88%,34rem)] rounded-[var(--radius-lg)] px-3 py-2 text-sm leading-6', {
  variants: {
    mine: {
      true: 'bg-[var(--interactive-primary-bg)] text-[var(--interactive-primary-text)]',
      false: 'bg-[var(--surface-base)] text-text-primary',
    },
  },
  defaultVariants: {
    mine: false,
  },
});
