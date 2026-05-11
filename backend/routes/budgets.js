const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, checkPermission } = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const { year, month, categoryId } = req.query;
  let sql = `SELECT b.*, c.name as category_name 
    FROM budgets b 
    LEFT JOIN categories c ON b.category_id = c.id 
    WHERE 1=1`;
  const params = [];
  
  if (year) {
    sql += ' AND b.year = ?';
    params.push(year);
  }
  if (month) {
    sql += ' AND b.month = ?';
    params.push(month);
  }
  if (categoryId) {
    sql += ' AND b.category_id = ?';
    params.push(categoryId);
  }
  sql += ' ORDER BY b.year DESC, b.month DESC, b.id DESC';
  
  const budgets = db.prepare(sql).all(...params);
  res.json(budgets);
});

router.get('/status', auth, (req, res) => {
  const { year, month } = req.query;
  
  const budgets = db.prepare(`
    SELECT b.*, c.name as category_name, c.type 
    FROM budgets b 
    LEFT JOIN categories c ON b.category_id = c.id 
    WHERE b.year = ? AND b.month = ?
  `).all(year, month);
  
  const alertThreshold = db.prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'budget_alert_threshold'").get();
  const threshold = parseInt(alertThreshold?.setting_value || 80);
  
  const alerts = budgets.filter(b => {
    const percentage = (b.used_amount / b.amount) * 100;
    return percentage >= threshold;
  }).map(b => ({
    ...b,
    percentage: Math.round((b.used_amount / b.amount) * 100)
  }));
  
  res.json({ budgets, alerts, threshold });
});

router.post('/', auth, checkPermission('budget:write'), (req, res) => {
  const { categoryId, year, month, amount } = req.body;
  
  const existing = db.prepare('SELECT id FROM budgets WHERE category_id = ? AND year = ? AND month = ?').get(categoryId, year, month);
  if (existing) {
    return res.status(400).json({ error: '该类目本月已设置预算' });
  }
  
  const result = db.prepare(`
    INSERT INTO budgets (category_id, year, month, amount) VALUES (?, ?, ?, ?)
  `).run(categoryId, year, month, amount);
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id, details) VALUES (?, ?, ?, ?, ?)').run(req.user.id, '新增', '预算', result.lastInsertRowid, `设置预算 ${amount}`);
  
  res.json({ id: result.lastInsertRowid, message: '添加成功' });
});

router.put('/:id', auth, checkPermission('budget:write'), (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;
  
  db.prepare('UPDATE budgets SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(amount, id);
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id, details) VALUES (?, ?, ?, ?, ?)').run(req.user.id, '编辑', '预算', id, `修改预算 ${amount}`);
  
  res.json({ message: '更新成功' });
});

router.delete('/:id', auth, checkPermission('budget:write'), (req, res) => {
  const { id } = req.params;
  
  db.prepare('DELETE FROM budgets WHERE id = ?').run(id);
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id) VALUES (?, ?, ?, ?)').run(req.user.id, '删除', '预算', id);
  
  res.json({ message: '删除成功' });
});

module.exports = router;
