import { getSettings, setSettings } from "./storage.js";
import { agentHealth } from "./agent.js";
import { message } from "./ui.js";

export function settingsMarkup() {
  return `<form id="connectionForm">
    <section class="setting-group">
      <div class="setting-title"><div><h3>Organize automatically</h3><p>Optional summaries, tags and text recognition for your captures.</p></div><input class="toggle" id="enrichEnabled" type="checkbox" aria-label="Organize automatically"></div>
      <p class="fine">Requires the Atlas companion and your Claude Code connection. Saving and search work without it.</p>
      <p class="statusline" id="agentBox" role="status"></p>
      <details><summary>Set up the companion</summary><p class="fine" style="margin-top:12px">Run on your computer:</p><code>npx @notpritam/atlas-agent</code><div class="field"><label for="agentUrl">Companion address</label><input id="agentUrl" type="url" placeholder="http://127.0.0.1:8791" autocomplete="off"></div><p class="fine" style="margin-top:10px">Captures sent for organization are processed by the configured companion and its AI provider.</p></details>
    </section>
    <section class="setting-group"><h3 style="font-size:14px;font-weight:550">Storage</h3><p>Your captures live in this browser. Keep the extension installed to retain your library.</p></section>
    <details class="setting-group"><summary>Advanced: browser control</summary><p class="fine" style="margin-top:12px">Connect your existing agent through a local bridge or hosted relay. Enable the Agent button on a page to grant that tab access. This is separate from organizing captures.</p><div class="field"><label for="relayUrl">Relay address (leave blank for the local bridge)</label><input id="relayUrl" type="text" inputmode="url" placeholder="wss://atlas.notpritam.in/agent" autocomplete="off"></div><div class="field"><label for="relayToken">Account token</label><input id="relayToken" type="password" autocomplete="off" placeholder="Your relay token"></div><p class="fine" style="margin-top:10px">Hosted control sends enabled-page context and agent actions through that service.</p><p class="statusline" id="relayBox" role="status"></p></details>
    <div class="settings-actions"><button id="saveSettings" class="btn primary" type="submit">Save settings</button><button class="btn secondary" id="testConnections" type="button">Check connection</button></div>
    <p class="statusline" id="settingsFeedback" role="status" style="margin-top:12px;min-height:20px"></p>
  </form>`;
}

export function bindConnections(container, onSaved = () => {}) {
  container.innerHTML = settingsMarkup();
  const field = (id) => container.querySelector("#" + id);
  let saved,
    sequence = 0;
  const values = () => ({
    agentUrl: field("agentUrl").value.trim() || "http://127.0.0.1:8791",
    enrichEnabled: field("enrichEnabled").checked,
    relayUrl: field("relayUrl").value.trim(),
    relayToken: field("relayToken").value.trim(),
  });
  const validUrl = (value, protocols) => {
    try {
      const u = new URL(value);
      return protocols.includes(u.protocol) && !u.username && !u.password;
    } catch {
      return false;
    }
  };
  const dirty = () => {
    sequence++;
    message(field("settingsFeedback"), "Unsaved changes. Save to apply them.");
    message(
      field("agentBox"),
      field("enrichEnabled").checked
        ? "Save, then check your companion connection."
        : "Organization off. Captures still save normally.",
    );
    message(field("relayBox"), "Save to apply connection changes.");
  };
  async function check() {
    const seq = ++sequence;
    if (!saved) return;
    const v = values();
    if (JSON.stringify(v) !== JSON.stringify(saved)) {
      dirty();
      return;
    }
    const agentBox = field("agentBox");
    message(
      agentBox,
      saved.enrichEnabled
        ? "Checking the companion…"
        : "Organization off. Captures save locally.",
    );
    message(field("relayBox"), "Checking connection…");
    const checks = [
      (async () => {
        if (!saved.enrichEnabled) return;
        try {
          const health = await agentHealth(saved.agentUrl);
          if (seq !== sequence) return;
          message(
            agentBox,
            health.claude
              ? "Connected. Your companion can organize captures."
              : "Companion found. Connect Claude Code to enable organization.",
            health.claude ? "success" : "",
          );
        } catch {
          if (seq === sequence)
            message(
              agentBox,
              "Companion unavailable. Captures are saved and waiting for organization. Open setup for instructions.",
            );
        }
      })(),
      (async () => {
        try {
          const st = await chrome.runtime.sendMessage({ k: "relay-state" });
          if (seq !== sequence) return;
          message(
            field("relayBox"),
            st?.connected
              ? `${st.relay ? "Hosted relay" : "Local bridge"} connected. Per-tab permission is still required.`
              : `${saved.relayUrl ? "Hosted relay" : "Local bridge"} not connected.`,
            st?.connected ? "success" : "",
          );
        } catch {
          if (seq === sequence)
            message(
              field("relayBox"),
              "Connection status unavailable. Reopen the extension to retry.",
            );
        }
      })(),
    ];
    await Promise.allSettled(checks);
  }
  container
    .querySelectorAll("input")
    .forEach((input) => input.addEventListener("input", dirty));
  field("testConnections").addEventListener("click", check);
  field("connectionForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = values();
    if (!validUrl(v.agentUrl, ["http:", "https:"])) {
      message(
        field("settingsFeedback"),
        "Use an http:// or https:// companion address.",
        "error",
      );
      field("agentUrl").closest("details").open = true;
      field("agentUrl").focus();
      return;
    }
    if (v.relayUrl && !validUrl(v.relayUrl, ["ws:", "wss:"])) {
      message(
        field("settingsFeedback"),
        "Use a ws:// or wss:// relay address.",
        "error",
      );
      field("relayUrl").closest("details").open = true;
      field("relayUrl").focus();
      return;
    }
    if (v.relayUrl && !v.relayToken) {
      message(
        field("settingsFeedback"),
        "Enter the account token for this relay.",
        "error",
      );
      field("relayToken").closest("details").open = true;
      field("relayToken").focus();
      return;
    }
    const button = field("saveSettings");
    button.disabled = true;
    button.textContent = "Saving…";
    try {
      await setSettings(v);
      saved = v;
      message(field("settingsFeedback"), "Settings saved.", "success");
      if (v.enrichEnabled)
        chrome.runtime.sendMessage({ kind: "drain" }).catch(() => {});
      onSaved();
      await check();
    } catch {
      message(
        field("settingsFeedback"),
        "Settings could not be saved. Your changes are still here; try again.",
        "error",
      );
    } finally {
      button.disabled = false;
      button.textContent = "Save settings";
    }
  });
  return {
    async load() {
      saved = await getSettings();
      for (const key of ["agentUrl", "relayUrl", "relayToken"])
        field(key).value = saved[key];
      field("enrichEnabled").checked = saved.enrichEnabled;
      message(field("settingsFeedback"), "");
      await check();
    },
  };
}
