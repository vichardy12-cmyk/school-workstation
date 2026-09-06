// db.js - PostgreSQL (Supabase) via 'pg'
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// test / keep alive
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

// helper: convert JS value to something pg can take (Buffer for base64 avatar_data)
function norm(v) {
  return v === undefined ? null : v;
}

async function all(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows;
}
async function get(sql, params = []) {
  const r = await pool.query(sql, params);
  return r.rows[0] || null;
}
async function insert(sql, params = []) {
  const r = await pool.query(sql + ' RETURNING *', params);
  if (r.rows[0] && r.rows[0].id !== undefined) return r.rows[0].id;
  return null;
}
async function run(sql, params = []) {
  await pool.query(sql, params);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  gender TEXT,
  exam_no INTEGER,
  group_name TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (to_char(now(),'YYYY-MM-DD HH24:MI:SS'))
);
CREATE TABLE IF NOT EXISTS lessons (
  id SERIAL PRIMARY KEY,
  title TEXT,
  unit TEXT,
  lesson_date TEXT,
  objectives TEXT,
  content TEXT,
  status TEXT DEFAULT '草稿'
);
CREATE TABLE IF NOT EXISTS homework (
  id SERIAL PRIMARY KEY,
  title TEXT,
  due_date TEXT,
  description TEXT,
  status TEXT DEFAULT '进行中'
);
CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  student_id INTEGER,
  exam_name TEXT,
  subject TEXT,
  score REAL,
  date TEXT,
  note TEXT
);
CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  title TEXT,
  due_date TEXT,
  priority TEXT DEFAULT '中',
  done INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS notices (
  id SERIAL PRIMARY KEY,
  title TEXT,
  content TEXT,
  audience TEXT,
  pinned INTEGER DEFAULT 0,
  date TEXT
);
CREATE TABLE IF NOT EXISTS communications (
  id SERIAL PRIMARY KEY,
  student_id INTEGER,
  date TEXT,
  channel TEXT,
  summary TEXT,
  parent_reply TEXT
);
CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  title TEXT,
  category TEXT,
  link TEXT,
  note TEXT
);
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title TEXT,
  event_date TEXT,
  event_time TEXT,
  type TEXT,
  note TEXT
);
CREATE TABLE IF NOT EXISTS timetable (
  id SERIAL PRIMARY KEY,
  day TEXT,
  period INTEGER,
  subject TEXT,
  time TEXT,
  note TEXT,
  week_from INTEGER,
  week_to INTEGER
);
CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  name TEXT,
  date TEXT,
  note TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS profile (
  id SERIAL PRIMARY KEY,
  teacher TEXT,
  class TEXT,
  avatar_path TEXT,
  avatar_data TEXT
);
CREATE TABLE IF NOT EXISTS homework_students (
  id SERIAL PRIMARY KEY,
  homework_id INTEGER,
  student_id INTEGER,
  submitted INTEGER DEFAULT 0
);
`;

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function seed() {
  // idempotent: don't re-seed if students already exist
  const existing = await get('SELECT COUNT(*) AS c FROM students');
  if (existing && +existing.c > 0) return;

  const names = ['林晓彤','陈宇航','王梓萱','李浩然','张子涵','刘思琪','黄俊杰','周雨欣','吴佳怡','徐子轩','孙梦瑶','胡天磊','朱欣怡','高梓墨','何雨泽','郭子睿','罗欣妍','梁俊熙','宋佳琪','唐艺涵','韩雪儿','冯子轩','邓雅婷','曹明轩','彭诗涵','萧宇辰','潘梦琪','蒋欣怡','余泽宇','杜雨桐','钟子默','田佳欣','范俊豪','袁诗琪','石梓萱'];
  for (let i = 0; i < names.length; i++) {
    const nm = names[i];
    const surname = nm[0];
    const gender = i % 2 === 0 ? '男' : '女';
    const parent = (i % 2 === 0 ? surname + '爸爸' : surname + '妈妈');
    const phone = '138' + String(10000000 + i * 137).slice(0, 8);
    const notesList = ['活泼好问', '书写工整', '需多鼓励', '责任心强', '阅读理解偏弱', '', '乐于助人', '注意力易分散'];
    await insert('INSERT INTO students (name,gender,exam_no,group_name,parent_name,parent_phone,notes) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [nm, gender, i + 1, '第' + ((i % 6) + 1) + '组', parent, phone, notesList[i % notesList.length]]);
  }

  // lessons
  const lessons = [
    ['《荷花》第一课时', '第一单元', '2026-08-25', '感受夏日荷塘之美，学习比喻句', '导入—范读—品词—仿写', '已完成'],
    ['《燕子》第二课时', '第一单元', '2026-08-27', '体会作者观察顺序，背诵喜欢段落', '复习—精读—背诵—拓展', '草稿'],
    ['《守株待兔》', '第二单元', '2026-09-01', '理解寓言寓意，积累文言词汇', '故事—寓意—练笔', '草稿']
  ];
  for (const l of lessons) await insert('INSERT INTO lessons (title,unit,lesson_date,objectives,content,status) VALUES ($1,$2,$3,$4,$5,$6)', l);

  // homework
  const hw = [
    ['生字抄写（第1课）', '2026-08-23', '每个生字写3遍并组词', '进行中'],
    ['阅读理解小练习', '2026-08-24', '完成练习册P12-13', '进行中'],
    ['背诵《燕子》', '2026-08-28', '熟读成诵，家长签字', '未开始']
  ];
  for (const h of hw) await insert('INSERT INTO homework (title,due_date,description,status) VALUES ($1,$2,$3,$4)', h);

  // exams
  const examsDef = [
    { name: '第一单元测试', date: '2026-08-20', note: '第一单元 字词与课文理解' },
    { name: '第一次月考', date: '2026-09-05', note: '月度综合练习' },
    { name: '第二单元测试', date: '2026-09-25', note: '第二单元' },
    { name: '期中测试', date: '2026-11-01', note: '半期综合' }
  ];
  for (const e of examsDef) await insert('INSERT INTO exams (name,date,note) VALUES ($1,$2,$3)', [e.name, e.date, e.note]);

  // scores: 每个考试给全班录分
  const students = await all('SELECT id FROM students ORDER BY id');
  for (const ex of examsDef) {
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const isMonth = ex.name.indexOf('月考') >= 0;
      const base = isMonth ? 78 : 82;
      const score = Math.min(100, Math.max(60, base + ((i * 7 + (isMonth ? 5 : 0)) % 28) - 10));
      await insert('INSERT INTO scores (student_id,exam_name,subject,score,date) VALUES ($1,$2,$3,$4,$5)',
        [s.id, ex.name, '语文', score, ex.date]);
    }
  }

  // todos
  const todos = [
    ['批改第一单元作文', '2026-08-23', '高', 0],
    ['准备家长会PPT', '2026-08-30', '中', 0],
    ['整理班级图书角', '2026-08-26', '低', 0],
    ['填写学生素质报告册', '2026-09-10', '中', 0]
  ];
  for (const t of todos) await insert('INSERT INTO todos (title,due_date,priority,done) VALUES ($1,$2,$3,$4)', t);

  // notices
  const notices = [
    ['开学须知', '请家长于8月31日前完成校服尺码登记，并准备文具用品。', '全体家长', 1, '2026-08-22'],
    ['周二延时服务调整', '本周二延时服务改为阅读分享，请提醒孩子带课外书。', '全体家长', 0, '2026-08-22']
  ];
  for (const n of notices) await insert('INSERT INTO notices (title,content,audience,pinned,date) VALUES ($1,$2,$3,$4,$5)', n);

  // communications
  const comms = [
    [3, '2026-08-21', '微信', '反馈孩子最近书写进步明显，希望多鼓励。', '已回复，感谢家长配合'],
    [12, '2026-08-20', '电话', '孩子上课注意力易分散，沟通家校配合方法。', '家长表示会配合'],
    [20, '2026-08-19', '面谈', '了解孩子课外阅读兴趣，推荐书单。', '']
  ];
  for (const c of comms) await insert('INSERT INTO communications (student_id,date,channel,summary,parent_reply) VALUES ($1,$2,$3,$4,$5)', c);

  // resources
  const res = [
    ['小学语文课件资源', '课件', 'https://example.com/kejian', '第一单元配套PPT'],
    ['阅读理解专项训练', '练习', 'https://example.com/yuedu', '分年级汇编'],
    ['古诗词背诵清单', '资料', 'https://example.com/gushi', '1-6年级必背'],
    ['班主任工作手册', '管理', 'https://example.com/banzhuren', '班务流程参考']
  ];
  for (const r of res) await insert('INSERT INTO resources (title,category,link,note) VALUES ($1,$2,$3,$4)', r);

  // events for today + next days
  const today = new Date();
  const fmt = d => d.toISOString().slice(0, 10);
  const ev = [
    [fmt(today), '第3节', '课', '语文《荷花》', ''],
    [fmt(today), '午休', '值日', '教室值班', ''],
    [fmt(today), '16:30', '会议', '年级教研会', ''],
    [addDays(today, 1), '第1-2节', '课', '语文《燕子》', ''],
    [addDays(today, 2), '15:00', '活动', '班级阅读分享', '']
  ];
  for (const e of ev) await insert('INSERT INTO events (event_date,event_time,type,title,note) VALUES ($1,$2,$3,$4,$5)', e);

  // timetable 周一~周五, 6 periods
  const times = ['08:30', '09:20', '10:20', '11:10', '14:30', '15:20'];
  const sched = {
    '周一': ['语文', '数学', '体育', '音乐', '美术', '自习'],
    '周二': ['数学', '语文', '英语', '道德与法治', '体育', '班队'],
    '周三': ['语文', '语文', '科学', '音乐', '自习', '阅读'],
    '周四': ['数学', '语文', '英语', '美术', '体育', '自习'],
    '周五': ['语文', '数学', '道德与法治', '科学', '班会', '活动']
  };
  for (const day of Object.keys(sched)) {
    const arr = sched[day];
    for (let idx = 0; idx < arr.length; idx++) {
      await insert('INSERT INTO timetable (day,period,subject,time,note) VALUES ($1,$2,$3,$4,$5)', [day, idx + 1, arr[idx], times[idx] || '', '']);
    }
  }
}

let ready = null;
async function init() {
  if (ready) return ready;
  ready = (async () => {
    await pool.query(SCHEMA);
    // migrate: seat_no -> exam_no (idempotent, only for pre-existing tables)
    const col = await get("SELECT column_name FROM information_schema.columns WHERE table_name='students' AND column_name='seat_no'");
    if (col) { await run('ALTER TABLE students RENAME COLUMN seat_no TO exam_no'); }
    // ensure term_start setting exists
    const ts = await get("SELECT value FROM settings WHERE key='term_start'");
    if (!ts) {
      const ms2 = new Date(); const mdow = (ms2.getDay() + 6) % 7; const mmon = new Date(ms2); mmon.setDate(ms2.getDate() - mdow);
      await insert("INSERT INTO settings (key,value) VALUES ('term_start', $1)", [mmon.toISOString().slice(0, 10)]);
    }
    const s = await get('SELECT COUNT(*) AS c FROM students');
    if (!s || +s.c === 0) await seed();
  })();
  return ready;
}

module.exports = { init, all, get, insert, run, pool };
