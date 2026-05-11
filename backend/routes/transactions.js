const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, checkPermission } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const xlsx = require('xlsx');

const generateSerialNo = () => {
  const setting = db.prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'serial_prefix'").get();
  const prefix = setting?.setting_value || 'FIN';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${date}${random}`;
};

router.get('/', auth, (req, res) => {
  const { startDate, endDate, type, categoryId, partnerId, handler, keyword, page = 1, pageSize = 20 } = req.query;
  let sql = `SELECT t.*, c.name as category_name, p.name as partner_name 
    FROM transactions t 
    LEFT JOIN categories c ON t.category_id = c.id 
    LEFT JOIN partners p ON t.partner_id = p.id 
    WHERE 1=1`;
  const params = [];
  
  if (startDate) {
    sql += ' AND t.transaction_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND t.transaction_date <= ?';
    params.push(endDate);
  }
  if (type) {
    sql += ' AND t.type = ?';
    params.push(type);
  }
  if (categoryId) {
    sql += ' AND t.category_id = ?';
    params.push(categoryId);
  }
  if (partnerId) {
    sql += ' AND t.partner_id = ?';
    params.push(partnerId);
  }
  if (handler) {
    sql += ' AND t.handler LIKE ?';
    params.push(`%${handler}%`);
  }
  if (keyword) {
    sql += ' AND (t.serial_no LIKE ? OR t.remark LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  
  const countSql = sql.replace('SELECT t.*, c.name as category_name, p.name as partner_name', 'SELECT COUNT(*) as total');
  const totalResult = db.prepare(countSql).get(...params);
  const total = totalResult.total;
  
  sql += ' ORDER BY t.transaction_date DESC, t.id DESC LIMIT ? OFFSET ?';
  params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
  
  const transactions = db.prepare(sql).all(...params);
  res.json({ list: transactions, total, page: parseInt(page), pageSize: parseInt(pageSize) });
});

router.get('/:id', auth, (req, res) => {
  const { id } = req.params;
  const transaction = db.prepare(`
    SELECT t.*, c.name as category_name, p.name as partner_name 
    FROM transactions t 
    LEFT JOIN categories c ON t.category_id = c.id 
    LEFT JOIN partners p ON t.partner_id = p.id 
    WHERE t.id = ?
  `).get(id);
  
  if (!transaction) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  res.json(transaction);
});

router.post('/', auth, checkPermission('transaction:write'), (req, res) => {
  const { type, categoryId, amount, partnerId, handler, transactionDate, voucherPath, remark } = req.body;
  
  const serialNo = generateSerialNo();
  const result = db.prepare(`
    INSERT INTO transactions (serial_no, type, category_id, amount, partner_id, handler, transaction_date, voucher_path, remark, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(serialNo, type, categoryId, amount, partnerId, handler, transactionDate, voucherPath, remark, req.user.id);
  
  if (partnerId) {
    const changeAmount = type === 'income' ? -amount : amount;
    db.prepare('UPDATE partners SET current_debt = current_debt + ? WHERE id = ?').run(changeAmount, partnerId);
  }
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id, details) VALUES (?, ?, ?, ?, ?)').run(req.user.id, '新增', '收支记录', result.lastInsertRowid, `${type === 'income' ? '收入' : '支出'} ${amount}`);
  
  res.json({ id: result.lastInsertRowid, serialNo, message: '添加成功' });
});

router.put('/:id', auth, checkPermission('transaction:write'), (req, res) => {
  const { id } = req.params;
  const { type, categoryId, amount, partnerId, handler, transactionDate, voucherPath, remark, status } = req.body;
  
  const oldTransaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!oldTransaction) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  if (oldTransaction.partner_id) {
    const oldChangeAmount = oldTransaction.type === 'income' ? oldTransaction.amount : -oldTransaction.amount;
    db.prepare('UPDATE partners SET current_debt = current_debt + ? WHERE id = ?').run(oldChangeAmount, oldTransaction.partner_id);
  }
  
  db.prepare(`
    UPDATE transactions SET type = ?, category_id = ?, amount = ?, partner_id = ?, handler = ?, transaction_date = ?, voucher_path = ?, remark = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(type, categoryId, amount, partnerId, handler, transactionDate, voucherPath, remark, status, id);
  
  if (partnerId) {
    const changeAmount = type === 'income' ? -amount : amount;
    db.prepare('UPDATE partners SET current_debt = current_debt + ? WHERE id = ?').run(changeAmount, partnerId);
  }
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id, details) VALUES (?, ?, ?, ?, ?)').run(req.user.id, '编辑', '收支记录', id, `${type === 'income' ? '收入' : '支出'} ${amount}`);
  
  res.json({ message: '更新成功' });
});

router.delete('/:id', auth, checkPermission('transaction:write'), (req, res) => {
  const { id } = req.params;
  
  const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!transaction) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  if (transaction.partner_id) {
    const changeAmount = transaction.type === 'income' ? transaction.amount : -transaction.amount;
    db.prepare('UPDATE partners SET current_debt = current_debt + ? WHERE id = ?').run(changeAmount, transaction.partner_id);
  }
  
  db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id) VALUES (?, ?, ?, ?)').run(req.user.id, '删除', '收支记录', id);
  
  res.json({ message: '删除成功' });
});

router.get('/export', auth, (req, res) => {
  const { startDate, endDate, type, categoryId, partnerId } = req.query;
  let sql = `SELECT t.serial_no, t.type, c.name as category_name, t.amount, p.name as partner_name, t.handler, t.transaction_date, t.remark
    FROM transactions t 
    LEFT JOIN categories c ON t.category_id = c.id 
    LEFT JOIN partners p ON t.partner_id = p.id 
    WHERE 1=1`;
  const params = [];
  
  if (startDate) {
    sql += ' AND t.transaction_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    sql += ' AND t.transaction_date <= ?';
    params.push(endDate);
  }
  if (type) {
    sql += ' AND t.type = ?';
    params.push(type);
  }
  if (categoryId) {
    sql += ' AND t.category_id = ?';
    params.push(categoryId);
  }
  if (partnerId) {
    sql += ' AND t.partner_id = ?';
    params.push(partnerId);
  }
  sql += ' ORDER BY t.transaction_date DESC';
  
  const transactions = db.prepare(sql).all(...params);
  
  const data = transactions.map(t => ({
    '流水号': t.serial_no,
    '类型': t.type === 'income' ? '收入' : '支出',
    '类目': t.category_name,
    '金额': t.amount,
    '往来单位': t.partner_name || '',
    '经手人': t.handler || '',
    '日期': t.transaction_date,
    '备注': t.remark || ''
  }));
  
  const ws = xlsx.utils.json_to_sheet(data);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, '收支明细');
  
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=transactions_${Date.now()}.xlsx`);
  res.send(buffer);
});

module.exports = router;
