export const MESSAGING_WIDGET_CSS = `
@import url("https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700&family=Open+Sans:wght@400;500;600&display=swap");

:root {
  --pgmu-crimson: #b5121b;
  --pgmu-crimson-deep: #8e0d14;
  --pgmu-ink: #14181d;
  --pgmu-ink-soft: #2b313a;
  --pgmu-stone: #6b7280;
  --pgmu-stone-soft: #9aa1ab;
  --pgmu-hairline: #ececec;
  --pgmu-hairline-strong: #d9dbe0;
  --pgmu-surface: #ffffff;
  --pgmu-radius: 18px;
  --pgmu-radius-sm: 10px;
  --pgmu-control-size: 4rem;
  --pgmu-input-min-height: 6.4rem;
  --pgmu-font-display: "Montserrat", "Helvetica Neue", Arial, sans-serif;
  --pgmu-font-body: "Open Sans", "Segoe UI", Arial, sans-serif;
  --primary-color: var(--pgmu-crimson);
  --text-contrast-color: #ffffff;
  --main-font: var(--pgmu-font-body);
  --font-size-factor: 1;
  --gray-1-color: #f7f7f8;
  --gray-2-color: #eef0f3;
}

@keyframes pgmu-rise {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes pgmu-typing {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
  30%           { transform: translateY(-4px); opacity: 1; }
}

.pgmu-widget,
.pgmu-widget * {
  box-sizing: border-box;
}

.pgmu-widget {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 360px;
  display: flex;
  container-type: inline-size;
  color-scheme: light dark;
  font-family: var(--pgmu-font-body);
  color: var(--pgmu-ink);
  font-size: calc(1.55rem * var(--font-size-factor));
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.pgmu-widget[data-theme="dark"] {
  --pgmu-ink: #f5f7fa;
  --pgmu-ink-soft: #d8dde5;
  --pgmu-stone: #aeb6c2;
  --pgmu-stone-soft: #8e98a6;
  --pgmu-hairline: rgba(255, 255, 255, 0.1);
  --pgmu-hairline-strong: rgba(255, 255, 255, 0.18);
  --pgmu-surface: #15181d;
  --gray-1-color: #20242b;
  --gray-2-color: #2a3038;
  --pgmu-crimson-deep: #e03b45;
}

.pgmu-widget__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.pgmu-widget__loader {
  position: absolute;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  color: var(--pgmu-crimson);
  background: var(--pgmu-surface);
  z-index: 10;
}

.pgmu-widget[data-loading="true"] .pgmu-widget__loader {
  display: flex;
}

.pgmu-widget[data-loading="true"] .pgmu-widget__panel {
  visibility: hidden;
}

.pgmu-widget__loader span {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  background: currentColor;
  animation: pgmu-typing 1.2s ease-in-out infinite;
}

.pgmu-widget__loader span:nth-child(2) { animation-delay: 0.15s; }
.pgmu-widget__loader span:nth-child(3) { animation-delay: 0.3s; }

.pgmu-widget__panel {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--pgmu-surface);
  border: 0;
  border-radius: 0;
  overflow: hidden;
}

/* ---------- Messages list ---------- */

.pgmu-widget__messages {
  flex: 1;
  min-height: 0;
  padding: 2rem 1.8rem 0.6rem;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  scroll-behavior: smooth;
  background: var(--pgmu-surface);
}

.pgmu-widget__messages::-webkit-scrollbar {
  width: 6px;
}
.pgmu-widget__messages::-webkit-scrollbar-thumb {
  background: rgba(20, 24, 29, 0.14);
  border-radius: 999px;
}
.pgmu-widget__messages::-webkit-scrollbar-track {
  background: transparent;
}

/* ---------- Messages ---------- */

.pgmu-widget__message {
  position: relative;
  max-width: 82%;
  padding: 1.05rem 1.4rem;
  border-radius: var(--pgmu-radius);
  font-family: var(--pgmu-font-body);
  font-size: calc(1.45rem * var(--font-size-factor));
  line-height: calc(2.1rem * var(--font-size-factor));
  white-space: pre-wrap;
  word-wrap: break-word;
  animation: pgmu-rise 0.28s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

.pgmu-widget__message--assistant {
  align-self: flex-start;
  background: var(--gray-1-color);
  color: var(--pgmu-ink-soft);
  border-top-left-radius: 6px;
}

.pgmu-widget__message--user {
  align-self: flex-end;
  color: #ffffff;
  background: var(--pgmu-crimson);
  border-top-right-radius: 6px;
}

.pgmu-widget__message--md {
  white-space: normal;
}

.pgmu-widget__message--md > :first-child { margin-top: 0; }
.pgmu-widget__message--md > :last-child { margin-bottom: 0; }

.pgmu-widget__message--md p {
  margin: 0 0 0.6rem;
}

.pgmu-widget__message--md ul {
  margin: 0.2rem 0 0.6rem;
  padding-left: 1.8rem;
}

.pgmu-widget__message--md li {
  margin: 0.2rem 0;
}

.pgmu-widget__message--md h3,
.pgmu-widget__message--md h4 {
  font-family: var(--pgmu-font-display);
  margin: 0.4rem 0 0.4rem;
  color: var(--pgmu-ink);
  line-height: 1.3;
}

.pgmu-widget__message--md h3 {
  font-size: calc(1.55rem * var(--font-size-factor));
  font-weight: 700;
}

.pgmu-widget__message--md h4 {
  font-size: calc(1.4rem * var(--font-size-factor));
  font-weight: 600;
}

.pgmu-widget__message--md strong {
  font-weight: 700;
  color: var(--pgmu-ink);
}

.pgmu-widget__message--md em {
  font-style: italic;
}

.pgmu-widget__message--md a {
  color: var(--pgmu-crimson);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
  word-break: break-word;
}

.pgmu-widget__message--md a:hover {
  color: var(--pgmu-crimson-deep);
}

.pgmu-widget__message--md code {
  font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Consolas, monospace;
  font-size: 0.92em;
  padding: 0.1rem 0.4rem;
  background: rgba(20, 24, 29, 0.06);
  border-radius: 4px;
}

.pgmu-widget__message--status {
  align-self: center;
  max-width: 100%;
  background: transparent;
  padding: 0.4rem 0.6rem;
  color: var(--pgmu-stone);
  font-size: calc(1.25rem * var(--font-size-factor));
  font-style: italic;
  letter-spacing: 0;
}

/* ---------- Suggestions ---------- */

.pgmu-widget__suggestions {
  align-self: flex-start;
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  max-width: 100%;
  margin: -0.2rem 0 0.4rem;
  animation: pgmu-rise 0.32s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

.pgmu-widget__suggestion {
  padding: 0.8rem 1.3rem;
  background: var(--pgmu-surface);
  border: 1px solid transparent;
  border-radius: var(--pgmu-radius);
  color: var(--pgmu-ink-soft);
  font-family: var(--pgmu-font-body);
  font-size: calc(1.3rem * var(--font-size-factor));
  font-weight: 500;
  line-height: calc(1.8rem * var(--font-size-factor));
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
}

.pgmu-widget__suggestion:hover {
  background: rgba(181, 18, 27, 0.04);
  border-color: var(--pgmu-crimson);
  color: var(--pgmu-crimson);
}

.pgmu-widget__suggestion:active {
  transform: scale(0.98);
}

.pgmu-widget__suggestion:focus-visible {
  outline: 2px solid var(--pgmu-crimson);
  outline-offset: 2px;
}

/* ---------- Typing indicator ---------- */

.pgmu-widget__typing {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1.1rem 1.4rem;
  background: var(--gray-1-color);
  border-radius: var(--pgmu-radius);
  border-top-left-radius: 6px;
  animation: pgmu-rise 0.28s ease both;
}

.pgmu-widget__typing-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--pgmu-stone);
  opacity: 0.5;
  animation: pgmu-typing 1.2s ease-in-out infinite;
}

.pgmu-widget__typing-dot:nth-child(2) { animation-delay: 0.15s; }
.pgmu-widget__typing-dot:nth-child(3) { animation-delay: 0.3s; }

/* ---------- Form ---------- */

.pgmu-widget__form {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1.2rem 1.4rem 1.4rem;
  background: var(--pgmu-surface);
  border-top: 1px solid var(--pgmu-hairline);
}

.pgmu-widget__row {
  display: flex;
  align-items: flex-end;
  gap: 0.6rem;
  width: 100%;
}

.pgmu-widget__field {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: stretch;
}

.pgmu-widget__menu {
  position: relative;
  flex-shrink: 0;
}

.pgmu-widget__menu-button {
  width: 4.8rem;
  height: var(--pgmu-input-min-height);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  background-color: var(--gray-1-color);
  border: 1px solid transparent;
  border-radius: var(--pgmu-radius);
  color: var(--pgmu-ink-soft);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
}

.pgmu-widget__menu-button::before {
  content: "";
  display: block;
  width: 18px;
  height: 18px;
  background: currentColor;
  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='5' r='2'/><circle cx='12' cy='12' r='2'/><circle cx='12' cy='19' r='2'/></svg>") no-repeat center / contain;
          mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='5' r='2'/><circle cx='12' cy='12' r='2'/><circle cx='12' cy='19' r='2'/></svg>") no-repeat center / contain;
}

.pgmu-widget__menu-button:hover {
  color: var(--pgmu-crimson);
  background-color: var(--gray-2-color);
}

.pgmu-widget__menu-button:focus-visible {
  outline: 2px solid var(--pgmu-crimson);
  outline-offset: 2px;
}

.pgmu-widget__menu--open .pgmu-widget__menu-button {
  background-color: var(--gray-2-color);
  color: var(--pgmu-crimson);
}

.pgmu-widget__menu-popup {
  position: absolute;
  left: 0;
  bottom: calc(100% + 0.6rem);
  min-width: 22rem;
  padding: 0.5rem;
  background: var(--pgmu-surface);
  border: 1px solid var(--pgmu-hairline);
  border-radius: var(--pgmu-radius-sm);
  box-shadow: 0 14px 36px rgba(20, 24, 29, 0.14), 0 2px 6px rgba(20, 24, 29, 0.06);
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  z-index: 5;
  opacity: 0;
  transform: translateY(4px);
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease;
}

.pgmu-widget__menu--open .pgmu-widget__menu-popup {
  opacity: 1;
  transform: translateY(0);
  visibility: visible;
  pointer-events: auto;
}

.pgmu-widget__menu-section {
  padding: 0.6rem 1rem 0.4rem;
  font-family: var(--pgmu-font-display);
  font-size: calc(1.05rem * var(--font-size-factor));
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0;
  color: var(--pgmu-stone-soft);
}

.pgmu-widget__menu-item {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  width: 100%;
  padding: 0.9rem 1rem;
  background: transparent;
  border: 0;
  border-radius: 6px;
  font-family: var(--pgmu-font-body);
  font-size: calc(1.35rem * var(--font-size-factor));
  font-weight: 500;
  line-height: calc(1.9rem * var(--font-size-factor));
  color: var(--pgmu-ink);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.pgmu-widget__menu-item:hover {
  background: var(--gray-1-color);
}

.pgmu-widget__menu-item:focus-visible {
  outline: 2px solid var(--pgmu-crimson);
  outline-offset: -2px;
}

.pgmu-widget__menu-item--danger {
  color: var(--pgmu-crimson);
}

.pgmu-widget__menu-item--danger:hover {
  background: rgba(181, 18, 27, 0.06);
}

.pgmu-widget__menu-flag {
  width: 2rem;
  font-size: calc(1.4rem * var(--font-size-factor));
  text-align: center;
}

.pgmu-widget__menu-check {
  margin-left: auto;
  width: 14px;
  height: 14px;
  color: var(--pgmu-crimson);
  visibility: hidden;
  background: currentColor;
  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M5 12l4 4 10-10' fill='none' stroke='black' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/></svg>") no-repeat center / contain;
          mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M5 12l4 4 10-10' fill='none' stroke='black' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'/></svg>") no-repeat center / contain;
}

.pgmu-widget__menu-item[aria-checked="true"] .pgmu-widget__menu-check {
  visibility: visible;
}

.pgmu-widget__menu-divider {
  height: 1px;
  margin: 0.4rem 0.4rem;
  background: var(--pgmu-hairline);
}

.pgmu-widget__menu-icon {
  width: 18px;
  height: 18px;
  display: inline-block;
  background: currentColor;
  flex-shrink: 0;
}

.pgmu-widget__menu-icon--trash {
  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M9 3h6v2h5v2H4V5h5V3zm-3 6h12l-1 12H7L6 9zm3 2v8h2v-8H9zm4 0v8h2v-8h-2z'/></svg>") no-repeat center / contain;
          mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M9 3h6v2h5v2H4V5h5V3zm-3 6h12l-1 12H7L6 9zm3 2v8h2v-8H9zm4 0v8h2v-8h-2z'/></svg>") no-repeat center / contain;
}

.pgmu-widget__input {
  flex: 1;
  min-width: 0;
  resize: none;
  background-color: var(--gray-1-color);
  border: 1px solid transparent;
  border-radius: var(--pgmu-radius);
  height: var(--pgmu-input-min-height);
  min-height: var(--pgmu-input-min-height);
  max-height: 14rem;
  padding: 2rem 6.4rem 1.8rem 1.6rem;
  font-family: var(--pgmu-font-body);
  font-size: calc(1.5rem * var(--font-size-factor));
  font-weight: 400;
  letter-spacing: 0;
  line-height: calc(2.2rem * var(--font-size-factor));
  color: var(--pgmu-ink);
  scrollbar-width: none;
  -ms-overflow-style: none;
  transition: border-color 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
}

.pgmu-widget__input::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.pgmu-widget__input::placeholder {
  color: var(--pgmu-stone);
  opacity: 0.9;
}

.pgmu-widget__input:focus {
  background-color: var(--pgmu-surface);
  border-color: var(--pgmu-hairline-strong);
  outline: 0;
}

.pgmu-widget__send {
  position: absolute;
  right: 1.2rem;
  bottom: 1.2rem;
  width: 4rem;
  height: 4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background-color: var(--pgmu-crimson);
  border: 0;
  border-radius: 50%;
  color: #ffffff;
  cursor: pointer;
  padding: 0;
  font-family: var(--main-font);
  font-size: calc(1.4rem * var(--font-size-factor));
  font-weight: 400;
  letter-spacing: 0;
  line-height: 1;
  transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out, transform 0.15s ease;
}

.pgmu-widget__send::before {
  content: "";
  display: block;
  width: 18px;
  height: 18px;
  background: currentColor;
  -webkit-mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 4 5 11l1.4 1.4L11 7.8V20h2V7.8l4.6 4.6L19 11z' fill='black'/></svg>") no-repeat center / contain;
          mask: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M12 4 5 11l1.4 1.4L11 7.8V20h2V7.8l4.6 4.6L19 11z' fill='black'/></svg>") no-repeat center / contain;
}

.pgmu-widget__send:hover:not(:disabled) {
  background-color: var(--pgmu-crimson-deep);
}

.pgmu-widget__send:active:not(:disabled) {
  transform: scale(0.96);
}

.pgmu-widget__send:focus-visible {
  outline: 2px solid var(--pgmu-crimson);
  outline-offset: 2px;
}

.pgmu-widget__send:disabled {
  background-color: var(--gray-2-color);
  color: var(--pgmu-stone-soft);
  cursor: default;
}

.pgmu-widget__input:disabled {
  opacity: 0.55;
  cursor: default;
}

.pgmu-widget__hint {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
  padding: 0 0.4rem;
  font-size: calc(1.1rem * var(--font-size-factor));
  color: var(--pgmu-stone-soft);
  letter-spacing: 0;
  user-select: none;
}

.pgmu-widget__hint kbd {
  display: inline-block;
  padding: 0.1rem 0.5rem;
  margin: 0 0.1rem;
  font-family: var(--pgmu-font-body);
  font-size: calc(1.05rem * var(--font-size-factor));
  font-weight: 600;
  line-height: 1.4;
  color: var(--pgmu-ink-soft);
  background: var(--pgmu-surface);
  border: 1px solid var(--pgmu-hairline-strong);
  border-bottom-width: 2px;
  border-radius: 4px;
}

@media (max-width: 480px) {
  .pgmu-widget__messages { padding: 1.6rem 1.4rem 0.4rem; }
  .pgmu-widget__form { padding: 1rem 1.2rem 1.4rem; }
  .pgmu-widget__message { max-width: 90%; }
}

@media (hover: none), (pointer: coarse) {
  .pgmu-widget__hint { display: none; }
}

@container (max-width: 420px) {
  .pgmu-widget {
    min-height: 320px;
  }

  .pgmu-widget__messages {
    padding: 1.4rem 1.2rem 0.4rem;
    gap: 0.8rem;
  }

  .pgmu-widget__message {
    max-width: 94%;
    padding: 0.95rem 1.2rem;
  }

  .pgmu-widget__suggestion {
    width: 100%;
  }

  .pgmu-widget__form {
    padding: 1rem;
  }

  .pgmu-widget__row {
    gap: 0.5rem;
  }

  .pgmu-widget__menu-popup {
    min-width: min(22rem, calc(100cqw - 2rem));
  }

  .pgmu-widget__hint { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .pgmu-widget__message,
  .pgmu-widget__suggestions,
  .pgmu-widget__typing { animation: none; }
  .pgmu-widget__typing-dot { animation: none; opacity: 0.6; }
  .pgmu-widget__messages { scroll-behavior: auto; }
  .pgmu-widget__send,
  .pgmu-widget__input,
  .pgmu-widget__suggestion,
  .pgmu-widget__menu-button,
  .pgmu-widget__menu-popup,
  .pgmu-widget__menu-item { transition: none; }
}
`.trim();
