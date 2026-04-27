/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        background:               '#0A0A0F',
        surface:                  '#131318',
        'surface-container':      '#12121A',
        'surface-container-low':  '#1b1b20',
        'surface-container-high': '#2a292f',
        'outline-variant':        '#1E1E2E',
        outline:                  '#908fa0',
        'on-surface':             '#e4e1e9',
        'on-surface-variant':     '#c7c4d7',
        primary:                  '#c0c1ff',
        'primary-container':      '#8083ff',
        'inverse-primary':        '#494bd6',
        secondary:                '#5de6ff',
        tertiary:                 '#ffb783',
        error:                    '#ffb4ab',
        // Aliases for existing templates
        border:                   '#1E1E2E',
        accent:                   '#5de6ff',
        warning:                  '#ffb783',
        danger:                   '#ffb4ab',
        success:                  '#34D399',
        'text-primary':           '#e4e1e9',
        'text-secondary':         '#c7c4d7',
        'text-muted':             '#908fa0',
      },
      fontFamily: {
        headline:     ['Space Grotesk', 'sans-serif'],
        body:         ['Inter', 'sans-serif'],
        mono:         ['JetBrains Mono', 'monospace'],
        'label-caps': ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'label-caps': ['12px', { lineHeight: '1', letterSpacing: '0.1em', fontWeight: '600' }],
        'body-sm':    ['14px', { lineHeight: '1.4' }],
        'body-md':    ['16px', { lineHeight: '1.5' }],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        sm:   '0.25rem',
        md:   '0.5rem',
        lg:   '0.75rem',
        xl:   '0.75rem',
        '2xl':'1rem',
        full: '9999px',
      },
      spacing: {
        xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '40px', gutter: '20px',
      },
    },
  },
  plugins: [],
};
