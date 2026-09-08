import { requireNativeModule } from 'expo';

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

export default requireNativeModule<NativeFoundkeepShared>('FoundkeepShared');
