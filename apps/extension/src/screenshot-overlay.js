// The on-page screenshot selector, injected with chrome.scripting.executeScript
// (so it must stay self-contained: no imports, no closures over this module).
// It runs in the extension's isolated world, draws a crosshair veil plus a
// small toolbar pinned to the tab's top-right corner — Selection (active) ·
// Window · Full page · ✕ — inside a closed shadow root, and resolves with the
// user's choice:
//   { rect: {x, y, w, h}, dpr }  a dragged region (CSS pixels)
//   { window: {w, h}, dpr }      Window: exactly what is on screen
//   { fullPage: true }           Full page was chosen (the whole scroll)
//   null                         ✕, Esc, or the tab was hidden
//   { busy: true }               a selector is already open on this page
// Only trusted input counts: a page script can dispatch synthetic events at
// the host element, but it can neither select a region nor pick a choice.
export function screenshotSelectInPage({ fullPage = true } = {}) {
  // Never stack a second selector over one that is already open.
  if (document.querySelector("foundkeep-capture")) return Promise.resolve({ busy: true });
  // Keyboard focus may be in the dock (hidden now) or elsewhere; bring it to
  // the page so Esc reaches this overlay.
  window.focus();
  return new Promise((resolve) => {
    const dpr = window.devicePixelRatio || 1;
    const host = document.createElement("foundkeep-capture");
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;";
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `<style>
      :host{all:initial}
      .veil{position:fixed;inset:0;cursor:crosshair;background:rgba(0,0,0,.15)}
      .box{position:fixed;left:0;top:0;width:0;height:0;border:2px solid #4cc38a;background:rgba(76,195,138,.14);pointer-events:none;box-sizing:border-box}
      .box[hidden],[hidden]{display:none!important}
      .hint{position:fixed;top:16px;left:50%;transform:translateX(-50%);pointer-events:none;font:600 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif;
        color:#f7f8f8;background:rgba(15,16,17,.88);padding:8px 14px;border-radius:999px;white-space:nowrap}
      .bar{position:fixed;top:12px;right:12px;display:flex;align-items:center;gap:2px;padding:3px;background:#0f1011;color:#d6d8db;border:1px solid #1d1f22;
        border-radius:11px;box-shadow:0 8px 28px rgba(0,0,0,.35);font:500 13px/1 system-ui,-apple-system,"Segoe UI",sans-serif}
      button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;height:32px;min-width:32px;padding:0 11px;border-radius:8px;cursor:pointer;white-space:nowrap}
      button:hover{background:#1a1b1e}
      button[aria-pressed="true"]{background:#163426;color:#4cc38a}
      button:focus-visible{outline:2px solid #4cc38a;outline-offset:1px}
    </style>
    <div class="veil"></div><div class="box" hidden></div>
    <div class="hint">Drag to capture · Esc to cancel</div>
    <div class="bar" role="toolbar" aria-label="FoundKeep screenshot">
      <button type="button" data-choice="selection" aria-pressed="true">Selection</button>
      <button type="button" data-choice="window" title="Exactly what is on screen">Window</button>
      <button type="button" data-choice="fullpage" title="The whole page, scrolled">Full page</button>
      <button type="button" data-choice="cancel" aria-label="Cancel screenshot" title="Cancel (Esc)">✕</button>
    </div>`;
    const veil = root.querySelector(".veil"), box = root.querySelector(".box");
    root.querySelector('[data-choice="fullpage"]').hidden = !fullPage;
    let start = null, done = false;

    const cleanup = () => {
      host.remove();
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("visibilitychange", onVisibility);
      delete window.__foundkeepCapture;
    };
    // Wait for two frames after removing the overlay so it is not in the
    // screenshot captureVisibleTab takes next.
    const finish = (result) => {
      if (done) return;
      done = true;
      cleanup();
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(result)));
    };
    const onKey = (event) => {
      if (!event.isTrusted || event.key !== "Escape") return;
      event.preventDefault(); event.stopPropagation();
      finish(null);
    };
    const onVisibility = () => { if (document.hidden) finish(null); };
    const draw = (x, y) => {
      box.hidden = false;
      box.style.left = Math.min(start.x, x) + "px"; box.style.top = Math.min(start.y, y) + "px";
      box.style.width = Math.abs(x - start.x) + "px"; box.style.height = Math.abs(y - start.y) + "px";
    };
    veil.addEventListener("mousedown", (event) => {
      if (!event.isTrusted || event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      start = { x: event.clientX, y: event.clientY };
      draw(event.clientX, event.clientY);
    });
    veil.addEventListener("mousemove", (event) => {
      if (!event.isTrusted || !start) return;
      event.stopPropagation();
      draw(event.clientX, event.clientY);
    });
    veil.addEventListener("mouseup", (event) => {
      if (!event.isTrusted || !start) return;
      event.stopPropagation();
      const rect = { x: Math.min(start.x, event.clientX), y: Math.min(start.y, event.clientY), w: Math.abs(event.clientX - start.x), h: Math.abs(event.clientY - start.y) };
      start = null;
      // A click (or a tiny drag) is not a selection: keep waiting.
      if (rect.w < 5 || rect.h < 5) { box.hidden = true; return; }
      finish({ rect, dpr });
    });
    root.querySelector(".bar").addEventListener("click", (event) => {
      if (!event.isTrusted) return;
      const choice = event.target.closest?.("button[data-choice]")?.dataset.choice;
      if (choice === "window") finish({ window: { w: window.innerWidth, h: window.innerHeight }, dpr });
      if (choice === "fullpage") finish({ fullPage: true });
      if (choice === "cancel") finish(null);
    });
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("visibilitychange", onVisibility);
    // Test handle, isolated world only (like window.__foundkeepDock).
    window.__foundkeepCapture = {
      rect: (selector) => { const r = root.querySelector(selector)?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : { x: 0, y: 0, width: 0, height: 0 }; },
      text: (selector) => root.querySelector(selector)?.textContent.replace(/\n\s*/g, "") ?? null,
      attr: (selector, name) => root.querySelector(selector)?.getAttribute(name) ?? null,
      // Design review (scripts/design/dock-review.mjs): a static copy of the
      // selector — stylesheet and markup, hover and focus marked as data-fk-*.
      snapshot: () => {
        const copy = document.createElement("div");
        for (const node of root.childNodes) copy.append(node.cloneNode(true));
        const copies = copy.querySelectorAll("*");
        root.querySelectorAll("*").forEach((el, i) => {
          if (el.matches(":hover")) copies[i].setAttribute("data-fk-hover", "");
          if (el !== root.activeElement) return;
          copies[i].setAttribute("data-fk-focus", "");
          if (el.matches(":focus-visible")) copies[i].setAttribute("data-fk-focus-visible", "");
        });
        const style = copy.querySelector("style"), css = style?.textContent || "";
        style?.remove();
        return { css, html: copy.innerHTML, viewport: { width: innerWidth, height: innerHeight } };
      },
    };
    document.documentElement.append(host);
  });
}
