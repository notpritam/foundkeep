import test from 'node:test';
import assert from 'node:assert/strict';
import { capturePreviewSource, galleryColumns } from './preview.ts';

test('private previews construct only the owned API route and scope cache identity to the account', () => {
  const capture = { id: 'image-id', blobUrl: 'https://evil.example/steal', updatedAt: 12 };
  const result = capturePreviewSource(capture, 'private-token', 'account-a');
  assert.equal(result?.uri, 'https://foundkeep.app/api/mobile/captures/image-id/blob?account=account-a&v=12');
  assert.deepEqual(result?.headers, { Authorization: 'Bearer private-token' });
  assert.equal(capturePreviewSource(capture, null, 'account-a'), null);
});

test('uploaded image files use private file access; external article covers never receive credentials', () => {
  assert.match(capturePreviewSource({ id: 'f', fileUrl: '/file', fileMime: 'image/jpeg', updatedAt: 1 }, 'secret', 'a')!.uri, /\/mobile\/captures\/f\/file/);
  const source = capturePreviewSource({ provenance: { leadImageUrl: 'https://images.example/cover.jpg' } }, 'secret', 'a');
  assert.equal(source?.headers, undefined);
  assert.equal(source?.uri, 'https://images.example/cover.jpg');
  assert.equal(capturePreviewSource({ fileUrl: '/file', fileMime: 'image/svg+xml' }, 'secret', 'a'), null);
});

test('unsafe cover URLs are rejected and large text uses one accessible column', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com/a', 'https://user:password@example.com/a', 'file:///tmp/a', 'https://localhost/a', 'https://127.0.0.1/a']) {
    assert.equal(capturePreviewSource({ provenance: { leadImageUrl: url } }, 't', 'a'), null);
  }
  assert.equal(galleryColumns(390, 1), 2);
  assert.equal(galleryColumns(390, 1.4), 1);
  assert.equal(galleryColumns(300, 1), 1);
});
