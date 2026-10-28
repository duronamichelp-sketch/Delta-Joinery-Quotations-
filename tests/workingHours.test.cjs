const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

process.env.TZ = 'Europe/Dublin';

// Compile the pure helper in memory without changing the app's build setup.
const filename = path.resolve(__dirname, '../lib/workingHours.ts');
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  fileName: filename,
}).outputText;
const helperModule = new Module(filename, module);
helperModule.filename = filename;
helperModule.paths = Module._nodeModulePaths(path.dirname(filename));
helperModule._compile(compiled, filename);

const { localDateKey, weekStart, parseTime, formatTime, entryHours, entryTimerState, weekHours, formatElapsed } = helperModule.exports;
const today = '2026-10-28';
const at = time => new Date(today + 'T' + time);
const open = { start: '8:00 AM', finish: '', breakMinutes: '' };

test('a future start waits until its exact boundary, then counts real seconds', () => {
  for (const time of ['07:45:00', '07:59:59']) {
    assert.equal(entryHours(open, today, at(time)), 0);
    assert.equal(entryTimerState(open, today, at(time)), 'scheduled');
  }
  assert.equal(entryHours(open, today, at('08:00:00')), 0);
  assert.equal(entryTimerState(open, today, at('08:00:00')), 'running');
  assert.equal(entryHours(open, today, at('08:00:01')), 1 / 3600);
  assert.equal(entryHours(open, today, at('09:30:00')), 1.5);
});

test('finishing freezes the entered interval; edits and clearing recompute it', () => {
  const finished = { ...open, finish: '09:00 AM' };
  assert.equal(entryHours(finished, today, at('09:30:00')), 1);
  assert.equal(entryHours(finished, today, at('18:00:00')), 1);
  assert.equal(entryTimerState(finished, today, at('18:00:00')), null);
  assert.equal(entryHours({ ...finished, finish: '09:15 AM' }, today, at('18:00:00')), 1.25);
  assert.equal(entryHours({ ...finished, finish: '' }, today, at('09:30:00')), 1.5);
  assert.equal(entryTimerState({ ...finished, finish: '' }, today, at('09:30:00')), 'running');
  assert.equal(entryHours({ ...open, start: '09:45 AM' }, today, at('09:30:00')), 0);
  assert.equal(entryTimerState({ ...open, start: '09:45 AM' }, today, at('09:30:00')), 'scheduled');
});

test('N/A, blank, and invalid entries contribute zero without running', () => {
  const entries = [undefined, { start: '', finish: '' }, { ...open, notWorked: true }, { ...open, notWorked: true, finish: '5 PM' }, { ...open, start: '25:00' }, { ...open, finish: 'bad time' }];
  for (const entry of entries) {
    assert.equal(entryHours(entry, today, at('09:30:00')), 0);
    assert.equal(entryTimerState(entry, today, at('09:30:00')), null);
  }
  assert.equal(entryHours({ ...open, finish: '   ' }, today, at('09:30:00')), 1.5);
});

test('unfinished past and future rows never acquire live hours', () => {
  for (const date of ['2026-10-27', '2026-10-29']) {
    assert.equal(entryHours(open, date, at('09:30:00')), 0);
    assert.equal(entryTimerState(open, date, at('09:30:00')), null);
  }
  assert.equal(entryHours({ ...open, finish: '5 PM' }, '2026-10-27', at('09:30:00')), 9);
});

test('legacy rows with missing fields do not throw or invent hours', () => {
  for (const entry of [{ start: '8' }, { start: '8', finish: null }]) {
    assert.equal(entryHours(entry, today, at('09:30:00')), 1.5);
    assert.equal(entryTimerState(entry, today, at('09:30:00')), 'running');
  }
  for (const entry of [{}, { finish: '5 PM' }, { start: null }, { start: 800, finish: '' }, { start: '8', finish: 900 }]) {
    assert.equal(entryHours(entry, today, at('09:30:00')), 0);
    assert.equal(entryTimerState(entry, today, at('09:30:00')), null);
  }
  for (const raw of [undefined, null, 800, {}]) assert.equal(parseTime(raw, 'start'), null);
});

test('saved input conventions and normalization remain compatible', () => {
  const cases = [
    ['8', 'start', 480], ['745', 'start', 465], ['0745', 'start', 465],
    ['8am', 'start', 480], [' 8:00 am ', 'start', 480],
    ['5', 'finish', 1020], ['530', 'finish', 1050], ['5:30 AM', 'finish', 330],
    ['18:42 PM', 'finish', 1122], ['12 AM', 'start', 0], ['12 PM', 'finish', 720],
    ['00:00', 'start', 0], ['23:59', 'finish', 1439],
    ['', 'start', null], ['25:00', 'start', null], ['08:60', 'start', null],
    ['abc', 'finish', null], ['8:00:00', 'start', null],
  ];
  for (const [raw, kind, expected] of cases) assert.equal(parseTime(raw, kind), expected, raw);
  assert.equal(formatTime('8', 'start'), '8:00 AM');
  assert.equal(formatTime('5', 'finish'), '17:00 PM');
  assert.equal(formatTime('18:42 PM', 'finish'), '18:42 PM');
  assert.equal(formatTime('invalid', 'start'), 'invalid');
});

test('completed overnight hours and existing break handling are unchanged', () => {
  assert.equal(entryHours({ start: '22:00', finish: '06:00 AM' }, today, at('09:30:00')), 8);
  assert.equal(entryHours({ start: '8 AM', finish: '18:42 PM', breakMinutes: '30' }, today, at('09:30:00')), 10.7);
});

test('weekly total combines completed days and the running day only', () => {
  const records = {
    '2026-10-25': { ...open, finish: '5 PM' },
    '2026-10-26': { ...open, finish: '18:42 PM' },
    '2026-10-27': open,
    [today]: open,
    '2026-10-29': open,
    '2026-10-30': { ...open, notWorked: true },
    '2026-11-02': { ...open, finish: '5 PM' },
  };
  assert.equal(weekHours(records, at('09:30:00')), 12.2);
  assert.equal(weekHours(records, at('07:45:00')), 10.7);
  assert.equal(weekHours({ ...records, [today]: { ...open, finish: '09:00 AM' } }, at('18:00:00')), 11.7);
  assert.equal(weekHours({ ...records, '2026-10-29': { ...open, finish: '10:00 AM' } }, at('09:30:00')), 14.2);
});

test('local date and Monday rollover work near UTC midnight in Irish summer time', () => {
  const localMonday = new Date('2026-06-28T23:30:00Z');
  assert.equal(localDateKey(localMonday), '2026-06-29');
  assert.equal(localDateKey(weekStart(localMonday)), '2026-06-29');
  assert.equal(weekStart(localMonday).getHours(), 12);
  assert.equal(localDateKey(weekStart(new Date('2026-06-28T22:30:00Z'))), '2026-06-22');
  assert.equal(entryHours({ start: '00:00', finish: '' }, '2026-06-29', localMonday), 0.5);
  assert.equal(weekHours({
    '2026-06-28': { start: '8 AM', finish: '5 PM' },
    '2026-06-29': { start: '00:00', finish: '' },
  }, localMonday), 0.5);
});

test('elapsed formatting preserves seconds, long weeks, and zero before starting', () => {
  assert.equal(formatElapsed(0), '00:00:00');
  assert.equal(formatElapsed(1 / 3600), '00:00:01');
  assert.equal(formatElapsed(59 / 3600), '00:00:59');
  assert.equal(formatElapsed(3661 / 3600), '01:01:01');
  assert.equal(formatElapsed(40.5), '40:30:00');
  assert.equal(formatElapsed(1.999 / 3600), '00:00:01');
  assert.equal(formatElapsed(-1), '00:00:00');
  assert.equal(formatElapsed(NaN), '00:00:00');
});

test('reloaded entries and resumed tabs derive elapsed time from the saved start', () => {
  const reloaded = JSON.parse(JSON.stringify(open));
  assert.equal(entryHours(reloaded, today, at('08:00:01')), 1 / 3600);
  assert.equal(entryHours(reloaded, today, at('12:30:45')), 4.5 + 45 / 3600);
  assert.equal(formatElapsed(entryHours(reloaded, today, at('12:30:45'))), '04:30:45');
  assert.deepEqual(reloaded, open);
});
