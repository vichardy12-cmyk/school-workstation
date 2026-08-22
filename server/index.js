// index.js - Express server: REST API + static frontend
const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const ai = require('./ai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// helper: build PostgreSQL $1,$2,...
function ph(n) {
  return Array.from({ length: n }, (_, i) => '$' + (i + 1)).join(',');
}

// table column whitelist for safe inserts
const COLS = {
  students: ['name', 'gender', 'seat_no', 'group_name', 'parent_name', 'parent_phone', 'notes'],
  lessons: ['title', 'unit', 'lesson_date', 'objectives', 'content', 'status'],
  homework: ['title', 'due_date', 'description', 'status'],
  scores: ['student_id', 'exam_name', 'subject', 'score', 'date', 'note'],
  todos: ['title', 'due_date', 'priority', 'done'],
  notices: ['title', 'content', 'audience', 'pinned', 'date'],
  communications: ['student_id', 'date', 'channel', 'summary', 'parent_reply'],
  resources: ['title', 'category', 'link', 'note'],
  events: ['title', 'event_date', 'event_time', 'type', 'note'],
  timetable: ['day', 'period', 'subject', 'time', 'note', 'week_from', 'week_to'],
  exams: ['name', 'date', 'note']
};

function registerCrud(table) {
  const cols = COLS[table];
  app.get('/api/' + table, async (req, res) => {
    try { res.json(await db.all('SELECT * FROM ' + table + ' ORDER BY id DESC')); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/' + table, async (req, res) => {
    try {
      const keys = cols.filter(c => req.body[c] !== undefined);
      const qs = ph(keys.length);
      const params = keys.map(k => req.body[k]);
      const id = await db.insert(
        'INSERT INTO ' + table + ' (' + keys.join(',') + ') VALUES (' + qs + ')',
        params
      );
      res.json(await db.get('SELECT * FROM ' + table + ' WHERE id=$1', [id]));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.patch('/api/' + table + '/:id', async (req, res) => {
    try {
      const keys = cols.filter(c => req.body[c] !== undefined);
      if (keys.length === 0) return res.json({ ok: true });
      const sets = keys.map((k, i) => k + '=$' + (i + 1)).join(',');
      const params = [...keys.map(k => req.body[k]), req.params.id];
      await db.run('UPDATE ' + table + ' SET ' + sets + ' WHERE id=$' + params.length, params);
      res.json(await db.get('SELECT * FROM ' + table + ' WHERE id=$1', [req.params.id]));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.delete('/api/' + table + '/:id', async (req, res) => {
    try { await db.run('DELETE FROM ' + table + ' WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
}

// exams: custom CRUD so name/delete changes cascade to scores (keep student data linked)
app.get('/api/exams', async (req, res) => {
  try { res.json(await db.all('SELECT * FROM exams ORDER BY id DESC')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/exams', async (req, res) => {
  try {
    const cols = COLS.exams.filter(c => req.body[c] !== undefined);
    const qs = ph(cols.length);
    const params = cols.map(k => req.body[k]);
    const id = await db.insert('INSERT INTO exams (' + cols.join(',') + ') VALUES (' + qs + ')', params);
    res.json(await db.get('SELECT * FROM exams WHERE id=$1', [id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/api/exams/:id', async (req, res) => {
  try {
    const cur = await db.get('SELECT * FROM exams WHERE id=$1', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'not found' });
    const name = req.body.name !== undefined ? req.body.name : cur.name;
    const date = req.body.date !== undefined ? req.body.date : cur.date;
    const note = req.body.note !== undefined ? req.body.note : cur.note;
    await db.run('UPDATE exams SET name=$1, date=$2, note=$3 WHERE id=$4', [name, date, note, req.params.id]);
    // keep student scores linked: if exam name changed, update matching scores
    if (req.body.name !== undefined && req.body.name !== cur.name) {
      await db.run('UPDATE scores SET exam_name=$1 WHERE exam_name=$2', [req.body.name, cur.name]);
    }
    res.json(await db.get('SELECT * FROM exams WHERE id=$1', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/exams/:id', async (req, res) => {
  try {
    const cur = await db.get('SELECT * FROM exams WHERE id=$1', [req.params.id]);
    if (cur) await db.run('DELETE FROM scores WHERE exam_name=$1', [cur.name]);
    await db.run('DELETE FROM exams WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// bulk create score rows (used when adding an exam together with its students)
app.post('/api/scores/bulk', async (req, res) => {
  try {
    const items = req.body.items || [];
    const created = [];
    for (const it of items) {
      const keys = ['student_id', 'exam_name', 'subject', 'score', 'date', 'note'].filter(k => it[k] !== undefined);
      const qs = ph(keys.length);
      const params = keys.map(k => it[k]);
      const id = await db.insert('INSERT INTO scores (' + keys.join(',') + ') VALUES (' + qs + ')', params);
      created.push(await db.get('SELECT * FROM scores WHERE id=$1', [id]));
    }
    res.json(created);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

['students', 'lessons', 'todos', 'notices', 'communications', 'resources', 'events', 'timetable'].forEach(registerCrud);

// timetable: reset all rows
app.delete('/api/timetable/reset', async (req, res) => {
  try { await db.run('DELETE FROM timetable'); res.json({ ok: true, deleted: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// homework: custom CRUD so creating an assignment auto-assigns students + tracks submissions
app.get('/api/homework', async (req, res) => {
  try { res.json(await db.all('SELECT * FROM homework ORDER BY id DESC')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/homework', async (req, res) => {
  try {
    const title = req.body.title || '';
    const due_date = req.body.due_date || '';
    const description = req.body.description || '';
    const status = req.body.status || '进行中';
    const assign = req.body.assign || 'all'; // 'all' | group name
    const id = await db.insert('INSERT INTO homework (title,due_date,description,status) VALUES ($1,$2,$3,$4)', [title, due_date, description, status]);
    let students;
    if (assign === 'all') students = await db.all('SELECT id FROM students');
    else students = await db.all('SELECT id FROM students WHERE group_name=$1', [assign]);
    for (const s of students) await db.insert('INSERT INTO homework_students (homework_id,student_id,submitted) VALUES ($1,$2,0)', [id, s.id]);
    res.json(await db.get('SELECT * FROM homework WHERE id=$1', [id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/api/homework/:id', async (req, res) => {
  try {
    const keys = ['title', 'due_date', 'description', 'status'].filter(k => req.body[k] !== undefined);
    if (keys.length === 0) return res.json({ ok: true });
    const sets = keys.map((k, i) => k + '=$' + (i + 1)).join(',');
    const params = [...keys.map(k => req.body[k]), req.params.id];
    await db.run('UPDATE homework SET ' + sets + ' WHERE id=$' + params.length, params);
    res.json(await db.get('SELECT * FROM homework WHERE id=$1', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/homework/:id', async (req, res) => {
  try { await db.run('DELETE FROM homework_students WHERE homework_id=$1', [req.params.id]); await db.run('DELETE FROM homework WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
// assignment submissions: who got it, who submitted, list of names not submitted
app.get('/api/homework/:id/submissions', async (req, res) => {
  try {
    const hid = +req.params.id;
    const totalRow = await db.get('SELECT COUNT(*) AS c FROM students');
    const total = totalRow ? +totalRow.c : 0;
    const assigned = await db.all('SELECT hs.id, hs.student_id, hs.submitted, s.name FROM homework_students hs JOIN students s ON s.id=hs.student_id WHERE hs.homework_id=$1', [hid]);
    const submitted = assigned.filter(a => a.submitted).map(a => a.name);
    const notSubmitted = assigned.filter(a => !a.submitted).map(a => a.name);
    res.json({ total, assignedCount: assigned.length, submittedCount: submitted.length, notSubmittedCount: notSubmitted.length, submitted, notSubmitted, rows: assigned });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/api/homework_students/:id', async (req, res) => {
  try {
    const sub = req.body.submitted !== undefined ? (req.body.submitted ? 1 : 0) : 0;
    await db.run('UPDATE homework_students SET submitted=$1 WHERE id=$2', [sub, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// scores: custom CRUD (needs note column + /:id GET)
app.get('/api/scores', async (req, res) => {
  try { res.json(await db.all('SELECT * FROM scores ORDER BY id DESC')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/scores/:id', async (req, res) => {
  try { res.json(await db.get('SELECT * FROM scores WHERE id=$1', [+req.params.id])); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/scores', async (req, res) => {
  try {
    const cols = COLS.scores.filter(c => req.body[c] !== undefined);
    const qs = ph(cols.length);
    const params = cols.map(k => req.body[k]);
    const id = await db.insert('INSERT INTO scores (' + cols.join(',') + ') VALUES (' + qs + ')', params);
    res.json(await db.get('SELECT * FROM scores WHERE id=$1', [id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/api/scores/:id', async (req, res) => {
  try {
    const keys = COLS.scores.filter(c => req.body[c] !== undefined);
    if (keys.length === 0) return res.json({ ok: true });
    const sets = keys.map((k, i) => k + '=$' + (i + 1)).join(',');
    const params = [...keys.map(k => req.body[k]), req.params.id];
    await db.run('UPDATE scores SET ' + sets + ' WHERE id=$' + params.length, params);
    res.json(await db.get('SELECT * FROM scores WHERE id=$1', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/scores/:id', async (req, res) => {
  try { await db.run('DELETE FROM scores WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// settings (term_start for timetable week calculation)
app.get('/api/settings', async (req, res) => {
  try { const row = await db.get("SELECT value FROM settings WHERE key='term_start'"); res.json({ term_start: row ? row.value : '' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/settings', async (req, res) => {
  try { await db.run("UPDATE settings SET value=$1 WHERE key='term_start'", [req.body.term_start || '']); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// profile (shared teacher name / class / avatar — synced across devices)
app.get('/api/profile', async (req, res) => {
  try {
    let row = await db.get('SELECT * FROM profile ORDER BY id DESC LIMIT 1');
    if (!row) row = { teacher: '林老师', class: '三(2)班 · 语文', avatar_path: null, avatar_data: null };
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/profile', async (req, res) => {
  try {
    const existing = await db.get('SELECT * FROM profile ORDER BY id DESC LIMIT 1');
    const teacher = req.body.teacher !== undefined ? req.body.teacher : (existing ? existing.teacher : '林老师');
    const cls = req.body.class !== undefined ? req.body.class : (existing ? existing.class : '三(2)班 · 语文');
    const avatar_path = req.body.avatar_path !== undefined ? req.body.avatar_path : (existing ? existing.avatar_path : null);
    const avatar_data = req.body.avatar_data !== undefined ? req.body.avatar_data : (existing ? existing.avatar_data : null);
    if (existing) {
      await db.run('UPDATE profile SET teacher=$1, class=$2, avatar_path=$3, avatar_data=$4 WHERE id=$5',
        [teacher, cls, avatar_path, avatar_data, existing.id]);
    } else {
      await db.insert('INSERT INTO profile (teacher,class,avatar_path,avatar_data) VALUES ($1,$2,$3,$4)',
        [teacher, cls, avatar_path, avatar_data]);
    }
    res.json(await db.get('SELECT * FROM profile ORDER BY id DESC LIMIT 1'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// avatar upload (multipart) — saved to public/uploads + base64 backup in DB
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
app.post('/api/profile/avatar', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file' });
    const ext = (req.file.originalname.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const fname = 'avatar.' + (ext || 'png');
    fs.writeFileSync(path.join(UPLOAD_DIR, fname), req.file.buffer);
    const dataUrl = 'data:' + (req.file.mimetype || 'image/png') + ';base64,' + req.file.buffer.toString('base64');
    const existing = await db.get('SELECT * FROM profile ORDER BY id DESC LIMIT 1');
    if (existing) {
      await db.run('UPDATE profile SET avatar_path=$1, avatar_data=$2 WHERE id=$3', ['/uploads/' + fname, dataUrl, existing.id]);
    } else {
      await db.insert('INSERT INTO profile (teacher,class,avatar_path,avatar_data) VALUES ($1,$2,$3,$4)',
        ['林老师', '三(2)班 · 语文', '/uploads/' + fname, dataUrl]);
    }
    res.json({ path: '/uploads/' + fname, data: dataUrl });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// student detail: scores + communications + class homework (for student profile view)
app.get('/api/students/:id/detail', async (req, res) => {
  try {
    const id = +req.params.id;
    const student = await db.get('SELECT * FROM students WHERE id=$1', [id]);
    if (!student) return res.status(404).json({ error: 'not found' });
    const scores = await db.all('SELECT * FROM scores WHERE student_id=$1 ORDER BY date DESC', [id]);
    const communications = await db.all('SELECT * FROM communications WHERE student_id=$1 ORDER BY date DESC', [id]);
    const homework = await db.all("SELECT * FROM homework ORDER BY due_date");
    res.json({ student, scores, communications, homework });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// dashboard stats
app.get('/api/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const studentCountRow = await db.get('SELECT COUNT(*) AS c FROM students');
    const studentCount = studentCountRow ? +studentCountRow.c : 0;
    const groupCount = (await db.all('SELECT DISTINCT group_name FROM students')).length;
    const todoOpenRow = await db.get("SELECT COUNT(*) AS c FROM todos WHERE done=0");
    const todoOpen = todoOpenRow ? +todoOpenRow.c : 0;
    const hwOpenRow = await db.get("SELECT COUNT(*) AS c FROM homework WHERE status!=$1", ['已完成']);
    const hwOpen = hwOpenRow ? +hwOpenRow.c : 0;
    const todayEvents = await db.all('SELECT * FROM events WHERE event_date=$1 ORDER BY event_time', [today]);
    const upcomingHw = await db.all("SELECT * FROM homework WHERE status!=$1 ORDER BY due_date LIMIT 3", ['已完成']);
    const recentScores = await db.all('SELECT s.score, st.name FROM scores s JOIN students st ON st.id=s.student_id ORDER BY s.id DESC LIMIT 6');
    const avgRow = await db.get('SELECT AVG(score) AS a FROM scores');
    const avg = avgRow ? avgRow.a : 0;
    res.json({
      studentCount, groupCount, todoOpen, hwOpen, todayEvents, upcomingHw, recentScores,
      avgScore: Math.round(avg * 10) / 10
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// AI assistant
app.post('/api/ai', async (req, res) => {
  try {
    const out = await ai.chat(req.body.message, req.body.history || []);
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

db.init().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log('小学语文教师工作台 running at http://0.0.0.0:' + PORT));
}).catch(e => { console.error('DB init failed:', e); process.exit(1); });
