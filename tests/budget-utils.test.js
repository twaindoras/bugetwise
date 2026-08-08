const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeTransactions } = require('../budget-utils.js');

test('returns zeros for an empty list', () => {
  const result = summarizeTransactions([]);
  assert.equal(result.income, 0);
  assert.equal(result.spent, 0);
  assert.equal(result.saved, 0);
  assert.deepEqual(result.byCategory, {});
});

test('sums income and expenses separately', () => {
  const rows = [
    { type: 'income', category: 'Income', amount: 1000 },
    { type: 'expense', category: 'Groceries', amount: 80 },
    { type: 'expense', category: 'Dining', amount: 20 },
  ];
  const result = summarizeTransactions(rows);
  assert.equal(result.income, 1000);
  assert.equal(result.spent, 100);
  assert.equal(result.saved, 900);
});

test('groups expenses by category', () => {
  const rows = [
    { type: 'expense', category: 'Groceries', amount: 50 },
    { type: 'expense', category: 'Groceries', amount: 30 },
    { type: 'expense', category: 'Dining', amount: 15 },
  ];
  const { byCategory } = summarizeTransactions(rows);
  assert.equal(byCategory.Groceries, 80);
  assert.equal(byCategory.Dining, 15);
});

test('income transactions are excluded from byCategory', () => {
  const rows = [{ type: 'income', category: 'Income', amount: 500 }];
  const { byCategory } = summarizeTransactions(rows);
  assert.deepEqual(byCategory, {});
});

test('treats a missing/invalid amount as zero rather than crashing', () => {
  const rows = [{ type: 'expense', category: 'Other', amount: undefined }];
  const result = summarizeTransactions(rows);
  assert.equal(result.spent, 0);
});

test('saved can go negative when spending exceeds income', () => {
  const rows = [
    { type: 'income', category: 'Income', amount: 100 },
    { type: 'expense', category: 'Housing', amount: 250 },
  ];
  const result = summarizeTransactions(rows);
  assert.equal(result.saved, -150);
});
