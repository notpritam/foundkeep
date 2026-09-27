// page.waitForFunction() does not await an async predicate's returned
// promise — it checks the promise object itself for truthiness, which is
// always true, so it resolves on the very first poll regardless of what the
// predicate eventually resolves to. Poll from Node with page.evaluate()
// (which does correctly await async functions) instead, wherever the
// condition depends on an async check.
export async function pollUntil(page, fn, arg, { timeout = 10000, interval = 50 } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await page.evaluate(fn, arg)) return;
    if (Date.now() > deadline) throw new Error('Timed out waiting for condition: ' + fn);
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}
