// tailwind.config.ts
// ============================================================
// HOUSELOG — Tailwind Config
// Consome 100% das CSS variables do tokens.css
// Não coloque valores mágicos aqui. Tudo vem dos tokens.
// ============================================================

import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'
import plugin from 'tailwindcss/plugin'

const config: Config = {
  darkMode: 'class',  // usa classe .dark no <html>
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    // -------------------------------------------------------
    // CORES — mapeadas dos tokens semânticos
    // Use: bg-surface, text-primary, border-default, etc.
    // -------------------------------------------------------
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#FFFFFF',
      black: '#000000',

      // Backgrounds
      bg: {
        page:            'var(--bg-page)',
        surface:         'var(--bg-surface)',
        'surface-raised':'var(--bg-surface-raised)',
        'surface-overlay':'var(--bg-surface-overlay)',
        subtle:          'var(--bg-subtle)',
        muted:           'var(--bg-muted)',
        accent:          'var(--bg-accent)',
        'accent-subtle': 'var(--bg-accent-subtle)',
        'accent-muted':  'var(--bg-accent-muted)',
        brand:           'var(--bg-brand)',
        'brand-hover':   'var(--bg-brand-hover)',
        'brand-subtle':  'var(--bg-brand-subtle)',
        danger:          'var(--bg-danger)',
        'danger-emphasis':'var(--bg-danger-emphasis)',
        warning:         'var(--bg-warning)',
        'warning-emphasis':'var(--bg-warning-emphasis)',
        success:         'var(--bg-success)',
        'success-emphasis':'var(--bg-success-emphasis)',
        info:            'var(--bg-info)',
        'info-emphasis': 'var(--bg-info-emphasis)',
      },

      // Text
      text: {
        primary:        'var(--text-primary)',
        secondary:      'var(--text-secondary)',
        tertiary:       'var(--text-tertiary)',
        disabled:       'var(--text-disabled)',
        inverse:        'var(--text-inverse)',
        'on-accent':    'var(--text-on-accent)',
        accent:         'var(--text-accent)',
        'accent-subtle':'var(--text-accent-subtle)',
        brand:          'var(--text-brand)',
        danger:         'var(--text-danger)',
        warning:        'var(--text-warning)',
        success:        'var(--text-success)',
        info:           'var(--text-info)',
      },

      // Borders
      border: {
        default:  'var(--border-default)',
        subtle:   'var(--border-subtle)',
        strong:   'var(--border-strong)',
        focus:    'var(--border-focus)',
        accent:   'var(--border-accent)',
        danger:   'var(--border-danger)',
        warning:  'var(--border-warning)',
        success:  'var(--border-success)',
      },

      // Interactive
      interactive: {
        'primary-bg':       'var(--interactive-primary-bg)',
        'primary-hover':    'var(--interactive-primary-hover)',
        'primary-active':   'var(--interactive-primary-active)',
        'primary-text':     'var(--interactive-primary-text)',
        'accent-bg':        'var(--interactive-accent-bg)',
        'accent-hover':     'var(--interactive-accent-hover)',
        'accent-active':    'var(--interactive-accent-active)',
        'accent-text':      'var(--interactive-accent-text)',
        'secondary-bg':     'var(--interactive-secondary-bg)',
        'secondary-hover':  'var(--interactive-secondary-hover)',
        'secondary-active': 'var(--interactive-secondary-active)',
        'secondary-border': 'var(--interactive-secondary-border)',
        'secondary-text':   'var(--interactive-secondary-text)',
        'ghost-hover':      'var(--interactive-ghost-hover)',
        'ghost-active':     'var(--interactive-ghost-active)',
        'danger-bg':        'var(--interactive-danger-bg)',
        'danger-hover':     'var(--interactive-danger-hover)',
        'danger-text':      'var(--interactive-danger-text)',
      },

      // Nav
      nav: {
        bg:             'var(--nav-bg)',
        'text-active':  'var(--nav-text-active)',
        'text-inactive':'var(--nav-text-inactive)',
        border:         'var(--nav-border)',
      },

      // Components
      card: {
        bg:           'var(--card-bg)',
        border:       'var(--card-border)',
        'border-hover':'var(--card-border-hover)',
        'urgent-bg':  'var(--card-urgent-bg)',
        'urgent-border':'var(--card-urgent-border)',
      },

      input: {
        bg:               'var(--input-bg)',
        'bg-disabled':    'var(--input-bg-disabled)',
        border:           'var(--input-border)',
        'border-hover':   'var(--input-border-hover)',
        'border-focus':   'var(--input-border-focus)',
        'border-error':   'var(--input-border-error)',
        text:             'var(--input-text)',
        placeholder:      'var(--input-placeholder)',
      },

      chip: {
        bg:          'var(--chip-bg)',
        'bg-active': 'var(--chip-bg-active)',
        text:        'var(--chip-text)',
        'text-active':'var(--chip-text-active)',
        border:      'var(--chip-border)',
      },

      fab: {
        bg:    'var(--fab-bg)',
        hover: 'var(--fab-hover)',
        text:  'var(--fab-text)',
      },

      toast: {
        bg:   'var(--toast-bg)',
        text: 'var(--toast-text)',
      },

      skeleton: {
        base:  'var(--skeleton-base)',
        shine: 'var(--skeleton-shine)',
      },
    },

    // -------------------------------------------------------
    // TIPOGRAFIA
    // -------------------------------------------------------
    fontFamily: {
      sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
    },
    fontSize: {
      xs:   ['11px', { lineHeight: '16px' }],
      sm:   ['13px', { lineHeight: '18px' }],
      base: ['14px', { lineHeight: '20px' }],
      md:   ['15px', { lineHeight: '22px' }],
      lg:   ['17px', { lineHeight: '24px' }],
      xl:   ['20px', { lineHeight: '28px' }],
      '2xl':['24px', { lineHeight: '32px' }],
      '3xl':['30px', { lineHeight: '38px' }],
    },
    fontWeight: {
      regular:  '400',
      medium:   '500',
      semibold: '600',
    },
    letterSpacing: {
      tight:  '-0.01em',
      normal: '0',
      wide:   '0.04em',
      wider:  '0.08em',
    },
    lineHeight: {
      tight:   '1.25',
      snug:    '1.375',
      normal:  '1.5',
      relaxed: '1.625',
    },

    // -------------------------------------------------------
    // BORDER RADIUS
    // -------------------------------------------------------
    borderRadius: {
      none: '0',
      xs:   'var(--radius-xs)',
      sm:   'var(--radius-sm)',
      md:   'var(--radius-md)',
      lg:   'var(--radius-lg)',
      xl:   'var(--radius-xl)',
      '2xl':'var(--radius-2xl)',
      full: 'var(--radius-full)',
    },

    // -------------------------------------------------------
    // SOMBRAS
    // -------------------------------------------------------
    boxShadow: {
      none:         'none',
      xs:           'var(--shadow-xs)',
      sm:           'var(--shadow-sm)',
      md:           'var(--shadow-md)',
      lg:           'var(--shadow-lg)',
      xl:           'var(--shadow-xl)',
      focus:        'var(--shadow-focus)',
      'focus-danger':'var(--shadow-focus-danger)',
      'focus-accent':'var(--shadow-focus-accent)',
    },

    // -------------------------------------------------------
    // ESPAÇAMENTO — usa escala do tokens.css
    // -------------------------------------------------------
    spacing: {
      ...defaultTheme.spacing,
      '0':  '0',
      '0.75': '3px',
      '1':  'var(--space-1)',   // 4px
      '2':  'var(--space-2)',   // 8px
      '3':  'var(--space-3)',   // 12px
      '4':  'var(--space-4)',   // 16px
      '4.5': '18px',
      '5':  'var(--space-5)',   // 20px
      '6':  'var(--space-6)',   // 24px
      '8':  'var(--space-8)',   // 32px
      '10': 'var(--space-10)',  // 40px
      '12': 'var(--space-12)', // 48px
      '13': '52px',
      '16': 'var(--space-16)', // 64px
      '97.5': '390px',
      // Sizes específicos de componentes
      'nav-top':    'var(--nav-height-top)',     // 52px
      'nav-bottom': 'var(--nav-height-bottom)',  // 60px
      'input-sm':   'var(--input-height-sm)',    // 36px
      'input-md':   'var(--input-height-md)',    // 44px
      'input-lg':   'var(--input-height-lg)',    // 52px
      'fab':        'var(--fab-size)',            // 56px
      'avatar-sm':  'var(--avatar-sm)',           // 28px
      'avatar-md':  'var(--avatar-md)',           // 36px
      'avatar-lg':  'var(--avatar-lg)',           // 44px
      'avatar-xl':  'var(--avatar-xl)',           // 56px
    },

    // -------------------------------------------------------
    // TRANSIÇÕES
    // -------------------------------------------------------
    transitionDuration: {
      fast:   '100ms',
      base:   '150ms',
      slow:   '250ms',
      spring: '200ms',
    },
    transitionTimingFunction: {
      base:   'ease',
      spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    },

    // -------------------------------------------------------
    // Z-INDEX
    // -------------------------------------------------------
    zIndex: {
      base:     '0',
      raised:   '10',
      dropdown: '200',
      sticky:   '300',
      overlay:  '400',
      modal:    '500',
      toast:    '600',
      tooltip:  '700',
    },

    extend: {
      // Animações personalizadas
      animation: {
        'fade-in':  'fade-in 200ms ease forwards',
        'slide-up': 'slide-up 250ms ease forwards',
        'slide-in-right': 'slide-in-right 200ms ease forwards',
        'skeleton': 'skeleton-pulse 1.5s ease-in-out infinite',
        'spin-fast':'spin 400ms linear infinite',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
        'skeleton-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
      },

      // Altura da linha de conteúdo (descontando navbars)
      height: {
        'screen-content': 'calc(100dvh - var(--nav-height-top) - var(--nav-height-bottom))',
        'screen-top':     'calc(100dvh - var(--nav-height-top))',
      },
      maxWidth: {
        '97.5': '390px',
      },

      // Bordas especiais de componente
      borderWidth: {
        '0.5': '0.5px',
        '3':   '3px',
      },
    },
  },
  plugins: [
    // Plugin para utilities de componentes específicos do HouseLog
    plugin(function({
      addUtilities,
      addComponents,
    }) {

      // ---- COMPONENTES ----
      addComponents({

        // Card base
        '.hl-card': {
          backgroundColor: 'var(--card-bg)',
          borderRadius:    'var(--card-radius)',
          border:          '0.5px solid var(--card-border)',
          boxShadow:       'var(--card-shadow)',
          padding:         'var(--card-padding)',
          transition:      'border-color var(--transition-base), box-shadow var(--transition-base)',
          '&:hover': {
            borderColor: 'var(--card-border-hover)',
            boxShadow:   'var(--card-shadow-hover)',
          },
        },

        // Card clicável
        '.hl-card-interactive': {
          cursor: 'pointer',
          '&:active': {
            transform: 'scale(0.99)',
          },
        },

        // Card de urgência (aprovação pendente)
        '.hl-card-urgent': {
          backgroundColor: 'var(--card-urgent-bg)',
          borderRadius:    'var(--card-radius)',
          border:          '0.5px solid var(--card-urgent-border)',
          borderLeft:      'var(--card-urgent-accent)',
          padding:         'var(--card-padding)',
        },

        // Botão primário (carvão escuro)
        '.hl-btn-primary': {
          display:         'inline-flex',
          alignItems:      'center',
          justifyContent:  'center',
          gap:             '6px',
          backgroundColor: 'var(--interactive-primary-bg)',
          color:           'var(--interactive-primary-text)',
          borderRadius:    'var(--radius-md)',
          fontSize:        'var(--text-sm)',
          fontWeight:      'var(--font-medium)',
          fontFamily:      'var(--font-sans)',
          height:          'var(--input-height-md)',
          paddingLeft:     '16px',
          paddingRight:    '16px',
          border:          'none',
          cursor:          'pointer',
          transition:      'background-color var(--transition-base), transform var(--transition-fast)',
          whiteSpace:      'nowrap',
          '&:hover': {
            backgroundColor: 'var(--interactive-primary-hover)',
          },
          '&:active': {
            backgroundColor: 'var(--interactive-primary-active)',
            transform:       'scale(0.98)',
          },
          '&:focus-visible': {
            outline:   'none',
            boxShadow: 'var(--shadow-focus)',
          },
          '&:disabled': {
            opacity:       '0.4',
            cursor:        'not-allowed',
            pointerEvents: 'none',
          },
        },

        // Botão accent (terracota)
        '.hl-btn-accent': {
          display:         'inline-flex',
          alignItems:      'center',
          justifyContent:  'center',
          gap:             '6px',
          backgroundColor: 'var(--interactive-accent-bg)',
          color:           'var(--interactive-accent-text)',
          borderRadius:    'var(--radius-md)',
          fontSize:        'var(--text-sm)',
          fontWeight:      'var(--font-medium)',
          fontFamily:      'var(--font-sans)',
          height:          'var(--input-height-md)',
          paddingLeft:     '16px',
          paddingRight:    '16px',
          border:          'none',
          cursor:          'pointer',
          transition:      'background-color var(--transition-base), transform var(--transition-fast)',
          '&:hover': {
            backgroundColor: 'var(--interactive-accent-hover)',
          },
          '&:active': {
            backgroundColor: 'var(--interactive-accent-active)',
            transform:       'scale(0.98)',
          },
          '&:focus-visible': {
            outline:   'none',
            boxShadow: 'var(--shadow-focus-accent)',
          },
          '&:disabled': {
            opacity:       '0.4',
            cursor:        'not-allowed',
            pointerEvents: 'none',
          },
        },

        // Botão secondary (outline)
        '.hl-btn-secondary': {
          display:         'inline-flex',
          alignItems:      'center',
          justifyContent:  'center',
          gap:             '6px',
          backgroundColor: 'var(--interactive-secondary-bg)',
          color:           'var(--interactive-secondary-text)',
          borderRadius:    'var(--radius-md)',
          fontSize:        'var(--text-sm)',
          fontWeight:      'var(--font-medium)',
          fontFamily:      'var(--font-sans)',
          height:          'var(--input-height-md)',
          paddingLeft:     '16px',
          paddingRight:    '16px',
          border:          '0.5px solid var(--interactive-secondary-border)',
          cursor:          'pointer',
          transition:      'background-color var(--transition-base), transform var(--transition-fast)',
          '&:hover': {
            backgroundColor: 'var(--interactive-secondary-hover)',
          },
          '&:active': {
            backgroundColor: 'var(--interactive-secondary-active)',
            transform:       'scale(0.98)',
          },
          '&:focus-visible': {
            outline:   'none',
            boxShadow: 'var(--shadow-focus)',
          },
          '&:disabled': {
            opacity:       '0.4',
            cursor:        'not-allowed',
            pointerEvents: 'none',
          },
        },

        // Botão ghost
        '.hl-btn-ghost': {
          display:         'inline-flex',
          alignItems:      'center',
          justifyContent:  'center',
          gap:             '6px',
          backgroundColor: 'transparent',
          color:           'var(--text-secondary)',
          borderRadius:    'var(--radius-md)',
          fontSize:        'var(--text-sm)',
          fontWeight:      'var(--font-medium)',
          fontFamily:      'var(--font-sans)',
          height:          'var(--input-height-md)',
          paddingLeft:     '12px',
          paddingRight:    '12px',
          border:          'none',
          cursor:          'pointer',
          transition:      'background-color var(--transition-base), color var(--transition-base)',
          '&:hover': {
            backgroundColor: 'var(--interactive-ghost-hover)',
            color:           'var(--text-primary)',
          },
          '&:active': {
            backgroundColor: 'var(--interactive-ghost-active)',
          },
        },

        // Botão danger
        '.hl-btn-danger': {
          display:         'inline-flex',
          alignItems:      'center',
          justifyContent:  'center',
          gap:             '6px',
          backgroundColor: 'var(--interactive-danger-bg)',
          color:           'var(--interactive-danger-text)',
          borderRadius:    'var(--radius-md)',
          fontSize:        'var(--text-sm)',
          fontWeight:      'var(--font-medium)',
          fontFamily:      'var(--font-sans)',
          height:          'var(--input-height-md)',
          paddingLeft:     '16px',
          paddingRight:    '16px',
          border:          'none',
          cursor:          'pointer',
          transition:      'background-color var(--transition-base), transform var(--transition-fast)',
          '&:hover': {
            backgroundColor: 'var(--interactive-danger-hover)',
          },
          '&:active': {
            transform: 'scale(0.98)',
          },
          '&:focus-visible': {
            outline:   'none',
            boxShadow: 'var(--shadow-focus-danger)',
          },
        },

        // Input base
        '.hl-input': {
          display:         'block',
          width:           '100%',
          height:          'var(--input-height-md)',
          paddingLeft:     'var(--input-padding-x)',
          paddingRight:    'var(--input-padding-x)',
          backgroundColor: 'var(--input-bg)',
          color:           'var(--input-text)',
          borderRadius:    'var(--input-radius)',
          border:          '0.5px solid var(--input-border)',
          fontSize:        'var(--input-font-size)',
          fontFamily:      'var(--font-sans)',
          lineHeight:      'var(--leading-normal)',
          outline:         'none',
          transition:      'border-color var(--transition-base), box-shadow var(--transition-base)',
          '&::placeholder': {
            color: 'var(--input-placeholder)',
          },
          '&:hover': {
            borderColor: 'var(--input-border-hover)',
          },
          '&:focus': {
            borderColor: 'var(--input-border-focus)',
            boxShadow:   'var(--input-shadow-focus)',
          },
          '&:disabled': {
            backgroundColor: 'var(--input-bg-disabled)',
            opacity:         '0.6',
            cursor:          'not-allowed',
          },
          '&[aria-invalid="true"]': {
            borderColor: 'var(--input-border-error)',
            boxShadow:   'var(--shadow-focus-danger)',
          },
        },

        // Textarea
        '.hl-textarea': {
          display:         'block',
          width:           '100%',
          minHeight:       '80px',
          paddingLeft:     'var(--input-padding-x)',
          paddingRight:    'var(--input-padding-x)',
          paddingTop:      '10px',
          paddingBottom:   '10px',
          backgroundColor: 'var(--input-bg)',
          color:           'var(--input-text)',
          borderRadius:    'var(--input-radius)',
          border:          '0.5px solid var(--input-border)',
          fontSize:        'var(--input-font-size)',
          fontFamily:      'var(--font-sans)',
          lineHeight:      'var(--leading-relaxed)',
          outline:         'none',
          resize:          'vertical',
          transition:      'border-color var(--transition-base), box-shadow var(--transition-base)',
          '&::placeholder': { color: 'var(--input-placeholder)' },
          '&:hover':        { borderColor: 'var(--input-border-hover)' },
          '&:focus': {
            borderColor: 'var(--input-border-focus)',
            boxShadow:   'var(--input-shadow-focus)',
          },
        },

        // Select
        '.hl-select': {
          display:         'block',
          width:           '100%',
          height:          'var(--input-height-md)',
          paddingLeft:     'var(--input-padding-x)',
          paddingRight:    '36px',
          backgroundColor: 'var(--input-bg)',
          color:           'var(--input-text)',
          borderRadius:    'var(--input-radius)',
          border:          '0.5px solid var(--input-border)',
          fontSize:        'var(--input-font-size)',
          fontFamily:      'var(--font-sans)',
          outline:         'none',
          appearance:      'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 7L11 1' stroke='%237A6A60' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundRepeat:   'no-repeat',
          backgroundPosition: 'right 12px center',
          cursor:             'pointer',
          transition:         'border-color var(--transition-base)',
          '&:hover': { borderColor: 'var(--input-border-hover)' },
          '&:focus': {
            borderColor: 'var(--input-border-focus)',
            boxShadow:   'var(--input-shadow-focus)',
          },
        },

        // Label
        '.hl-label': {
          display:      'block',
          fontSize:     'var(--text-sm)',
          fontWeight:   'var(--font-medium)',
          color:        'var(--text-secondary)',
          marginBottom: '6px',
          lineHeight:   'var(--leading-tight)',
        },

        // Error message
        '.hl-error': {
          fontSize:   'var(--text-xs)',
          color:      'var(--text-danger)',
          marginTop:  '4px',
          lineHeight: 'var(--leading-snug)',
        },

        // Hint / helper text
        '.hl-hint': {
          fontSize:   'var(--text-xs)',
          color:      'var(--text-tertiary)',
          marginTop:  '4px',
          lineHeight: 'var(--leading-snug)',
        },

        // Badges de status OS
        '.hl-badge': {
          display:       'inline-flex',
          alignItems:    'center',
          fontSize:      'var(--badge-font-size)',
          fontWeight:    'var(--badge-font-weight)',
          padding:       'var(--badge-padding)',
          borderRadius:  'var(--badge-radius)',
          letterSpacing: 'var(--badge-letter-spacing)',
          whiteSpace:    'nowrap',
        },
        '.hl-badge-pending': {
          backgroundColor: 'var(--bg-warning)',
          color:           'var(--text-warning)',
        },
        '.hl-badge-progress': {
          backgroundColor: 'var(--bg-info)',
          color:           'var(--text-info)',
        },
        '.hl-badge-done': {
          backgroundColor: 'var(--bg-success)',
          color:           'var(--text-success)',
        },
        '.hl-badge-approval': {
          backgroundColor: 'var(--bg-danger)',
          color:           'var(--text-danger)',
        },
        '.hl-badge-draft': {
          backgroundColor: 'var(--bg-subtle)',
          color:           'var(--text-secondary)',
        },
        '.hl-badge-urgent': {
          backgroundColor: 'var(--bg-danger-emphasis)',
          color:           'var(--text-danger)',
        },

        // Chip de filtro
        '.hl-chip': {
          display:         'inline-flex',
          alignItems:      'center',
          gap:             '4px',
          backgroundColor: 'var(--chip-bg)',
          color:           'var(--chip-text)',
          border:          '0.5px solid var(--chip-border)',
          borderRadius:    'var(--chip-radius)',
          padding:         'var(--chip-padding)',
          fontSize:        'var(--chip-font-size)',
          fontWeight:      'var(--font-medium)',
          cursor:          'pointer',
          whiteSpace:      'nowrap',
          transition:      'background-color var(--transition-base), color var(--transition-base)',
          '&.active, &[data-active="true"]': {
            backgroundColor: 'var(--chip-bg-active)',
            color:           'var(--chip-text-active)',
            borderColor:     'var(--chip-bg-active)',
          },
          '&:hover:not(.active)': {
            backgroundColor: 'var(--bg-muted)',
          },
        },

        // Section title (uppercase label acima de seções)
        '.hl-section-title': {
          fontSize:      'var(--text-xs)',
          fontWeight:    'var(--font-medium)',
          color:         'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--tracking-wider)',
          marginBottom:  '8px',
        },

        // Metric card (números grandes de resumo)
        '.hl-metric': {
          backgroundColor: 'var(--bg-subtle)',
          borderRadius:    'var(--radius-md)',
          padding:         '12px',
        },
        '.hl-metric-label': {
          fontSize:     'var(--text-xs)',
          color:        'var(--text-secondary)',
          marginBottom: '2px',
        },
        '.hl-metric-value': {
          fontSize:   'var(--text-xl)',
          fontWeight: 'var(--font-medium)',
          color:      'var(--text-primary)',
          lineHeight: 'var(--leading-tight)',
        },
        '.hl-metric-sub': {
          fontSize:  'var(--text-xs)',
          color:     'var(--text-tertiary)',
          marginTop: '2px',
        },

        // Avatar
        '.hl-avatar': {
          borderRadius: 'var(--radius-full)',
          display:      'inline-flex',
          alignItems:   'center',
          justifyContent: 'center',
          fontWeight:   'var(--font-medium)',
          flexShrink:   '0',
          overflow:     'hidden',
        },
        '.hl-avatar-owner': {
          backgroundColor: 'var(--avatar-owner-bg)',
          color:           'var(--avatar-owner-text)',
        },
        '.hl-avatar-manager': {
          backgroundColor: 'var(--avatar-manager-bg)',
          color:           'var(--avatar-manager-text)',
        },
        '.hl-avatar-provider': {
          backgroundColor: 'var(--avatar-provider-bg)',
          color:           'var(--avatar-provider-text)',
        },

        // Divider
        '.hl-divider': {
          height:          '0.5px',
          backgroundColor: 'var(--divider-color)',
          border:          'none',
          margin:          '0',
        },

        // Skeleton loader
        '.hl-skeleton': {
          backgroundColor: 'var(--skeleton-base)',
          borderRadius:    'var(--radius-sm)',
          animation:       'skeleton-pulse 1.5s ease-in-out infinite',
        },
      })

      // ---- UTILITIES ----
      addUtilities({
        '.safe-bottom': {
          paddingBottom: 'calc(var(--nav-height-bottom) + env(safe-area-inset-bottom))',
        },
        '.safe-top': {
          paddingTop: 'calc(var(--nav-height-top) + env(safe-area-inset-top))',
        },
        '.scroll-hidden': {
          '-ms-overflow-style': 'none',
          'scrollbar-width':    'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
        '.tap-highlight-none': {
          '-webkit-tap-highlight-color': 'transparent',
        },
        '.border-half': {
          borderWidth: '0.5px',
        },
      })
    }),
  ],
}

export default config
