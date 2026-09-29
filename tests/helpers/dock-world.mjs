export async function dockWorld(page, extensionId) {
  const cdp = await page.context().newCDPSession(page);
  const worlds = new Map();
  cdp.on('Runtime.executionContextCreated', ({ context }) => {
    if (context.auxData?.type === 'isolated' && (context.origin === `chrome-extension://${extensionId}` || /FoundKeep/.test(context.name))) worlds.set(context.auxData.frameId, context.id);
  });
  cdp.on('Runtime.executionContextsCleared', () => worlds.clear());
  await cdp.send('Runtime.enable');
  const mainFrame = async () => (await cdp.send('Page.getFrameTree')).frameTree.frame.id;
  async function evaluate(expression) {
    for (let i = 0; i < 100; i++) {
      const id = worlds.get(await mainFrame());
      if (id) {
        const r = await cdp.send('Runtime.evaluate', { contextId: id, expression, returnByValue: true, awaitPromise: true });
        if (!r.exceptionDetails) return r.result.value;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Dock world not available: ' + expression);
  }
  const waitFor = async (expression, timeout = 5000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if (await evaluate(`!!(${expression})`)) return; await new Promise(r => setTimeout(r, 100)); }
    throw new Error('Timed out: ' + expression);
  };
  // The collapsed tab slides up when it appears: click where it settles.
  const settled = async selector => {
    let last = null;
    for (let i = 0; i < 20; i++) {
      const r = await evaluate(`__foundkeepDock.rect(${JSON.stringify(selector)})`);
      if (last && ['x', 'y', 'width', 'height'].every(k => Math.abs(r[k] - last[k]) < 0.5)) return r;
      last = r; await new Promise(resolve => setTimeout(resolve, 40));
    }
    return last;
  };
  const click = async selector => {
    const r = await settled(selector);
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  };
  return { evaluate, waitFor, click };
}
