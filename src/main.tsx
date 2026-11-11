import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/fraunces/opsz-italic.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { hardenDesktopShell } from "./lib/desktop";
import "./styles/app.css";

// The desktop shell ships every asset locally, so the offline cache buys nothing
// there and its custom protocol does not serve service workers reliably.
const isDesktopShell = "__TAURI_INTERNALS__" in window;

if (isDesktopShell) hardenDesktopShell();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator && !isDesktopShell) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => null);
  });
}
