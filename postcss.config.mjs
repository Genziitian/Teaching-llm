// Tailwind v4 is used ONLY for src/landing/landing.css (imported from src/app/(landing)/layout.tsx).
// class genz global CSS contains no Tailwind directives, so it passes through untouched.
// postcss-landing-scope.cjs then scopes/unlayers the compiled landing CSS (see that file).
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
    './postcss-landing-scope.cjs': {},
  },
};

export default config;
