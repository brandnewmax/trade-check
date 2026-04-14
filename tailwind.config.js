/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        stripe: {
          purple:       '#533afd',
          purpleHover:  '#4434d4',
          purpleDeep:   '#2e2b8c',
          purpleLight:  '#b9b9f9',
          purpleSoft:   '#d6d9fc',
          navy:         '#061b31',
          navyDeep:     '#0d253d',
          brandDark:    '#1c1e54',
          label:        '#273951',
          body:         '#64748d',
          border:       '#e5edf5',
          ruby:         '#ea2261',
          magenta:      '#f96bee',
          magentaLight: '#ffd7ef',
          success:      '#15be53',
          successText:  '#108c3d',
          lemon:        '#9b6829',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      boxShadow: {
        'stripe-ambient':  '0 3px 6px rgba(23,23,23,0.06)',
        'stripe-card':     '0 15px 35px rgba(23,23,23,0.08)',
        'stripe-elevated': '0 30px 45px -30px rgba(50,50,93,0.25), 0 18px 36px -18px rgba(0,0,0,0.1)',
        'stripe-deep':     '0 14px 21px -14px rgba(3,3,39,0.25), 0 8px 17px -8px rgba(0,0,0,0.1)',
      },
      borderRadius: {
        'stripe-sm': '4px',
        'stripe':    '6px',
        'stripe-lg': '8px',
      },
      fontSize: {
        'display':    ['56px', { lineHeight: '1.03', letterSpacing: '-1.4px',  fontWeight: '300' }],
        'display-lg': ['48px', { lineHeight: '1.15', letterSpacing: '-0.96px', fontWeight: '300' }],
        'heading':    ['32px', { lineHeight: '1.10', letterSpacing: '-0.64px', fontWeight: '300' }],
        'subheading': ['22px', { lineHeight: '1.10', letterSpacing: '-0.22px', fontWeight: '300' }],
        'body-lg':    ['18px', { lineHeight: '1.40', letterSpacing: '0',       fontWeight: '300' }],
        'body':       ['16px', { lineHeight: '1.40', letterSpacing: '0',       fontWeight: '300' }],
        'btn':        ['16px', { lineHeight: '1.00', letterSpacing: '0',       fontWeight: '400' }],
        'link':       ['14px', { lineHeight: '1.00', letterSpacing: '0',       fontWeight: '400' }],
        'caption':    ['13px', { lineHeight: '1.40', letterSpacing: '0',       fontWeight: '400' }],
        'caption-sm': ['12px', { lineHeight: '1.33', letterSpacing: '0',       fontWeight: '400' }],
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-4px)' },
          '40%, 80%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        shake: 'shake 0.3s ease-in-out',
      },
    },
  },
  plugins: [],
}
