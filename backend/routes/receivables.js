const express = require('express');
const router = express.Router();
const db = require('../database');
const { auth, checkPermission } = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const { type, status, partnerId, overdue } = req.query;
  let sql = `SELECT r.*, p.name as partner_name 
    FROM receivables r 
    LEFT JOIN partners p ON r.partner_id = p.id 
    WHERE 1=1`;
  const params = [];
  
  if (type) {
    sql += ' AND r.type = ?';
    params.push(type);
  }
  if (status) {
    sql += ' AND r.status = ?';
    params.push(status);
  }
  if (partnerId) {
    sql += ' AND r.partner_id = ?';
    params.push(partnerId);
  }
  if (overdue === 'true') {
    sql += " AND r.due_date < date('now') AND r.status != 'settled'";
  }
  sql += ' ORDER BY r.due_date ASC, r.id DESC';
  
  const receivables = db.prepare(sql).all(...params);
  res.json(receivables);
});

router.get('/summary', auth, (req, res) => {
  const receivableTotal = db.prepare("SELECT COALESCE(SUM(amount - paid_amount), 0) as total FROM receivables WHERE type = 'receivable' AND status != 'settled'").get();
  const payableTotal = db.prepare("SELECT COALESCE(SUM(amount - paid_amount), 0) as total FROM receivables WHERE type = 'payable' AND status != 'settled'").get();
  const overdueReceivables = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount - paid_amount), 0) as total FROM receivables WHERE type = 'receivable' AND due_date < date('now') AND status != 'settled'").get();
  const overduePayables = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(amount - paid_amount), 0) as total FROM receivables WHERE type = 'payable' AND due_date < date('now') AND status != 'settled'").get();
  
  res.json({
    receivableTotal: receivableTotal.total,
    payableTotal: payableTotal.total,
    overdueReceivables: overdueReceivables.count,
    overdueReceivableAmount: overdueReceivables.total,
    overduePayables: overduePayables.count,
    overduePayableAmount: overduePayables.total
  });
});

router.post('/', auth, checkPermission('receivable:write'), (req, res) => {
  const { type, partnerId, amount, dueDate, transactionId, remark } = req.body;
  
  const result = db.prepare(`
    INSERT INTO receivables (type, partner_id, amount, due_date, transaction_id, remark)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(type, partnerId, amount, dueDate, transactionId, remark);
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id, details) VALUES (?, ?, ?, ?, ?)').run(req.user.id, '新增', '应收应付', result.lastInsertRowid, `${type === 'receivable' ? '应收' : '应付'} ${amount}`);
  
  res.json({ id: result.lastInsertRowid, message: '添加成功' });
});

router.put('/:id', auth, checkPermission('receivable:write'), (req, res) => {
  const { id } = req.params;
  const { paidAmount, status, remark } = req.body;
  
  const receivable = db.prepare('SELECT * FROM receivables WHERE id = ?').get(id);
  if (!receivable) {
    return res.status(404).json({ error: '记录不存在' });
  }
  
  const newPaidAmount = (receivable.paid_amount || 0) + (paidAmount || 0);
  let newStatus = receivable.status;
  
  if (newPaidAmount >= receivable.amount) {
    newStatus = 'settled';
  } else if (newPaidAmount > 0) {
    newStatus = 'partial';
  }
  
  db.prepare(`
    UPDATE receivables SET paid_amount = ?, status = ?, remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(newPaidAmount, newStatus, remark, id);
  
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id, details) VALUES (?, ?, ?, ?, ?)').run(req.user.id, '收款/付款', '应收应付', id, `已收/付 ${paidAmount}`);
  
  res.json({ message: '更新成功' });
});

router.delete('/:id', auth, checkPermission('receivable:write'), (req, res) => {
  const { id } = req.params;
  
  db.prepare('DELETE FROM receivables WHERE id = ?').run(id);
  db.prepare('INSERT INTO audit_logs (user_id, action, module, target_id) VALUES (?, ?, ?, ?)').run(req.user.id, '删除', '应收应付', id);
  
  res.json({ message: '删除成功' });
});

module.exports = router;
