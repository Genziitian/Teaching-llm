/**
 * Post-processor that only touches src/landing/landing.css (the compiled Tailwind output).
 *  1. Unwraps every `@layer x { ... }` so the landing CSS is un-layered. The class app's global CSS is
 *     un-layered, and un-layered rules always beat layered ones, so layered landing CSS would lose to
 *     class rules such as `button {}` or `.flex {}`. Un-layered, landing wins by specificity.
 *  2. Scopes every remaining selector under .landing-root and re-targets `:root` / `:host` (Tailwind theme variables) to `.landing-root`.
 *  3. Scopes the bare `*, ::before, ::after, ::backdrop` selector of Tailwind's `properties` layer.
 *  4. Renames @keyframes that collide with class genz keyframes (spin, pulse) to landing-* and fixes references.
 */
const S = '.landing-root';
const RENAME = ['spin', 'pulse', 'ping', 'bounce', 'float', 'fadeIn'];

module.exports = () => ({
  postcssPlugin: 'postcss-landing-scope',
  OnceExit(root, { result }) {
    const from = (result.opts && result.opts.from) || (root.source && root.source.input && root.source.input.file) || '';
    if (!/landing[\\/]landing\.css$/.test(from)) return;

    // 1. unwrap layers (innermost-first; statement form `@layer a, b;` removed)
    let again = true;
    while (again) {
      again = false;
      root.walkAtRules('layer', (at) => {
        again = true;
        if (!at.nodes) { at.remove(); return; }
        const inProps = at.params.trim() === 'properties';
        if (inProps) at.walkRules((r) => { r.__props = true; });
        at.replaceWith(at.nodes);
      });
    }

    root.walkRules((rule) => {
      if (rule.parent && rule.parent.type === 'atrule' && /keyframes$/.test(rule.parent.name)) return;
      if (rule.__props) {
        // Tailwind's `properties` fallback: `*, :before, :after, ::backdrop`
        rule.selectors = [S, `${S} *`, `${S}::before`, `${S}::after`, `${S} ::before`, `${S} ::after`, `${S} ::backdrop`];
        return;
      }
      rule.selectors = rule.selectors.map((s) => {
        s = s.trim();
        if (s === ':root' || s === ':host' || s === 'html' || s === 'body') return S;
        // Tailwind v4's legacy `important: '<selector>'` option is not applied by @config, so every
        // generated utility/variant is scoped here instead (descendants of .landing-root).
        return s.startsWith(S) ? s : `${S} ${s}`;
      });
    });

    // 4. keyframe collisions
    const renamed = new Set();
    root.walkAtRules(/keyframes$/, (at) => {
      if (RENAME.includes(at.params.trim())) { renamed.add(at.params.trim()); at.params = 'landing-' + at.params.trim(); }
    });
    if (renamed.size) {
      root.walkDecls((d) => {
        if (/^(animation|animation-name)$/.test(d.prop) || /^--animate/.test(d.prop)) {
          renamed.forEach((n) => { d.value = d.value.replace(new RegExp(`(^|[\\s,])${n}(?=[\\s,]|$)`, 'g'), `$1landing-${n}`); });
        }
      });
    }
  },
});
module.exports.postcss = true;
