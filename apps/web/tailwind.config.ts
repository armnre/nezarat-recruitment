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
        sidebar: { DEFAULT: c('sidebar'), foreground: c('sidebar-foreground'), muted: c('sidebar-muted'), active: c('sidebar-active') },
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: { 'fade-up': 'fade-up .28s ease-out both', 'fade-in': 'fade-in .2s ease-out both' },
      borderRadius: { lg: 'var(--radius)', md: 'calc(var(--radius) - 2px)', sm: 'calc(var(--radius) - 4px)' },
      boxShadow: { card: 'var(--shadow-card)', raised: 'var(--shadow-raised)' },
    },
  },
  plugins: [],
} satisfies Config;
