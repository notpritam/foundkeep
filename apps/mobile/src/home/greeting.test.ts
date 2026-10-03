import test from 'node:test';
import assert from 'node:assert/strict';
import { GREETINGS, greeting } from './greeting.ts';

const at = (iso: string) => new Date(iso);

test('the same part of the same day always gets the same greeting', () => {
  const a = greeting('Lena Kovacs', at('2026-10-03T08:10:00'));
  assert.equal(greeting('Lena Kovacs', at('2026-10-03T11:40:00')), a);
});

test('greetings change with the day, and the part of the day', () => {
  const seen = new Set<string>();
  for (let day = 1; day <= 20; day++) for (const hour of ['08', '14', '20']) seen.add(greeting('Lena', at(`2026-10-${String(day).padStart(2, '0')}T${hour}:00:00`)));
  assert.ok(seen.size >= 6, [...seen].join(' | '));
});

test('the time of day is right when the greeting names it', () => {
  for (let day = 1; day <= 28; day++) {
    const morning = greeting('Lena', at(`2026-10-${String(day).padStart(2, '0')}T08:00:00`));
    assert.ok(!/afternoon|evening/.test(morning), morning);
    const evening = greeting('Lena', at(`2026-10-${String(day).padStart(2, '0')}T20:00:00`));
    assert.ok(!/morning|afternoon/.test(evening), evening);
  }
});

test('it uses the first name, and never runs past one line', () => {
  assert.match(greeting('Lena Kovacs', at('2026-10-03T08:00:00')), /Lena/);
  for (let day = 1; day <= 28; day++) for (const hour of ['03', '08', '14', '20']) {
    const text = greeting('Maximiliana-Christabel Featherstonehaugh', at(`2026-10-${String(day).padStart(2, '0')}T${hour}:00:00`));
    assert.ok(text.length <= 22, text);
  }
});

test('with no name, a greeting that needs none', () => {
  const text = greeting(null, at('2026-10-03T08:00:00'));
  assert.ok(text.length > 0 && !/,\s*$/.test(text) && !/ $/.test(text), text);
});

test('every greeting fits with a typical name', () => {
  for (const make of Object.values(GREETINGS).flat()) assert.ok(make('Pritam').length <= 22, make('Pritam'));
});
