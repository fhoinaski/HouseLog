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
      raised: 'bg-[var(--surface-raised)] shadow-[var(--surface-shadow-raised)]',
      glass: 'bg-[var(--surface-glass)] backdrop-blur-[var(--surface-blur)]',
      interactive: 'card-hover cursor-pointer bg-[var(--surface-base)]',
    },
    density: {
      compact: '[--card-padding:12px]',
      default: '',
      comfortable: '[--card-padding:20px]',
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
