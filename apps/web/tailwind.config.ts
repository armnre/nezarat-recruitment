import type { Config } from 'tailwindcss';

const c = (v: string) => `hsl(var(--${v}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      fontFamily: { sans: ['Vazirmatn', 'Tahoma', 'sans-serif'] },
      colors: {
        background: c('background'), foreground: c('foreground'), border: c('border'), input: c('input'), ring: c('ring'),
        primary: { DEFAULT: c('primary'), foreground: c('primary-foreground') },
        secondary: { DEFAULT: c('secondary'), foreground: c('secondary-foreground') },
        accent: { DEFAULT: c('accent'), foreground: c('accent-foreground') },
        muted: { DEFAULT: c('muted'), foreground: c('muted-foreground') },
        destructive: { DEFAULT: c('destructive'), foreground: c('destructive-foreground') },
        success: c('success'), warning: c('warning'),
        card: { DEFAULT: c('card'), foreground: c('card-foreground') },
      },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
      boxShadow: { card: 'var(--shadow-card)' },
    },
  },
  plugins: [],
} satisfies Config;
