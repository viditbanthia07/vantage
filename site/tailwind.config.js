import consoleTheme from '../frontend/tailwind.config.js';

/**
 * The console's design system, extended rather than restated.
 *
 * The palette, the type stack and the six-step scale are imported from
 * `frontend/tailwind.config.js` verbatim. A marketing page in a different visual
 * language than the product it sells is a page that introduces the product
 * twice, and a second copy of the tokens is a second copy that goes stale.
 *
 * What is added here is only what a page needs and a console does not: sizes
 * above `display`, which tops out at 24px because that is as large as anything
 * should be in an instrument, and a viewport-relative headline size for a beat
 * that fills the screen.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // Beat 4 renders the console's own TrendChart, so its classes have to be
    // scanned or they are purged out of the stylesheet.
    '../frontend/src/features/analytics/**/*.tsx',
    '../frontend/src/components/common/**/*.tsx',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      ...consoleTheme.theme.extend,
      fontSize: {
        ...consoleTheme.theme.extend.fontSize,
        // A page is read at arm's length once; a console is read for eight
        // hours. These three exist only above the fold.
        'lead': ['clamp(1rem, 3.6vw, 1.25rem)', { lineHeight: '1.55', letterSpacing: '-0.01em' }],
        'beat': ['clamp(1.75rem, 4.5vw, 3.25rem)', { lineHeight: '1.08', letterSpacing: '-0.03em' }],
        'hero': ['clamp(2rem, 5.1vw, 4rem)', { lineHeight: '1.02', letterSpacing: '-0.035em' }],
      },
      maxWidth: {
        prose: '38rem',
        beat: '64rem',
      },
    },
  },
  plugins: [],
};
