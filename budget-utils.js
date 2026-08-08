/* ================================================================
   budget-utils.js
   Pure functions for turning a list of transactions into the
   numbers shown in the "My Budget" panel. No DOM, no network —
   kept separate from app.js so it's easy to unit test.
   ================================================================ */

/**
 * @param {Array<{type: 'income'|'expense', category: string, amount: number}>} rows
 * @returns {{income: number, spent: number, saved: number, byCategory: Record<string, number>}}
 */
function summarizeTransactions(rows) {
  let income = 0;
  let spent = 0;
  const byCategory = {};

  for (const r of rows) {
    const amount = Number(r.amount) || 0;
    if (r.type === 'income') {
      income += amount;
    } else {
      spent += amount;
      byCategory[r.category] = (byCategory[r.category] || 0) + amount;
    }
  }

  return { income, spent, saved: income - spent, byCategory };
}

// Expose in the browser (script tag) ...
if (typeof window !== 'undefined') {
  window.BudgetUtils = { summarizeTransactions };
}
// ... and in Node (require, for tests).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { summarizeTransactions };
}
