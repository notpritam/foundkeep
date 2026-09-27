import { readFile } from 'node:fs/promises';
import path from 'node:path';

// The backend's own captureMethod allowlist (METHODS in
// apps/backend/src/customer-provenance.ts), read at test time so the
// extension's tests can never drift from what the server actually accepts —
// a method outside it 400s on upload with invalid_capture_context and the
// capture fails permanently even though the dock said "Saved" (R12).
export async function backendCaptureMethods() {
  const source = await readFile(path.resolve('apps/backend/src/customer-provenance.ts'), 'utf8');
  const body = source.match(/const METHODS = new Set\(\[([\s\S]*?)\]\)/)?.[1];
  if (!body) throw new Error('METHODS allowlist not found in customer-provenance.ts');
  const methods = new Set([...body.matchAll(/"([a-z0-9-]+)"/g)].map(match => match[1]));
  if (methods.size < 10) throw new Error('METHODS allowlist looks truncated: ' + [...methods]);
  return methods;
}
