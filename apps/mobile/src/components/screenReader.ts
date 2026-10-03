/** Whether a screen reader is on. On the web react-native-web can't tell and always answers
 * yes, which kept the dock from ever collapsing and mounted every card in web previews; there
 * it counts as off. A check that fails counts as off too. */
export async function screenReaderOn(platform: string, check: () => Promise<boolean>) {
  if (platform === 'web') return false;
  try { return await check(); } catch { return false; }
}
