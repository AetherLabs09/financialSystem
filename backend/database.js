const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'db', 'finance.db');
const dbDir = path.dirname(dbPath);

const fs = require('fs');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    real_name TEXT NOT NULL,
    role TEXT DEFAULT 'operator',
    permissions TEXT DEFAULT '[]',
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    parent_id INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS partners (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('customer', 'supplier', 'both')),
    contact TEXT,
    phone TEXT,
    address TEXT,
    initial_debt REAL DEFAULT 0,
    current_debt REAL DEFAULT 0,
    status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_no TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    category_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    partner_id INTEGER,
    handler TEXT,
    transaction_date DATE NOT NULL,
    voucher_path TEXT,
    remark TEXT,
    status INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (partner_id) REFERENCES partners(id)
  );

  CREATE TABLE IF NOT EXISTS receivables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('receivable', 'payable')),
    partner_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    paid_amount REAL DEFAULT 0,
    due_date DATE,
    status TEXT DEFAULT 'pending',
    transaction_id INTEGER,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (partner_id) REFERENCES partners(id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    amount REAL NOT NULL,
    used_amount REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    UNIQUE(category_id, year, month)
  );

  CREATE TABLE IF NOT EXISTS vouchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    uploaded_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
  );

  CREATE TABLE IF NOT EXISTS reimbursements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_no TEXT UNIQUE NOT NULL,
    applicant_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    category_id INTEGER,
    description TEXT,
    voucher_paths TEXT,
    status TEXT DEFAULT 'pending',
    approved_by INTEGER,
    approved_at DATETIME,
    reject_reason TEXT,
    payment_status TEXT DEFAULT 'unpaid',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (applicant_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    module TEXT,
    target_id INTEGER,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS financial_years (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER UNIQUE NOT NULL,
    status TEXT DEFAULT 'open',
    closed_at DATETIME,
    closed_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (closed_by) REFERENCES users(id)
  );
`);

const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (username, password, real_name, role, permissions, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('admin', hashedPassword, '系统管理员', 'admin', '["all"]', 1);
}

const defaultCategories = [
  { name: '工资收入', type: 'income', sort_order: 1 },
  { name: '营业收入', type: 'income', sort_order: 2 },
  { name: '投资收益', type: 'income', sort_order: 3 },
  { name: '其他收入', type: 'income', sort_order: 4 },
  { name: '采购支出', type: 'expense', sort_order: 1 },
  { name: '水电费', type: 'expense', sort_order: 2 },
  { name: '办公耗材', type: 'expense', sort_order: 3 },
  { name: '员工工资', type: 'expense', sort_order: 4 },
  { name: '差旅费', type: 'expense', sort_order: 5 },
  { name: '其他支出', type: 'expense', sort_order: 6 }
];

const insertCategory = db.prepare(`
  INSERT OR IGNORE INTO categories (name, type, sort_order) VALUES (?, ?, ?)
`);
defaultCategories.forEach(cat => {
  insertCategory.run(cat.name, cat.type, cat.sort_order);
});

const defaultSettings = [
  { key: 'currency', value: 'CNY', desc: '货币类型' },
  { key: 'currency_symbol', value: '¥', desc: '货币符号' },
  { key: 'serial_prefix', value: 'FIN', desc: '流水号前缀' },
  { key: 'budget_alert_threshold', value: '80', desc: '预算预警阈值(%)' }
];

const insertSetting = db.prepare(`
  INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?)
`);
defaultSettings.forEach(setting => {
  insertSetting.run(setting.key, setting.value, setting.desc);
});

const currentYear = new Date().getFullYear();
db.prepare(`
  INSERT OR IGNORE INTO financial_years (year, status) VALUES (?, 'open')
`).run(currentYear);

module.exports = db;
