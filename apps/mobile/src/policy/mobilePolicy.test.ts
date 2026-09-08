import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MOBILE_POLICY, isCaptureEnabled, normalizeMobilePolicy, requiresBinaryUpdate } from './mobilePolicy.ts';

test('accepts a complete bounded data-only mobile policy', () => {
  const candidate = structuredClone(DEFAULT_MOBILE_POLICY);
  candidate.revision = 8;
  candidate.capture.video = false;
  candidate.limits.uploadTimeoutSeconds = 20;
  candidate.notice = 'Uploads are briefly delayed.';
  const policy = normalizeMobilePolicy(candidate);
  assert.equal(policy?.revision, 8);
  assert.equal(policy?.limits.articleCharacters, 500_000);
  assert.equal(isCaptureEnabled(policy!, 'video'), false);
  assert.equal(isCaptureEnabled(policy!, 'document'), true);
});

test('compares minimum binary versions numerically', () => {
  assert.equal(requiresBinaryUpdate('1.0.0', '1.0.0'), false);
  assert.equal(requiresBinaryUpdate('1.0.0', '1.0.1'), true);
  assert.equal(requiresBinaryUpdate('1.10.0', '1.2.9'), false);
});

test('rejects unknown fields, remote code, unsafe limits and invalid versions', () => {
  assert.equal(normalizeMobilePolicy({ ...DEFAULT_MOBILE_POLICY, script: 'alert(1)' }), null);
  assert.equal(normalizeMobilePolicy({ ...DEFAULT_MOBILE_POLICY, limits: { ...DEFAULT_MOBILE_POLICY.limits, fileBytes: 60 * 1024 * 1024 } }), null);
  assert.equal(normalizeMobilePolicy({ ...DEFAULT_MOBILE_POLICY, minimumVersion: 'latest' }), null);
  assert.equal(normalizeMobilePolicy({ ...DEFAULT_MOBILE_POLICY, notice: 'x'.repeat(201) }), null);
});
