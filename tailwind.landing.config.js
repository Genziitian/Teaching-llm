/**
 * Legacy-style Tailwind config used ONLY by src/landing/landing.css (via @config).
 * Scoping of utilities is done by postcss-landing-scope.cjs (the `important` option is not honoured
 * by Tailwind v4's @config compat layer, so it is intentionally not relied on).
 */
module.exports = {
  content: ['./src/landing/**/*.{ts,tsx}', './src/app/(landing)/**/*.{ts,tsx}'],
};
