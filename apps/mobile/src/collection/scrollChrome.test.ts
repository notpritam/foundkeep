import test from 'node:test';
import assert from 'node:assert/strict';
import { createScrollChrome } from './scrollChrome.ts';
test('header follows downward travel, then reveals on a deliberate reversal', () => {
  const chrome = createScrollChrome(200);
  assert.equal(chrome.scroll(60, 1000), 60);
  assert.equal(chrome.scroll(240, 1000), 200);
  assert.equal(chrome.scroll(238, 1000), 200);
  assert.equal(chrome.scroll(220, 1000), 180);
  assert.equal(chrome.scroll(30, 1000), 0);
});
test('top and bottom overscroll cannot make the header jitter or reappear', () => {
  const chrome = createScrollChrome(200);
  assert.equal(chrome.scroll(-50, 600), 0);
  assert.equal(chrome.scroll(0, 600), 0);
  assert.equal(chrome.scroll(600, 600), 200);
  assert.equal(chrome.scroll(680, 600), 200);
  assert.equal(chrome.scroll(610, 600), 200);
  assert.equal(chrome.scroll(600, 600), 200);
  assert.equal(chrome.scroll(580, 600), 180);
});
test('search stays expanded and large-text changes keep the measured bounds', () => {
  const chrome = createScrollChrome(200);
  chrome.scroll(400, 1000);
  assert.equal(chrome.scroll(500, 1000, true), 0);
  assert.equal(chrome.scroll(550, 1000, true), 0);
  assert.equal(chrome.scroll(600, 1000), 50);
  assert.equal(chrome.resize(30), 30);
  assert.equal(chrome.reveal(), 0);
});
