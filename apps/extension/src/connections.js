import { getSettings, setSettings } from "./storage.js";
import { agentHealth } from "./agent.js";
import { message } from "./ui.js";
import { bindCloud } from "./cloud-ui.js";

export function bindConnections(container, onSaved = () => {}) {
  container.innerHTML = `<div id="accountSettings"></div>
    <details id="localCompanion" class="setting-group"><summary>Advanced: local companion</summary>
      <p class="fine">For captures kept only in this browser. Connected accounts use Foundkeep organization instead.</p>
      <form id="connectionForm"><div class="setting-title"><label for="enrichEnabled">Organize local captures</label><input class="toggle" id="enrichEnabled" type="checkbox" aria-label="Organize automatically"></div>
      <p class="fine">Optional summaries, tags and text recognition through your companion and its AI provider.</p>
      <div class="field"><label for="agentUrl">Companion address</label><input id="agentUrl" type="url" placeholder="http://127.0.0.1:8791" autocomplete="off"></div>
      <p class="fine">Run <code>npx @notpritam/atlas-agent</code> on your computer. Capture content may be processed remotely by its model provider.</p>
      <p class="statusline" id="agentBox" role="status"></p>
      <div class="settings-actions"><button id="saveSettings" class="btn primary" type="submit">Save settings</button><button class="btn secondary" id="testConnections" type="button">Check connection</button></div>
      <p class="statusline" id="settingsFeedback" role="status"></p></form>
    </details>
    <section class="setting-group"><h3>Local library</h3><p>Copies stay in this browser. Keep the extension installed to retain them. Deleting a local copy does not delete its account copy; manage account captures in your dashboard.</p></section>`;
  const field = (id) => container.querySelector("#" + id);
  let saved,
    sequence = 0;
  const cloud = bindCloud(field("accountSettings"), {
    onStatus: (state) => {
      field("localCompanion").hidden = !!state.account;
    },
  });
  const values = () => ({
    agentUrl: field("agentUrl").value.trim() || "http://127.0.0.1:8791",
    enrichEnabled: field("enrichEnabled").checked,
  });
  async function check() {
    const seq = ++sequence;
    if (!saved) return;
    if (JSON.stringify(values()) !== JSON.stringify(saved)) {
      message(field("agentBox"), "Save changes before checking the companion.");
      return;
    }
    if (!saved.enrichEnabled) {
      message(field("agentBox"), "Organization off. Captures save locally.");
      return;
    }
    message(field("agentBox"), "Checking the companion…");
    try {
      const result = await agentHealth(saved.agentUrl);
      if (seq === sequence)
        message(
          field("agentBox"),
          result.claude
            ? "Connected. Your companion can organize local captures."
            : "Companion found. Connect Claude Code to enable organization.",
          result.claude ? "success" : "",
        );
    } catch {
      if (seq === sequence)
        message(
          field("agentBox"),
          "Companion unavailable. Your local captures are safe.",
        );
    }
  }
  field("testConnections").onclick = check;
  field("connectionForm").addEventListener("input", () => {
    sequence++;
    message(field("settingsFeedback"), "Unsaved changes. Save to apply them.");
  });
  field("connectionForm").onsubmit = async (event) => {
    event.preventDefault();
    const next = values();
    try {
      const url = new URL(next.agentUrl);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password
      )
        throw new Error();
    } catch {
      message(
        field("settingsFeedback"),
        "Use an http:// or https:// companion address.",
        "error",
      );
      field("agentUrl").focus();
      return;
    }
    field("saveSettings").disabled = true;
    try {
      await setSettings(next);
      saved = next;
      message(field("settingsFeedback"), "Settings saved.", "success");
      if (next.enrichEnabled)
        chrome.runtime.sendMessage({ kind: "drain" }).catch(() => {});
      onSaved();
      await check();
    } catch {
      message(
        field("settingsFeedback"),
        "Settings could not be saved. Try again.",
        "error",
      );
    } finally {
      field("saveSettings").disabled = false;
    }
  };
  return {
    refreshCloud: cloud.load,
    async load() {
      const settings = await getSettings();
      saved = {
        agentUrl: settings.agentUrl,
        enrichEnabled: settings.enrichEnabled,
      };
      field("agentUrl").value = saved.agentUrl;
      field("enrichEnabled").checked = saved.enrichEnabled;
      message(field("settingsFeedback"), "");
      await cloud.load();
      message(
        field("agentBox"),
        saved.enrichEnabled
          ? "Check your companion connection when needed."
          : "Organization off. Captures save locally.",
      );
    },
  };
}
