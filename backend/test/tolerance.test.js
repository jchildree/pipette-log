const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tolerance3pct } = require('../src/lib/tolerance');

test('97 -> Y (lower bound inclusive)', () => {
    assert.equal(tolerance3pct(100, 97), 'Y');
});

test('96.9 -> N (just below lower bound)', () => {
    assert.equal(tolerance3pct(100, 96.9), 'N');
});

test('103 -> Y (upper bound inclusive)', () => {
    assert.equal(tolerance3pct(100, 103), 'Y');
});

test('103.1 -> N (just above upper bound)', () => {
    assert.equal(tolerance3pct(100, 103.1), 'N');
});
