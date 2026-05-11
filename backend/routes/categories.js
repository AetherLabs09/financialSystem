const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, checkPermission } = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const { type, status } = req.query;
  let sql = 'SELECT * FROM categories WHERE 1=1';
  const params = [];
  
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  if (status !== undefined) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY sort_order, id';
  
  const categories = db.prepare(sql).all(...params);
  res.json(categories);
});

router.post('/', auth, checkPermission('category:write'), (req, res) => {
  const { name, type, parentId, sortOrder } = req.body;
  
  const result = db.prepare(`
    INSERT INTO categories (name, type, parent_id, sort_order) VALUES (?, ?, ?, ?)
  `).run(name, type, parentId || 0, sortOrder || 0);
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id, details) VALUES (?, ?, ?, ?, ?)').run(req.user.id, '新增', '类目', result.lastInsertRowid, name);
  
  res.json({ id: result.lastInsertRowid, message: '添加成功' });
});

router.put('/:id', auth, checkPermission('category:write'), (req, res) => {
  const { id } = req.params;
  const { name, type, parentId, sortOrder, status } = req.body;
  
  db.prepare(`
    UPDATE categories SET name = ?, type = ?, parent_id = ?, sort_order = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(name, type, parentId || 0, sortOrder || 0, status, id);
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id, details) VALUES (?, ?, ?, ?, ?)').run(req.user.id, '编辑', '类目', id, name);
  
  res.json({ message: '更新成功' });
});

router.delete('/:id', auth, checkPermission('category:write'), (req, res) => {
  const { id } = req.params;
  
  const transactions = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE category_id = ?').get(id);
  if (transactions.count > 0) {
    return res.status(400).json({ error: '该类目下有收支记录，无法删除' });
  }
  
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id) VALUES (?, ?, ?, ?)').run(req.user.id, '删除', '类目', id);
  
  res.json({ message: '删除成功' });
});

module.exports = router;
