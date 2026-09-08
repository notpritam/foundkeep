type NativeFoundkeepShared = {
  setSession(token: string, accountJson: string): Promise<void>;
  refreshSession(token: string, accountJson: string): Promise<void>;
  getToken(): Promise<string | null>;
  clearSession(): Promise<void>;
  pendingCount(): Promise<number>;
  blockedPendingCount(): Promise<number>;
  resolveBlockedPendingToUnfiled(): Promise<number>;
  retryPending(): Promise<number>;
  downloadCaptureFile(captureId: string, fileName: string): Promise<string>;
  getPolicy(): Promise<string | null>;
  setPolicy(policyJson: string): Promise<void>;
};

const storage = () => typeof localStorage === 'undefined' ? null : localStorage;
const FoundkeepShared: NativeFoundkeepShared = {
  async setSession(token, accountJson) { storage()?.setItem('foundkeep-device-token', token); storage()?.setItem('foundkeep-account', accountJson); },
  async refreshSession(token, accountJson) { if (storage()?.getItem('foundkeep-device-token') === token) storage()?.setItem('foundkeep-account', accountJson); },
  async getToken() { return storage()?.getItem('foundkeep-device-token') || null; },
  async clearSession() { storage()?.removeItem('foundkeep-device-token'); storage()?.removeItem('foundkeep-account'); },
  async pendingCount() { return 0; },
  async blockedPendingCount() { return 0; },
  async resolveBlockedPendingToUnfiled() { return 0; },
  async retryPending() { return 0; },
  async downloadCaptureFile() { throw new Error('Open files in the Foundkeep iPhone app.'); },
  async getPolicy() { return storage()?.getItem('foundkeep-mobile-policy') || null; },
  async setPolicy(policyJson) { storage()?.setItem('foundkeep-mobile-policy', policyJson); },
};

export default FoundkeepShared;
