const test = require('node:test');
const assert = require('node:assert/strict');

const {
    findScheduledStoreId,
    getWeekdayFromIsoDate,
    normalizeEntityName,
    normalizeMatchPoints
} = require('../config/tournament-utils.js');

test('match points preserve zero and leave missing values null', () => {
    assert.equal(normalizeMatchPoints(0), 0);
    assert.equal(normalizeMatchPoints('0'), 0);
    assert.equal(normalizeMatchPoints('12'), 12);
    assert.equal(normalizeMatchPoints(''), null);
    assert.equal(normalizeMatchPoints(null), null);
});

test('invalid match points are rejected', () => {
    assert.equal(normalizeMatchPoints('-1'), null);
    assert.equal(normalizeMatchPoints('1.5'), null);
    assert.equal(normalizeMatchPoints('abc'), null);
});

test('entity names match case, accents and repeated whitespace', () => {
    assert.equal(normalizeEntityName('  ImperialdrÁmon   Azul '), 'imperialdramon azul');
    assert.equal(normalizeEntityName('Deck-X'), 'deck x');
});

test('ISO dates resolve weekdays without local timezone shifts', () => {
    assert.equal(getWeekdayFromIsoDate('2026-07-27'), 1);
    assert.equal(getWeekdayFromIsoDate('2026-08-01'), 6);
    assert.equal(getWeekdayFromIsoDate('2026-02-30'), null);
    assert.equal(getWeekdayFromIsoDate('27/07/2026'), null);
});

test('weekly schedule returns the active store for a tournament date', () => {
    const schedule = [
        { weekday: 1, store_id: 'taverna', is_active: true },
        { weekday: 3, store_id: 'gladiators', is_active: false }
    ];
    assert.equal(findScheduledStoreId(schedule, '2026-07-27'), 'taverna');
    assert.equal(findScheduledStoreId(schedule, '2026-07-29'), null);
    assert.equal(findScheduledStoreId(schedule, '2026-07-28'), null);
});
