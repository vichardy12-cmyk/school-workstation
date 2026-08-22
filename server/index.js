// index.js - Express server: REST API + static frontend
const express = require('express');
const path = require('path');
const db = require('./db');
const ai = require('./ai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// table column whitelist for safe inserts
const COLS = {
  students: ['name', 'gender', 'seat_no', 'group_name', 'parent_name', 'parent_phone', 'notes'],
  lessons: ['title', 'unit', 'lesson_date', 'objectives', 'content', 'status'],
  homework: ['title', 'due_date', 'description', 'status'],
  scores: ['student_id', 'exam_name', 'subject', 'score', 'date'],
  todos: ['title', 'due_date', 'priority', 'done'],
  notices: ['title', 'content', 'audience', 'pinned', 'date'],
  communications: ['student_id', 'date', 'channel', 'summary', 'parent_reply'],
  resources: ['title', 'category', 'link', 'note'],
  events: ['title', 'event_date', 'event_time', 'type', 'note'],
  timetable: ['day', 'period', 'subject', 'time', 'note'],
  exams: ['name', 'date', 'note']
};

function registerCrud(table) {
  const cols = COLS[table];
  app.get('/api/' + table, async (req, res) => {
    try { res.json(db.all('SELECT * FROM ' + table + ' ORDER BY id DESC')); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post('/api/' + table, async (req, res) => {
    try {
      const keys = cols.filter(c => req.body[c] !== undefined);
      const qs = keys.map(() => '?').join(',');
      const id = db.insert(
        'INSERT INTO ' + table + ' (' + keys.join(',') + ') VALUES (' + qs + ')',
        keys.map(k => req.body[k])
      );
      res.json(db.get('SELECT * FROM ' + table + ' WHERE id=?', [id]));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.patch('/api/' + table + '/:id', async (req, res) => {
    try {
      const keys = cols.filter(c => req.body[c] !== undefined);
      if (keys.length === 0) return res.json({ ok: true });
      const sets = keys.map(k => k + '=?').join(',');
      db.run('UPDATE ' + table + ' SET ' + sets + ' WHERE id=?', [...keys.map(k => req.body[k]), req.params.id]);
      res.json(db.get('SELECT * FROM ' + table + ' WHERE id=?', [req.params.id]));
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.delete('/api/' + table + '/:id', async (req, res) => {
    try { db.run('DELETE FROM ' + table + ' WHERE id=?', [req.params.id]); res.json({ ok: true }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });
}

// exams: custom CRUD so name/delete changes cascade to scores (keep student data linked)
app.get('/api/exams', async (req, res) => {
  try { res.json(db.all('SELECT * FROM exams ORDER BY id DESC')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/exams', async (req, res) => {
  try {
    const cols = COLS.exams.filter(c => req.body[c] !== undefined);
    const qs = cols.map(() => '?').join(',');
    const id = db.insert('INSERT INTO exams (' + cols.join(',') + ') VALUES (' + qs + ')', cols.map(k => req.body[k]));
    res.json(db.get('SELECT * FROM exams WHERE id=?', [id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/api/exams/:id', async (req, res) => {
  try {
    const cur = db.get('SELECT * FROM exams WHERE id=?', [req.params.id]);
    if (!cur) return res.status(404).json({ error: 'not found' });
    const name = req.body.name !== undefined ? req.body.name : cur.name;
    const date = req.body.date !== undefined ? req.body.date : cur.date;
    const note = req.body.note !== undefined ? req.body.note : cur.note;
    db.run('UPDATE exams SET name=?, date=?, note=? WHERE id=?', [name, date, note, req.params.id]);
    // keep student scores linked: if exam name changed, update matching scores
    if (req.body.name !== undefined && req.body.name !== cur.name) {
      db.run('UPDATE scores SET exam_name=? WHERE exam_name=?', [req.body.name, cur.name]);
    }
    res.json(db.get('SELECT * FROM exams WHERE id=?', [req.params.id]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/exams/:id', async (req, res) => {
  try {
    const cur = db.get('SELECT * FROM exams WHERE id=?', [req.params.id]);
    if (cur) db.run('DELETE FROM scores WHERE exam_name=?', [cur.name]);
    db.run('DELETE FROM exams WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// bulk create score rows (used when adding an exam together with its students)
app.post('/api/scores/bulk', async (req, res) => {
  try {
    const items = req.body.items || [];
    const created = [];
    for (const it of items) {
      const keys = ['student_id', 'exam_name', 'subject', 'score', 'date'].filter(k => it[k] !== undefined);
      const qs = keys.map(() => '?').join(',');
      const id = db.insert('INSERT INTO scores (' + keys.join(',') + ') VALUES (' + qs + ')', keys.map(k => it[k]));
      created.push(db.get('SELECT * FROM scores WHERE id=?', [id]));
    }
    res.json(created);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

['students', 'lessons', 'homework', 'scores', 'todos', 'notices', 'communications', 'resources', 'events', 'timetable'].forEach(registerCrud);

// settings (term_start for timetable week calculation)
app.get('/api/settings', async (req, res) => {
  try { const row = db.get("SELECT value FROM settings WHERE key='term_start'"); res.json({ term_start: row ? row.value : '' }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/settings', async (req, res) => {
  try { db.run("UPDATE settings SET value=? WHERE key='term_start'", [req.body.term_start || '']); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// student detail: scores + communications + class homework (for student profile view)
app.get('/api/students/:id/detail', async (req, res) => {
  try {
    const id = +req.params.id;
    const student = db.get('SELECT * FROM students WHERE id=?', [id]);
    if (!student) return res.status(404).json({ error: 'not found' });
    const scores = db.all('SELECT * FROM scores WHERE student_id=? ORDER BY date DESC', [id]);
    const communications = db.all('SELECT * FROM communications WHERE student_id=? ORDER BY date DESC', [id]);
    const homework = db.all("SELECT * FROM homework ORDER BY due_date");
    res.json({ student, scores, communications, homework });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// dashboard stats
app.get('/api/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const studentCount = db.get('SELECT COUNT(*) AS c FROM students').c;
    const groupCount = db.all('SELECT DISTINCT group_name FROM students').length;
    const todoOpen = db.get("SELECT COUNT(*) AS c FROM todos WHERE done=0").c;
    const hwOpen = db.get("SELECT COUNT(*) AS c FROM homework WHERE status!='已完成'").c;
    const todayEvents = db.all('SELECT * FROM events WHERE event_date=? ORDER BY event_time', [today]);
    const upcomingHw = db.all("SELECT * FROM homework WHERE status!='已完成' ORDER BY due_date LIMIT 3");
    const recentScores = db.all('SELECT s.score, st.name FROM scores s JOIN students st ON st.id=s.student_id ORDER BY s.id DESC LIMIT 6');
    const avg = db.get('SELECT AVG(score) AS a FROM scores').a || 0;
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
