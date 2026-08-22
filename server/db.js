// db.js - SQLite (via sql.js WASM) with file persistence
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, '..', 'data', 'school.db');
const DATA_DIR = path.dirname(DB_PATH);

let SQL = null;
let db = null;
let ready = null;

function persist() {
  const data = db.export();
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();
  return row;
}

function insert(sql, params = []) {
  db.run(sql, params);
  const id = get('SELECT last_insert_rowid() AS id').id;
  persist();
  return id;
}

function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  gender TEXT,
  seat_no INTEGER,
  group_name TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  unit TEXT,
  lesson_date TEXT,
  objectives TEXT,
  content TEXT,
  status TEXT DEFAULT '草稿'
);
CREATE TABLE IF NOT EXISTS homework (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  due_date TEXT,
  description TEXT,
  status TEXT DEFAULT '进行中'
);
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  exam_name TEXT,
  subject TEXT,
  score REAL,
  date TEXT
);
CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  due_date TEXT,
  priority TEXT DEFAULT '中',
  done INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  content TEXT,
  audience TEXT,
  pinned INTEGER DEFAULT 0,
  date TEXT
);
CREATE TABLE IF NOT EXISTS communications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  date TEXT,
  channel TEXT,
  summary TEXT,
  parent_reply TEXT
);
CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  category TEXT,
  link TEXT,
  note TEXT
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  event_date TEXT,
  event_time TEXT,
  type TEXT,
  note TEXT
);
CREATE TABLE IF NOT EXISTS timetable (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT,
  period INTEGER,
  subject TEXT,
  time TEXT,
  note TEXT
);
CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  date TEXT,
  note TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

function seed() {
  const names = ['林晓彤','陈宇航','王梓萱','李浩然','张子涵','刘思琪','黄俊杰','周雨欣','吴佳怡','徐子轩','孙梦瑶','胡天磊','朱欣怡','高梓墨','何雨泽','郭子睿','罗欣妍','梁俊熙','宋佳琪','唐艺涵','韩雪儿','冯子轩','邓雅婷','曹明轩','彭诗涵','萧宇辰','潘梦琪','蒋欣怡','余泽宇','杜雨桐','钟子默','田佳欣','范俊豪','袁诗琪','石梓萱'];
  names.forEach((nm, i) => {
    const surname = nm[0];
    const gender = i % 2 === 0 ? '男' : '女';
    const parent = (i % 2 === 0 ? surname + '爸爸' : surname + '妈妈');
    const phone = '138' + String(10000000 + i * 137).slice(0, 8);
    const notesList = ['活泼好问', '书写工整', '需多鼓励', '责任心强', '阅读理解偏弱', '', '乐于助人', '注意力易分散'];
    insert('INSERT INTO students (name,gender,seat_no,group_name,parent_name,parent_phone,notes) VALUES (?,?,?,?,?,?,?)',
      [nm, gender, i + 1, '第' + ((i % 6) + 1) + '组', parent, phone, notesList[i % notesList.length]]);
  });

  // lessons
  const lessons = [
    ['《荷花》第一课时', '第一单元', '2026-08-25', '感受夏日荷塘之美，学习比喻句', '导入—范读—品词—仿写', '已完成'],
    ['《燕子》第二课时', '第一单元', '2026-08-27', '体会作者观察顺序，背诵喜欢段落', '复习—精读—背诵—拓展', '草稿'],
    ['《守株待兔》', '第二单元', '2026-09-01', '理解寓言寓意，积累文言词汇', '故事—寓意—练笔', '草稿']
  ];
  lessons.forEach(l => insert('INSERT INTO lessons (title,unit,lesson_date,objectives,content,status) VALUES (?,?,?,?,?,?)', l));

  // homework
  const hw = [
    ['生字抄写（第1课）', '2026-08-23', '每个生字写3遍并组词', '进行中'],
    ['阅读理解小练习', '2026-08-24', '完成练习册P12-13', '进行中'],
    ['背诵《燕子》', '2026-08-28', '熟读成诵，家长签字', '未开始']
  ];
  hw.forEach(h => insert('INSERT INTO homework (title,due_date,description,status) VALUES (?,?,?,?)', h));

  // exams (考试定义：名称 + 日期 + 备注) —— 先建考试，再录成绩
  const examsDef = [
    { name: '第一单元测试', date: '2026-08-20', note: '第一单元 字词与课文理解' },
    { name: '第一次月考', date: '2026-09-05', note: '月度综合练习' },
    { name: '第二单元测试', date: '2026-09-25', note: '第二单元' },
    { name: '期中测试', date: '2026-11-01', note: '半期综合' }
  ];
  examsDef.forEach(e => insert('INSERT INTO exams (name,date,note) VALUES (?,?,?)', [e.name, e.date, e.note]));

  // scores: 每个考试给全班录分
  const students = all('SELECT id FROM students ORDER BY id');
  examsDef.forEach(ex => {
    students.forEach((s, i) => {
      const isMonth = ex.name.indexOf('月考') >= 0;
      const base = isMonth ? 78 : 82;
      const score = Math.min(100, Math.max(60, base + ((i * 7 + (isMonth ? 5 : 0)) % 28) - 10));
      insert('INSERT INTO scores (student_id,exam_name,subject,score,date) VALUES (?,?,?,?,?)',
        [s.id, ex.name, '语文', score, ex.date]);
    });
  });

  // todos
  const todos = [
    ['批改第一单元作文', '2026-08-23', '高', 0],
    ['准备家长会PPT', '2026-08-30', '中', 0],
    ['整理班级图书角', '2026-08-26', '低', 0],
    ['填写学生素质报告册', '2026-09-10', '中', 0]
  ];
  todos.forEach(t => insert('INSERT INTO todos (title,due_date,priority,done) VALUES (?,?,?,?)', t));

  // notices
  const notices = [
    ['开学须知', '请家长于8月31日前完成校服尺码登记，并准备文具用品。', '全体家长', 1, '2026-08-22'],
    ['周二延时服务调整', '本周二延时服务改为阅读分享，请提醒孩子带课外书。', '全体家长', 0, '2026-08-22']
  ];
  notices.forEach(n => insert('INSERT INTO notices (title,content,audience,pinned,date) VALUES (?,?,?,?,?)', n));

  // communications
  const comms = [
    [3, '2026-08-21', '微信', '反馈孩子最近书写进步明显，希望多鼓励。', '已回复，感谢家长配合'],
    [12, '2026-08-20', '电话', '孩子上课注意力易分散，沟通家校配合方法。', '家长表示会配合'],
    [20, '2026-08-19', '面谈', '了解孩子课外阅读兴趣，推荐书单。', '']
  ];
  comms.forEach(c => insert('INSERT INTO communications (student_id,date,channel,summary,parent_reply) VALUES (?,?,?,?,?)', c));

  // resources
  const res = [
    ['小学语文课件资源', '课件', 'https://example.com/kejian', '第一单元配套PPT'],
    ['阅读理解专项训练', '练习', 'https://example.com/yuedu', '分年级汇编'],
    ['古诗词背诵清单', '资料', 'https://example.com/gushi', '1-6年级必背'],
    ['班主任工作手册', '管理', 'https://example.com/banzhuren', '班务流程参考']
  ];
  res.forEach(r => insert('INSERT INTO resources (title,category,link,note) VALUES (?,?,?,?)', r));

  // events for today + next days (so dashboard 今日安排 is alive)
  const today = new Date();
  const fmt = d => d.toISOString().slice(0, 10);
  const ev = [
    [fmt(today), '第3节', '课', '语文《荷花》', ''],
    [fmt(today), '午休', '值日', '教室值班', ''],
    [fmt(today), '16:30', '会议', '年级教研会', ''],
    [addDays(today, 1), '第1-2节', '课', '语文《燕子》', ''],
    [addDays(today, 2), '15:00', '活动', '班级阅读分享', '']
  ];
  ev.forEach(e => insert('INSERT INTO events (event_date,event_time,type,title,note) VALUES (?,?,?,?,?)', e));

  // timetable 周一~周五, 6 periods (with class times)
  const times = ['08:30', '09:20', '10:20', '11:10', '14:30', '15:20'];
  const sched = {
    '周一': ['语文', '数学', '体育', '音乐', '美术', '自习'],
    '周二': ['数学', '语文', '英语', '道德与法治', '体育', '班队'],
    '周三': ['语文', '语文', '科学', '音乐', '自习', '阅读'],
    '周四': ['数学', '语文', '英语', '美术', '体育', '自习'],
    '周五': ['语文', '数学', '道德与法治', '科学', '班会', '活动']
  };
  Object.keys(sched).forEach(day => {
    sched[day].forEach((subj, idx) => {
      insert('INSERT INTO timetable (day,period,subject,time,note) VALUES (?,?,?,?,?)', [day, idx + 1, subj, times[idx] || '', '']);
    });
  });

  // settings: 学期第一周 周一 (用于课程表周次与日期计算)
  const ms = new Date();
  const mdow = (ms.getDay() + 6) % 7;
  const mmon = new Date(ms); mmon.setDate(ms.getDate() - mdow);
  insert("INSERT INTO settings (key,value) VALUES ('term_start', ?)", [mmon.toISOString().slice(0, 10)]);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function init() {
  if (ready) return ready;
  ready = (async () => {
    SQL = await initSqlJs();
    let bytes = null;
    if (fs.existsSync(DB_PATH)) bytes = fs.readFileSync(DB_PATH);
    db = new SQL.Database(bytes || undefined);
    db.run(SCHEMA);
    try { db.run('ALTER TABLE timetable ADD COLUMN time TEXT'); } catch (e) { /* already exists */ }
    try { db.run("UPDATE timetable SET time = CASE period WHEN 1 THEN '08:30' WHEN 2 THEN '09:20' WHEN 3 THEN '10:20' WHEN 4 THEN '11:10' WHEN 5 THEN '14:30' WHEN 6 THEN '15:20' ELSE '' END WHERE time IS NULL OR time = ''"); } catch (e) {}
    // backfill exams table from existing scores (for DBs created before exams existed)
    try {
      const exCnt = get('SELECT COUNT(*) AS c FROM exams').c;
      if (exCnt === 0) {
        const ex = all("SELECT DISTINCT exam_name, date FROM scores WHERE exam_name IS NOT NULL");
        const seen = {};
        ex.forEach(e => { if (e.exam_name && !seen[e.exam_name]) { seen[e.exam_name] = 1; insert('INSERT INTO exams (name,date) VALUES (?,?)', [e.exam_name, e.date || '']); } });
      }
    } catch (e) { /* exams table not ready */ }
    // ensure term_start setting exists
    try {
      const ts = get("SELECT value FROM settings WHERE key='term_start'");
      if (!ts) {
        const ms2 = new Date(); const mdow = (ms2.getDay() + 6) % 7; const mmon = new Date(ms2); mmon.setDate(ms2.getDate() - mdow);
        insert("INSERT INTO settings (key,value) VALUES ('term_start', ?)", [mmon.toISOString().slice(0, 10)]);
      }
    } catch (e) { /* settings table not ready */ }
    const s = get('SELECT COUNT(*) AS c FROM students');
    if (!s || s.c === 0) seed();
  })();
  return ready;
}

module.exports = { init, all, get, insert, run };
