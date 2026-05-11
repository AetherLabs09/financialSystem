const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, checkPermission } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

router.get('/', auth, checkPermission('user:read'), (req, res) => {
  const { role, status } = req.query;
  let sql = 'SELECT id, username, real_name, role, permissions, status, created_at, updated_at FROM users WHERE 1=1';
  const params = [];
  
  if (role) {
    sql += ' AND role = ?';
    params.push(role);
  }
  if (status !== undefined) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY id DESC';
  
  const users = db.prepare(sql).all(...params);
  res.json(users.map(u => ({ ...u, permissions: JSON.parse(u.permissions || '[]') })));
});

router.get('/:id', auth, (req, res) => {
  const { id } = req.params;
  const user = db.prepare('SELECT id, username, real_name, role, permissions, status, created_at FROM users WHERE id = ?').get(id);
  
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  res.json({ ...user, permissions: JSON.parse(user.permissions || '[]') });
});

router.post('/', auth, checkPermission('user:write'), (req, res) => {
  const { username, password, realName, role, permissions } = req.body;
  
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ error: '用户名已存在' });
  }
  
  const hashedPassword = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (username, password, real_name, role, permissions) VALUES (?, ?, ?, ?, ?)
  `).run(username, hashedPassword, realName, role, JSON.stringify(permissions || []));
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id, details) VALUES (?, ?, ?, ?, ?)').run(req.user.id, '新增', '用户', result.lastInsertRowid, username);
  
  res.json({ id: result.lastInsertRowid, message: '添加成功' });
});

router.put('/:id', auth, checkPermission('user:write'), (req, res) => {
  const { id } = req.params;
  const { realName, role, permissions, status, password } = req.body;
  
  if (password) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.prepare(`
      UPDATE users SET real_name = ?, role = ?, permissions = ?, status = ?, password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(realName, role, JSON.stringify(permissions || []), status, hashedPassword, id);
  } else {
    db.prepare(`
      UPDATE users SET real_name = ?, role = ?, permissions = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(realName, role, JSON.stringify(permissions || []), status, id);
  }
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id, details) VALUES (?, ?, ?, ?, ?)').run(req.user.id, '编辑', '用户', id, realName);
  
  res.json({ message: '更新成功' });
});

router.delete('/:id', auth, checkPermission('user:write'), (req, res) => {
  const { id } = req.params;
  
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: '不能删除自己' });
  }
  
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id) VALUES (?, ?, ?, ?)').run(req.user.id, '删除', '用户', id);
  
  res.json({ message: '删除成功' });
});

router.get('/logs', auth, checkPermission('user:read'), (req, res) => {
  const { userId, module, page = 1, pageSize = 50 } = req.query;
  let sql = `SELECT l.*, u.username, u.real_name FROM audit_logs l LEFT JOIN users u ON l.user_id = u.id WHERE 1=1`;
  const params = [];
  
  if (userId) {
    sql += ' AND l.user_id = ?';
    params.push(userId);
  }
  if (module) {
    sql += ' AND l.module = ?';
    params.push(module);
  }
  
  const countSql = sql.replace('SELECT l.*, u.username, u.real_name', 'SELECT COUNT(*) as total');
  const totalResult = db.prepare(countSql).get(...params);
  const total = totalResult.total;
  
  sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
  
  const logs = db.prepare(sql).all(...params);
  res.json({ list: logs, total, page: parseInt(page), pageSize: parseInt(pageSize) });
});

module.exports = router;
