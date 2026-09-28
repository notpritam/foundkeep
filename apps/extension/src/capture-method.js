// provenance.captureMethod for a capture — the one mapping
// performCapture (capture-actions.js) uses, kept free of chrome.* so tests can
// check every trigger/action against the backend's allowlist
// (apps/backend/src/customer-provenance.ts METHODS). A method outside that
// set 400s on upload with invalid_capture_context.
export function captureMethodFor(action, trigger, { attachPage = false } = {}) {
  if (action === "tweet") return "twitter-action";
  if (action === "note") return attachPage ? "extension-note" : "library-note";
  if (action === "save-selection") return "context-selection";
  if (action === "save-link") return "context-link";
  if (action === "save-image") return "context-image";
  const suffix = {
    savepage: "save-page",
    highlight: "highlight",
    region: "region",
    fullpage: "full-page",
  }[action];
  // The dock is the extension's own capture UI — the same role the popup
  // played — and the backend has no "dock-*" methods, only "popup-*" (R12).
  const prefix = trigger === "dock" ? "popup" : trigger || "popup";
  return `${prefix}-${suffix}`;
}

// Keyboard shortcuts save directly. Both screenshot shortcuts start the same
// corner-toolbar flow as the dock's Screenshot button ("region": drag a
// selection, or choose Full page there); with region selection turned off in
// preferences, the full-page shortcut captures the page directly instead.
export function actionForCommand(command, capture = {}) {
  if (command === "region-screenshot") return "region";
  if (command === "full-page-screenshot") return capture.region === false ? "fullpage" : "region";
  if (command === "save-highlight") return "highlight";
  return null;
}
