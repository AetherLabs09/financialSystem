const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth } = require('../middleware/auth');

router.get('/summary', auth, (req, res) => {
  const { startDate, endDate, year, month } = req.query;
  
  let dateFilter = '1=1';
  const params = [];
  
  if (startDate && endDate) {
    dateFilter = 't.transaction_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  } else if (year && month) {
    dateFilter = "strftime('%Y', t.transaction_date) = ? AND strftime('%m', t.transaction_date) = ?";
    params.push(year, month.padStart(2, '0'));
  } else if (year) {
    dateFilter = "strftime('%Y', t.transaction_date) = ?";
    params.push(year);
  }
  
  const incomeTotal = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total 
    FROM transactions t 
    WHERE t.type = 'income' AND t.status = 1 AND ${dateFilter}
  `).get(...params);
  
  const expenseTotal = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total 
    FROM transactions t 
    WHERE t.type = 'expense' AND t.status = 1 AND ${dateFilter}
  `).get(...params);
  
  const profit = incomeTotal.total - expenseTotal.total;
  
  res.json({
    income: incomeTotal.total,
    expense: expenseTotal.total,
    profit
  });
});

router.get('/by-category', auth, (req, res) => {
  const { startDate, endDate, type, year, month } = req.query;
  
  let dateFilter = '1=1';
  const params = [];
  
  if (startDate && endDate) {
    dateFilter = 't.transaction_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  } else if (year && month) {
    dateFilter = "strftime('%Y', t.transaction_date) = ? AND strftime('%m', t.transaction_date) = ?";
    params.push(year, month.padStart(2, '0'));
  } else if (year) {
    dateFilter = "strftime('%Y', t.transaction_date) = ?";
    params.push(year);
  }
  
  let sql = `
    SELECT c.id, c.name, c.type, COALESCE(SUM(t.amount), 0) as total
    FROM categories c
    LEFT JOIN transactions t ON c.id = t.category_id AND t.status = 1 AND ${dateFilter}
  `;
  
  if (type) {
    sql += ' AND c.type = ?';
    params.push(type);
  }
  
  sql += ' GROUP BY c.id ORDER BY total DESC';
  
  const data = db.prepare(sql).all(...params);
  res.json(data);
});

router.get('/by-date', auth, (req, res) => {
  const { startDate, endDate, type, year, month } = req.query;
  
  let dateFilter = '1=1';
  const params = [];
  
  if (startDate && endDate) {
    dateFilter = 't.transaction_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  } else if (year && month) {
    dateFilter = "strftime('%Y', t.transaction_date) = ? AND strftime('%m', t.transaction_date) = ?";
    params.push(year, month.padStart(2, '0'));
  } else if (year) {
    dateFilter = "strftime('%Y', t.transaction_date) = ?";
    params.push(year);
  }
  
  let typeFilter = '1=1';
  if (type) {
    typeFilter = 't.type = ?';
    params.push(type);
  }
  
  const sql = `
    SELECT t.transaction_date, 
      COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as expense
    FROM transactions t
    WHERE t.status = 1 AND ${dateFilter} AND ${typeFilter}
    GROUP BY t.transaction_date
    ORDER BY t.transaction_date
  `;
  
  const data = db.prepare(sql).all(...params);
  res.json(data);
});

router.get('/monthly', auth, (req, res) => {
  const { year } = req.query;
  const targetYear = year || new Date().getFullYear();
  
  const sql = `
    SELECT 
      strftime('%m', t.transaction_date) as month,
      COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as expense
    FROM transactions t
    WHERE t.status = 1 AND strftime('%Y', t.transaction_date) = ?
    GROUP BY strftime('%m', t.transaction_date)
    ORDER BY month
  `;
  
  const data = db.prepare(sql).all(targetYear);
  
  const result = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    const found = data.find(d => d.month === month);
    return {
      month: i + 1,
      income: found?.income || 0,
      expense: found?.expense || 0
    };
  });
  
  res.json(result);
});

router.get('/by-partner', auth, (req, res) => {
  const { startDate, endDate, year, month } = req.query;
  
  let dateFilter = '1=1';
  const params = [];
  
  if (startDate && endDate) {
    dateFilter = 't.transaction_date BETWEEN ? AND ?';
    params.push(startDate, endDate);
  } else if (year && month) {
    dateFilter = "strftime('%Y', t.transaction_date) = ? AND strftime('%m', t.transaction_date) = ?";
    params.push(year, month.padStart(2, '0'));
  } else if (year) {
    dateFilter = "strftime('%Y', t.transaction_date) = ?";
    params.push(year);
  }
  
  const sql = `
    SELECT p.id, p.name, p.type,
      COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as expense,
      p.current_debt
    FROM partners p
    LEFT JOIN transactions t ON p.id = t.partner_id AND t.status = 1 AND ${dateFilter}
    WHERE p.status = 1
    GROUP BY p.id
    ORDER BY (income + expense) DESC
  `;
  
  const data = db.prepare(sql).all(...params);
  res.json(data);
});

module.exports = router;
