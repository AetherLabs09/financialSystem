const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, checkPermission } = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const { transactionId } = req.query;
  let sql = 'SELECT v.*, u.real_name as uploader_name FROM vouchers v LEFT JOIN users u ON v.uploaded_by = u.id WHERE 1=1';
  const params = [];
  
  if (transactionId) {
    sql += ' AND v.transaction_id = ?';
    params.push(transactionId);
  }
  sql += ' ORDER BY v.created_at DESC';
  
  const vouchers = db.prepare(sql).all(...params);
  res.json(vouchers);
});

router.post('/', auth, checkPermission('voucher:write'), (req, res) => {
  const { transactionId, fileName, filePath, fileType, fileSize } = req.body;
  
  const result = db.prepare(`
    INSERT INTO vouchers (transaction_id, file_name, file_path, file_type, file_size, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(transactionId, fileName, filePath, fileType, fileSize, req.user.id);
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id, details) VALUES (?, ?, ?, ?, ?)').run(req.user.id, '上传', '凭证', result.lastInsertRowid, fileName);
  
  res.json({ id: result.lastInsertRowid, message: '上传成功' });
});

router.delete('/:id', auth, checkPermission('voucher:write'), (req, res) => {
  const { id } = req.params;
  
  const voucher = db.prepare('SELECT * FROM vouchers WHERE id = ?').get(id);
  if (!voucher) {
    return res.status(404).json({ error: '凭证不存在' });
  }
  
  const fs = require('fs');
  const path = require('path');
  const filePath = path.join(__dirname, '..', '..', 'db', 'uploads', voucher.file_name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  db.prepare('DELETE FROM vouchers WHERE id = ?').run(id);
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id) VALUES (?, ?, ?, ?)').run(req.user.id, '删除', '凭证', id);
  
  res.json({ message: '删除成功' });
});

module.exports = router;
