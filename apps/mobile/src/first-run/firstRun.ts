/** First run shows once on each device after signing in — the share sheet is
 * set up per device — and per environment, like the app's other device settings. */
export type FlagStore = { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> };
export const firstRunKey = (environment: string) => `foundkeep.${environment}.first-run`;

export function createFirstRun(store: FlagStore, environment: string) {
  const key = firstRunKey(environment);
  // Set by the sign-in handoff, taken by the app when it opens after it — so first run
  // follows a sign-in, not every launch, without racing the sign-in's own navigation.
  let afterSignIn = false;
  const due = async () => { try { return (await store.get(key)) !== 'seen'; } catch { return false; } };
  return {
    /** Not yet seen here. If the device can't say, it isn't due: signing in comes first. */
    due,
    async seen() { try { await store.set(key, 'seen'); } catch { /* shown again next time, at worst */ } },
    signedIn() { afterSignIn = true; },
    /** Whether to show first run now: just signed in, and not seen on this device. Asks once per sign-in. */
    async takeAfterSignIn() { const now = afterSignIn; afterSignIn = false; return now && await due(); },
  };
}
