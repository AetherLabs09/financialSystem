const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { JWT_SECRET } = require('../middleware/auth');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND status = 1').get(username);
  
  if (!user) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  
  const isValid = bcrypt.compareSync(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, permissions: JSON.parse(user.permissions || '[]'), realName: user.real_name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)').run(user.id, '登录', 'auth', '用户登录系统');
  
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      realName: user.real_name,
      role: user.role,
      permissions: JSON.parse(user.permissions || '[]')
    }
  });
});

router.post('/change-password', (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  const isValid = bcrypt.compareSync(oldPassword, user.password);
  if (!isValid) {
    return res.status(400).json({ error: '原密码错误' });
  }
  
  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashedPassword, userId);
  
  res.json({ message: '密码修改成功' });
});

router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (err) {
    res.status(401).json({ error: 'token无效或已过期' });
  }
});

module.exports = router;
