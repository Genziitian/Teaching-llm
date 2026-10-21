/**
 * Apple-style surface for the Support, Tickets and Community pages.
 * Styling only: it re-skins the existing elements (neumorphic shadows -> soft
 * layered shadows with hairline borders, system type, press feedback,
 * translucent modal scrim) and never touches page logic or data.
 * Scope: anything inside an element with the `apple-ui` class.
 */
const CSS = `
.apple-ui {
  --apple-hairline: rgba(60, 60, 67, 0.14);
  --apple-grouped: #f2f2f7;
  --apple-shadow: 0 1px 2px rgba(16, 24, 40, 0.05), 0 6px 20px rgba(16, 24, 40, 0.06);
  --apple-shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.06), 0 2px 8px rgba(16, 24, 40, 0.05);
  --apple-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
:root[data-theme="dark"] .apple-ui { --apple-hairline: rgba(255, 255, 255, 0.10); --apple-shadow: 0 1px 2px rgba(0,0,0,.35), 0 8px 24px rgba(0,0,0,.35); --apple-shadow-sm: 0 1px 2px rgba(0,0,0,.4), 0 2px 8px rgba(0,0,0,.3); }
:root[data-theme="black"] .apple-ui { --apple-hairline: rgba(255, 255, 255, 0.12); --apple-shadow: 0 1px 2px rgba(0,0,0,.6), 0 8px 24px rgba(0,0,0,.6); --apple-shadow-sm: 0 1px 2px rgba(0,0,0,.6), 0 2px 8px rgba(0,0,0,.5); }

/* Light theme: flat white cards on a grouped background instead of grey neumorphism */
:root:not([data-theme="dark"]):not([data-theme="black"]) .apple-ui {
  --surface: #ffffff;
  --surface-2: #f2f2f7;
  --neu-light: transparent;
  --neu-dark: rgba(16, 24, 40, 0.10);
  --text-primary: #1d1d1f;
  --text-secondary: #6e6e73;
  --text-muted: #8e8e93;
}

/* Headings: tighter tracking as size grows */
.apple-ui h1, .apple-ui h2 { letter-spacing: -0.022em; }
.apple-ui h3, .apple-ui h4 { letter-spacing: -0.012em; }

/* Neumorphic raised elements -> soft layered shadow + hairline */
.apple-ui [style*="--neu-dark"]:not([style*="inset"]) {
  box-shadow: var(--apple-shadow-sm) !important;
  border: 0.5px solid var(--apple-hairline) !important;
}
/* Neumorphic pressed/inset fields -> quiet filled field */
.apple-ui [style*="inset"][style*="--neu-dark"] {
  box-shadow: none !important;
  background: var(--surface-2) !important;
  border: 0.5px solid var(--apple-hairline) !important;
}

/* Big cards */
.apple-ui .faq-card-col,
.apple-ui .ticket-box-pad,
.apple-ui .chat-box-pad,
.apple-ui .community-secondary-panel,
.apple-ui .community-courses-panel {
  border: 0.5px solid var(--apple-hairline);
  box-shadow: var(--apple-shadow) !important;
}

/* Live sessions: row cards (no more full pills), hairline + soft shadow */
.apple-ui .live-row-card {
  border: 0.5px solid var(--apple-hairline);
  box-shadow: var(--apple-shadow-sm) !important;
}
:root:not([data-theme="dark"]):not([data-theme="black"]) .apple-ui .live-row-card { background: #ffffff !important; }
@media (hover: hover) { .apple-ui .live-row-card:hover { box-shadow: var(--apple-shadow) !important; } }

/* Inputs */
.apple-ui .form-input, .apple-ui textarea, .apple-ui select {
  border: 0.5px solid var(--apple-hairline);
  border-radius: 12px;
  transition: box-shadow 0.2s var(--apple-ease), border-color 0.2s var(--apple-ease);
}
.apple-ui .form-input:focus, .apple-ui textarea:focus, .apple-ui select:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--primary) 60%, transparent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 16%, transparent);
}

/* Buttons: instant press feedback, 44px touch target for text buttons */
.apple-ui button, .apple-ui .btn {
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  transition: transform 0.18s var(--apple-ease), opacity 0.18s var(--apple-ease), box-shadow 0.2s var(--apple-ease), background-color 0.2s var(--apple-ease);
}
.apple-ui button:not(:disabled):active, .apple-ui .btn:not(:disabled):active { transform: scale(0.97); }
.apple-ui .btn { border-radius: 12px; font-weight: 600; letter-spacing: -0.005em; }
@media (pointer: coarse) { .apple-ui .btn { min-height: 44px; } }
.apple-ui button:focus-visible, .apple-ui .btn:focus-visible, .apple-ui a:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--primary) 70%, transparent);
  outline-offset: 2px;
}

/* Modals: translucent scrim, spring-in sheet (light theme; dark themes keep their own rules) */
.apple-ui .modal-overlay {
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  backdrop-filter: blur(14px) saturate(160%);
}
:root:not([data-theme="dark"]):not([data-theme="black"]) .apple-ui .modal-overlay { background: rgba(0, 0, 0, 0.28); }
.apple-ui .modal {
  border-radius: 22px;
  border: 0.5px solid var(--apple-hairline);
  animation: appleSheetIn 0.36s var(--apple-ease);
}
:root:not([data-theme="dark"]):not([data-theme="black"]) .apple-ui .modal { box-shadow: 0 24px 64px rgba(0, 0, 0, 0.22); }
@keyframes appleSheetIn { from { opacity: 0; transform: translateY(14px) scale(0.985); } }

/* Community chat: calm background instead of the doodle wallpaper */
:root:not([data-theme="dark"]):not([data-theme="black"]) .apple-ui .chat-wallpaper { background-image: none !important; background-color: var(--apple-grouped) !important; }
:root[data-theme="dark"] .apple-ui .chat-wallpaper { background-image: none !important; background-color: #0e0e14 !important; }
:root[data-theme="black"] .apple-ui .chat-wallpaper { background-image: none !important; background-color: #000 !important; }
.apple-ui .chat-msg-bubble { box-shadow: 0 1px 1px rgba(16, 24, 40, 0.06) !important; }

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .apple-ui *, .apple-ui *::before, .apple-ui *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
  .apple-ui button:not(:disabled):active, .apple-ui .btn:not(:disabled):active { transform: none; }
}
@media (prefers-reduced-transparency: reduce) {
  .apple-ui .modal-overlay { -webkit-backdrop-filter: none; backdrop-filter: none; background: rgba(0, 0, 0, 0.45) !important; }
}
@media (prefers-contrast: more) {
  .apple-ui { --apple-hairline: rgba(60, 60, 67, 0.45); }
}
`

export default function AppleSurface() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />
}
