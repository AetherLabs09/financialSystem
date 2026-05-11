const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, checkPermission } = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const { type, status, keyword } = req.query;
  let sql = 'SELECT * FROM partners WHERE 1=1';
  const params = [];
  
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  if (status !== undefined) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (keyword) {
    sql += ' AND (name LIKE ? OR contact LIKE ? OR phone LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  sql += ' ORDER BY id DESC';
  
  const partners = db.prepare(sql).all(...params);
  res.json(partners);
});

router.get('/:id', auth, (req, res) => {
  const { id } = req.params;
  const partner = db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
  
  if (!partner) {
    return res.status(404).json({ error: '往来单位不存在' });
  }
  
  const transactions = db.prepare(`
    SELECT t.*, c.name as category_name 
    FROM transactions t 
    LEFT JOIN categories c ON t.category_id = c.id 
    WHERE t.partner_id = ? 
    ORDER BY t.transaction_date DESC
  `).all(id);
  
  res.json({ ...partner, transactions });
});

router.post('/', auth, checkPermission('partner:write'), (req, res) => {
  const { name, type, contact, phone, address, initialDebt } = req.body;
  
  const result = db.prepare(`
    INSERT INTO partners (name, type, contact, phone, address, initial_debt, current_debt) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, type, contact, phone, address, initialDebt || 0, initialDebt || 0);
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id, details) VALUES (?, ?, ?, ?, ?)').run(req.user.id, '新增', '往来单位', result.lastInsertRowid, name);
  
  res.json({ id: result.lastInsertRowid, message: '添加成功' });
});

router.put('/:id', auth, checkPermission('partner:write'), (req, res) => {
  const { id } = req.params;
  const { name, type, contact, phone, address, status } = req.body;
  
  db.prepare(`
    UPDATE partners SET name = ?, type = ?, contact = ?, phone = ?, address = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(name, type, contact, phone, address, status, id);
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id, details) VALUES (?, ?, ?, ?, ?)').run(req.user.id, '编辑', '往来单位', id, name);
  
  res.json({ message: '更新成功' });
});

router.delete('/:id', auth, checkPermission('partner:write'), (req, res) => {
  const { id } = req.params;
  
  const transactions = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE partner_id = ?').get(id);
  if (transactions.count > 0) {
    return res.status(400).json({ error: '该往来单位有收支记录，无法删除' });
  }
  
  db.prepare('DELETE FROM partners WHERE id = ?').run(id);
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id) VALUES (?, ?, ?, ?)').run(req.user.id, '删除', '往来单位', id);
  
  res.json({ message: '删除成功' });
});

module.exports = router;
