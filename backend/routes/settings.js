const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, checkPermission } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

router.get('/', auth, (req, res) => {
  const settings = db.prepare('SELECT * FROM system_settings').all();
  const result = {};
  settings.forEach(s => {
    result[s.setting_key] = s.setting_value;
  });
  res.json(result);
});

router.put('/', auth, checkPermission('setting:write'), (req, res) => {
  const settings = req.body;
  
  Object.entries(settings).forEach(([key, value]) => {
    db.prepare(`
      INSERT INTO system_settings (setting_key, setting_value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(setting_key) DO UPDATE SET setting_value = ?, updated_at = CURRENT_TIMESTAMP
    `).run(key, value, value);
  });
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)').run(req.user.id, '修改', '系统设置', JSON.stringify(settings));
  
  res.json({ message: '保存成功' });
});

router.get('/years', auth, (req, res) => {
  const years = db.prepare('SELECT * FROM financial_years ORDER BY year DESC').all();
  res.json(years);
});

router.post('/years', auth, checkPermission('setting:write'), (req, res) => {
  const { year } = req.body;
  
  const existing = db.prepare('SELECT id FROM financial_years WHERE year = ?').get(year);
  if (existing) {
    return res.status(400).json({ error: '该年度已存在' });
  }
  
  db.prepare('INSERT INTO financial_years (year) VALUES (?)').run(year);
  db.prepare('INSERT INTO audit_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)').run(req.user.id, '新增', '财务年度', year);
  
  res.json({ message: '添加成功' });
});

router.put('/years/:id/close', auth, checkPermission('setting:write'), (req, res) => {
  const { id } = req.params;
  
  db.prepare('UPDATE financial_years SET status = ?, closed_at = CURRENT_TIMESTAMP, closed_by = ? WHERE id = ?').run('closed', req.user.id, id);
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id) VALUES (?, ?, ?, ?)').run(req.user.id, '结账', '财务年度', id);
  
  res.json({ message: '结账成功' });
});

router.get('/backup', auth, checkPermission('setting:write'), (req, res) => {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'db', 'finance.db');
  
  if (!fs.existsSync(dbPath)) {
    return res.status(404).json({ error: '数据库文件不存在' });
  }
  
  const backupPath = path.join(path.dirname(dbPath), `backup_${Date.now()}.db`);
  fs.copyFileSync(dbPath, backupPath);
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)').run(req.user.id, '备份', '数据库', backupPath);
  
  res.download(backupPath, `finance_backup_${Date.now()}.db`, (err) => {
    if (!err) {
      fs.unlinkSync(backupPath);
    }
  });
});

router.post('/restore', auth, checkPermission('setting:write'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传备份文件' });
  }
  
  const dbPath = process.env.DB_PATH || path.join(__dirname, '..', '..', 'db', 'finance.db');
  fs.copyFileSync(req.file.path, dbPath);
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)').run(req.user.id, '恢复', '数据库', req.file.originalname);
  
  res.json({ message: '恢复成功，请重启服务' });
});

module.exports = router;
