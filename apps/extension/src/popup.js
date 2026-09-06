import * as db from "./db.js";
import { $, title, domain, ago, icon, hydrateIcons, message } from "./ui.js";
import { bindConnections } from "./connections.js";
import { bindCloud } from "./cloud-ui.js";
import { CUSTOMER_ORIGIN } from "./cloud.js";
hydrateIcons();
let blobUrls = [],
  saving = false;
const settings = bindConnections($("connections"));
let cloudState = null;
const cloud = bindCloud($("cloudSummary"), {
  compact: true,
  onStatus: (state) => {
    cloudState = state;
    $("openLib").innerHTML =
      (state.account ? "Open dashboard" : "Open library") + " " + icon("arrow");
    $("openLocalLib").hidden = !state.account;
  },
});
async function openLibrary(id) {
  try {
    await chrome.tabs.create({
      url:
        chrome.runtime.getURL("src/dashboard.html") +
        (id ? `#capture=${encodeURIComponent(id)}` : ""),
    });
    window.close();
  } catch (error) {
    message(
      $("saveFeedback"),
      error.message || "Could not open the library.",
      "error",
    );
  }
}
async function renderRecent() {
  const [rows, counts] = await Promise.all([
    db.listCaptures({ limit: 3 }),
    db.counts(),
  ]);
  blobUrls.forEach(URL.revokeObjectURL);
  blobUrls = [];
  $("savedCount").textContent = `${counts.total} saved`;
  $("recent").replaceChildren();
  for (const capture of rows) {
    const li = document.createElement("li"),
      button = document.createElement("button");
    button.className = "recent-item";
    button.innerHTML = `<span class="r-icon">${icon(capture.type)}</span><span class="r-copy"><span class="r-title"></span><span class="r-meta"></span></span><span class="r-time"></span>`;
    button.querySelector(".r-title").textContent = title(capture);
    button.querySelector(".r-meta").textContent = domain(capture.sourceUrl);
    button.querySelector(".r-time").textContent = ago(capture.createdAt);
    if (capture.blob) {
      const img = document.createElement("img");
      img.alt = "";
      img.src = URL.createObjectURL(capture.blob);
      blobUrls.push(img.src);
      button.querySelector(".r-icon").replaceChildren(img);
    }
    button.onclick = () => openLibrary(capture.id);
    li.append(button);
    $("recent").append(li);
  }
  if (!rows.length) {
    const li = document.createElement("li");
    li.className = "recent-empty";
    li.textContent = "Your next good find starts here.";
    $("recent").append(li);
  }
}
function updateSave() {
  $("save").disabled = saving || !$("note").value.trim();
}
async function saveNote() {
  const text = $("note").value.trim();
  if (!text || saving) return;
  const draft = $("note").value;
  saving = true;
  updateSave();
  $("save").textContent = "Saving…";
  message($("saveFeedback"), "");
  try {
    const response = await chrome.runtime.sendMessage({
      kind: "saveNote",
      text,
    });
    if (!response?.ok)
      throw new Error(
        response?.error || "Could not save your note. Try again.",
      );
    if ($("note").value === draft) $("note").value = "";
    message($("saveFeedback"), "Saved in your library.", "success");
    await renderRecent();
  } catch (error) {
    message(
      $("saveFeedback"),
      error.message || "Could not save. Your draft is still here.",
      "error",
    );
  } finally {
    saving = false;
    $("save").innerHTML = `Save note ${icon("arrow")}`;
    updateSave();
  }
}
$("note").addEventListener("input", updateSave);
$("note").addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    saveNote();
  }
});
$("save").onclick = saveNote;
for (const button of document.querySelectorAll("[data-act]"))
  button.onclick = async () => {
    try {
      await chrome.runtime.sendMessage({
        kind: "capture",
        action: button.dataset.act,
      });
      window.close();
    } catch (error) {
      message(
        $("captureFeedback"),
        error.message ||
          "Could not start capture. Reload this page and try again.",
        "error",
      );
    }
  };
$("openLib").onclick = () =>
  cloudState?.account
    ? chrome.tabs
        .create({ url: CUSTOMER_ORIGIN + "/dashboard.html" })
        .then(() => window.close())
        .catch(() =>
          message(
            $("saveFeedback"),
            "Could not open Atlas. Your local library is still available.",
            "error",
          ),
        )
    : openLibrary();
$("openLocalLib").onclick = () => openLibrary();
$("brandLibrary").onclick = (e) => {
  e.preventDefault();
  openLibrary();
};
$("openSettings").onclick = async () => {
  $("view-main").hidden = true;
  $("view-settings").hidden = false;
  $("backBtn").focus();
  await settings.load();
};
$("backBtn").onclick = () => {
  $("view-settings").hidden = true;
  $("view-main").hidden = false;
  $("openSettings").focus();
};
chrome.runtime.onMessage.addListener((m) => {
  if (m.kind === "atlas-changed") {
    renderRecent().catch(() => {});
    cloud.load();
    if (!$("view-settings").hidden) settings.refreshCloud();
  }
});
window.addEventListener("focus", () => cloud.load());
window.addEventListener("pagehide", () =>
  blobUrls.forEach(URL.revokeObjectURL),
);
async function init() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab && /^https?:\/\//.test(tab.url || "")) {
      $("page-domain").textContent = domain(tab.url);
      $("page-title").textContent = tab.title || tab.url;
    } else {
      $("page-title").textContent = "Open a web page to capture it.";
      document
        .querySelectorAll("[data-act]")
        .forEach((b) => (b.disabled = true));
    }
    await renderRecent();
    await cloud.load();
  } catch {
    message(
      $("saveFeedback"),
      "Could not load recent captures. Try reopening Atlas.",
      "error",
    );
  }
}
init();
