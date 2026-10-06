const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('interface sources contain no replacement characters or corrupted accented labels', () => {
    const corrupted = /\uFFFD|Ã[§£©µª¡º³­]|â[€†œ]|[\p{L}]\?{2,}[\p{L}]|\bT\?tulos\b/u;
    const visit = (directory) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) visit(file);
            else if (/\.(?:tsx?|js|html)$/.test(file)) {
                assert.equal(corrupted.test(fs.readFileSync(file, 'utf8')), false, file);
            }
        }
    };
    visit('frontend');
    visit('shared');
});
