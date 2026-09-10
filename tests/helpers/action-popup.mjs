// Chrome toolbar popups are separate CDP targets, not Playwright tab pages.
export async function actionPopup(context, tab, worker) {
  const cdp = await context.newCDPSession(tab);
  const popupUrl = await worker.evaluate(() => chrome.action.getPopup({}));
  await worker.evaluate(() => chrome.action.openPopup());
  const deadline = Date.now() + 5000;
  let target;
  while (!target && Date.now() < deadline) {
    const { targetInfos } = await cdp.send('Target.getTargets');
    target = targetInfos.find(item => item.url === popupUrl);
    if (!target) await new Promise(resolve => setTimeout(resolve, 25));
  }
  if (!target) throw new Error('Chrome did not open the toolbar popup');
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: false });
  let sequence = 0;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { cdp.off('Target.receivedMessageFromTarget', receive); reject(new Error(`Popup ${method} timed out`)); }, 5000);
    const receive = event => {
      if (event.sessionId !== sessionId) return;
      const message = JSON.parse(event.message);
      if (message.id !== id) return;
      clearTimeout(timer); cdp.off('Target.receivedMessageFromTarget', receive);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result);
    };
    cdp.on('Target.receivedMessageFromTarget', receive);
    cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(error => {
      clearTimeout(timer); cdp.off('Target.receivedMessageFromTarget', receive); reject(error);
    });
  });
  const evaluate = async expression => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  };
  const waitFor = async expression => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error(`Popup condition did not become true: ${expression}`);
  };
  return { send, evaluate, waitFor, close: () => cdp.send('Target.closeTarget', { targetId: target.targetId }) };
}
