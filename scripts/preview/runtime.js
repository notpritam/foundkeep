// Browser-only review fixture. This file is never packaged into the extension.
const listeners = [];
const defaults = {
  enrichEnabled: false,
  agentUrl: "http://127.0.0.1:8791",
  relayUrl: "",
  relayToken: "",
};
const getSettings = () => ({
  ...defaults,
  ...JSON.parse(localStorage.getItem("atlas-preview-settings") || "{}"),
});
window.close = () => {};
window.chrome = {
  storage: {
    local: {
      get: async () => getSettings(),
      set: async (p) =>
        localStorage.setItem(
          "atlas-preview-settings",
          JSON.stringify({ ...getSettings(), ...p }),
        ),
    },
    onChanged: { addListener: () => {} },
  },
  tabs: {
    query: async () => [
      {
        id: 1,
        title: "A study in light, space, and concrete",
        url: "https://example.com/stories/quiet-spaces",
      },
    ],
    create: async ({ url }) => {
      location.href = url;
    },
  },
  runtime: {
    getURL: (p) => "/apps/extension/" + p,
    onMessage: {
      addListener: (fn) => listeners.push(fn),
      removeListener: () => {},
    },
    sendMessage: async (m) => {
      if (m.kind === "cloud-status") {
        const db = await import("/apps/extension/src/db.js");
        return {ok:true,account:null,status:"disconnected",pending:0,failed:0,synced:0,localOnly:(await db.listCaptures()).length,otherAccount:0,error:null};
      }
      if (m.kind === "capture")
        throw new Error(
          "Live page capture needs the installed extension. You can try notes and the library in this preview.",
        );
      if (m.kind === "saveNote") {
        const db = await import("/apps/extension/src/db.js");
        await db.addCapture({ type: "note", noteText: m.text });
        for (const fn of listeners) fn({ kind: "atlas-changed" });
        return { ok: true };
      }
      return { relay: false, connected: false };
    },
  },
};
if (!new URLSearchParams(location.search).has("shot")) {
  const style = document.createElement("style");
  style.textContent =
    ".preview-bar{position:relative;z-index:5;display:flex;flex-wrap:wrap;gap:10px;justify-content:center;align-items:center;background:#c63b23;color:white;font:11px/1.5 system-ui;padding:8px 12px}.preview-bar a{color:white;text-decoration:underline}.sidebar{top:33px!important}.preview-bar+*{scroll-margin-top:34px}@media(max-width:760px){.sidebar{top:0!important}}";
  document.head.append(style);
  const banner = document.createElement("div");
  banner.className = "preview-bar";
  banner.innerHTML =
    'Sample library · browser preview <a href="/apps/extension/src/popup.html">Capture popup</a><a href="/apps/extension/src/dashboard.html">Library</a><a href="/apps/web/">Website</a>';
  document.body.prepend(banner);
}
export const ready = (async () => {
  if (localStorage.getItem("atlas-preview-seeded-v1")) return;
  const db = await import("/apps/extension/src/db.js");
  const architecture = await fetch(
    "/apps/web/assets/studio-architecture.png",
  ).then((r) => r.blob());
  const typography = new Blob(
    [
      `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="560"><rect width="750" height="560" fill="#eeeee7"/><path d="M44 70H706M44 490H706" stroke="#242620"/><text x="44" y="52" fill="#292c24" font-family="Arial" font-size="16">TYPE STUDY / 006</text><text x="38" y="236" fill="#25271f" font-family="Arial" font-size="142" font-weight="bold" letter-spacing="-8">Less,</text><text x="38" y="389" fill="#c63b23" font-family="Arial" font-size="142" font-weight="bold" letter-spacing="-8">better.</text><text x="44" y="527" fill="#292c24" font-family="Arial" font-size="16">A FEW WORDS. ROOM TO BREATHE.</text></svg>`,
    ],
    { type: "image/svg+xml" },
  );
  const poster = new Blob(
    [
      `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="470"><rect width="750" height="470" fill="#bf422a"/><circle cx="560" cy="180" r="205" fill="#dd694e"/><path d="M370 40 600 435H140Z" fill="#292a23"/><text x="40" y="59" font-size="16" fill="#fff4df" font-family="Arial">FORM / COLOUR / FEELING</text><text x="40" y="429" font-size="63" font-family="Arial" fill="#fff4df" letter-spacing="-2">Good things take shape.</text></svg>`,
    ],
    { type: "image/svg+xml" },
  );
  const rows = [
    {
      type: "image",
      sourceTitle: "A study in light, space, and concrete",
      sourceUrl: "https://example.com/stories/quiet-spaces",
      blob: architecture,
      tags: ["architecture", "inspiration"],
      category: "Design",
    },
    {
      type: "bookmark",
      sourceTitle: "The quiet power of good typography",
      sourceUrl: "https://example.com/journal/typography",
      description:
        "Notes on rhythm, hierarchy, and making space for the words that matter.",
      tags: ["typography", "reading"],
      category: "Reading",
    },
    {
      type: "note",
      noteText:
        "A small idea for later: build a collection of places that make you slow down.",
      tags: ["ideas"],
      category: "Personal",
    },
    {
      type: "highlight",
      sourceTitle: "On paying attention",
      sourceUrl: "https://example.com/essays/attention",
      selectionText:
        "The best ideas often begin with noticing something everyone else walked past.",
      tags: ["writing", "ideas"],
      category: "Reading",
    },
    {
      type: "screenshot",
      sourceTitle: "Type study — less, better.",
      sourceUrl: "https://example.com/studio/type",
      blob: typography,
      tags: ["typography", "inspiration"],
      category: "Design",
    },
    {
      type: "bookmark",
      sourceTitle: "A field guide to the everyday",
      sourceUrl: "https://example.com/field-guide",
      description:
        "Finding interesting details in familiar places. A reference for the next long walk.",
      tags: ["reading"],
      category: "Reading",
    },
    {
      type: "note",
      noteText:
        "For the next project: warm paper, one confident color, and more room to breathe.",
      tags: ["ideas", "design"],
      category: "Personal",
    },
    {
      type: "image",
      sourceTitle: "Form, colour, feeling",
      sourceUrl: "https://example.com/studio/forms",
      blob: poster,
      tags: ["design", "inspiration"],
      category: "Design",
    },
    {
      type: "highlight",
      sourceTitle: "Making things that last",
      selectionText:
        "Keep the things that move you. You never know what they might become.",
      sourceUrl: "https://example.com/journal/making",
      tags: ["writing"],
      category: "Reading",
    },
    {
      type: "bookmark",
      sourceTitle: "A collection is a conversation with yourself",
      sourceUrl: "https://example.com/journal/collecting",
      description:
        "Why saving a small detail today can open up an idea tomorrow.",
      tags: ["reading", "ideas"],
      category: "Reading",
    },
    {
      type: "note",
      noteText:
        "Sunday list: visit the bookshop, take the long way home, notice one new thing.",
      tags: ["personal"],
      category: "Personal",
    },
  ];
  for (const [i, row] of rows.entries()) {
    const capture = await db.addCapture(row);
    await db.updateCapture(capture.id, {
      tags: row.tags,
      category: row.category,
      description: row.description || null,
      status: "done",
      createdAt: Date.now() - (i + 1) * 3600000,
    });
  }
  localStorage.setItem("atlas-preview-seeded-v1", "yes");
})();
