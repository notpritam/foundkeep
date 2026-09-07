// Local-first capture queue. Every capture commits to IndexedDB before this
// module acknowledges it; connected captures then enter the durable cloud
// outbox without holding up the local save.
import * as db from "./db.js";
import { captureBinding, drainCloudQueue } from "./cloud.js";

/** Save a capture locally and kick off a drain attempt. */
export async function saveCapture(input) {
  const rec = await db.addCapture({ ...input, ...(await captureBinding()) });
  drainQueue().catch(() => {});
  broadcast();
  return rec;
}

function broadcast() {
  try {
    chrome.runtime.sendMessage({ kind: "atlas-changed" }).catch(() => {});
  } catch {
    /* no listener open — fine */
  }
}

/** Retry the connected account's durable cloud outbox. */
export async function drainQueue() {
  await drainCloudQueue();
  broadcast();
}
