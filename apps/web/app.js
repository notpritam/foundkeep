const saveButton = document.querySelector("#demoSave");
const resetButton = document.querySelector("#demoReset");

function setDemoSaved(saved) {
  document.querySelector("#demoEmpty").hidden = saved;
  document.querySelector("#demoSaved").hidden = !saved;
  document.querySelector("#demoCount").textContent = saved
    ? "1 item"
    : "0 items";
  document.querySelector("#demo-selection").classList.toggle("is-saved", saved);
  saveButton.disabled = saved;
  document.querySelector("#demoStatus").textContent = saved
    ? "Highlight saved in this illustration. Your Foundkeep library has not changed."
    : "Try it here. This demo does not save to your Foundkeep library.";
  // Move focus to the next useful action when its previous control disappears.
  (saved ? resetButton : saveButton).focus({ preventScroll: true });
}

saveButton?.addEventListener("click", () => setDemoSaved(true));
resetButton?.addEventListener("click", () => setDemoSaved(false));

// A Web Store install button is shown only when a verified public listing is configured.
import("./customer.js?v=1.5.0")
  .then(({ customerConfig }) => customerConfig())
  .then((config) => {
    if (!config.storeUrl) return;
    const install = document.querySelector("[data-extension-install]");
    if (!install) return;
    install.href = config.storeUrl;
    install.removeAttribute("download");
    install.target = "_blank";
    install.rel = "noopener noreferrer";
    install.textContent = "Add to Chrome";
    document.querySelector(".download-note").textContent =
      "Available now in the Chrome Web Store · Version 1.0.0 · Automatic updates";
    if (!document.querySelector("[data-manual-install]")) {
      const manual = document.createElement("a");
      manual.href = "foundkeep-extension.zip?build=1.6.1";
      manual.download = "foundkeep-extension.zip";
      manual.dataset.manualInstall = "";
      manual.className = "text-link local-install-choice";
      manual.textContent = "Manual ZIP for Edge, Brave, Opera or Vivaldi";
      install.after(manual);
    }
  })
  .catch(() => {
    /* Manual ZIP installation remains available without configuration. */
  });

// The compact menu is progressively enhanced; without JS, hero and footer links remain usable.
const menuToggle = document.querySelector(".menu-toggle");
const mobileNav = document.querySelector("#mobile-nav");
if (menuToggle && mobileNav) {
  menuToggle.hidden = false;
  const closeMenu = (restoreFocus = false) => {
    mobileNav.hidden = true;
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open navigation");
    if (restoreFocus) menuToggle.focus();
  };
  menuToggle.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") !== "true";
    mobileNav.hidden = !open;
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute(
      "aria-label",
      open ? "Close navigation" : "Open navigation",
    );
  });
  mobileNav.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !mobileNav.hidden) closeMenu(true);
  });
  document.addEventListener("click", (event) => {
    if (
      !mobileNav.hidden &&
      !mobileNav.contains(event.target) &&
      !menuToggle.contains(event.target)
    )
      closeMenu();
  });
  const desktop = matchMedia("(min-width: 541px)");
  desktop.addEventListener("change", (event) => {
    if (event.matches) closeMenu();
  });
}
