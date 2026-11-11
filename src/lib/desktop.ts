/**
 * Removes the browser tells a WebView shell leaves behind. Called only when the
 * app runs inside the desktop shell — the plain web build keeps normal browser
 * behaviour.
 */
export function hardenDesktopShell() {
  document.documentElement.classList.add("is-desktop");

  // Chromium's own context menu (Back / Reload / Save as / Inspect) has no place
  // in an app. Text fields keep theirs so paste and spell-check still work.
  document.addEventListener(
    "contextmenu",
    (e) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("input, textarea, [contenteditable='true']")) e.preventDefault();
    },
    { capture: true },
  );

  // Reload, find, print, save, view-source and zoom are browser commands, not
  // app commands. Capture phase so the app's own handlers never see them.
  document.addEventListener(
    "keydown",
    (e) => {
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      const blocked =
        e.key === "F5" ||
        e.key === "F7" ||
        (mod && ["r", "f", "p", "s", "u", "j"].includes(key)) ||
        (e.ctrlKey && ["+", "-", "=", "0"].includes(e.key)) ||
        (e.shiftKey && mod && ["i", "j", "c"].includes(key));
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    { capture: true },
  );

  // Dragging an image or a link out of the window is a web-page gesture.
  document.addEventListener(
    "dragstart",
    (e) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("input, textarea, [contenteditable='true']")) e.preventDefault();
    },
    { capture: true },
  );
}
