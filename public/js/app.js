// app.js - SPA for 小学语文教师工作台
const $ = sel => document.querySelector(sel);
const content = $('#content');

function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
async function getJSON(url){ const r = await fetch(url); return r.json(); }
async function api(method, url, body){
  const r = await fetch(url, {method, headers:{'Content-Type':'application/json'}, body: body?JSON.stringify(body):undefined});
  return r.json();
}
function tag(text, cls){ return '<span class="tag '+(cls||'')+'">'+esc(text)+'</span>'; }
function statusTag(s){
  if(s==='已完成'||s==='优秀') return tag(s,'blue');
  if(s==='进行中'||s==='高') return tag(s);
  if(s==='未开始'||s==='低'||s==='草稿') return tag(s,'amber');
  return tag(s);
}

// ---------- Modal helpers ----------
let modalCloseCb = null;
function openModal(html){ $('#modal').innerHTML = html; $('#modalMask').hidden = false; modalCloseCb = null; }
function hideModal(){ $('#modalMask').hidden = true; }
$('#modalMask').addEventListener('click', e=>{
  if(e.target.id === 'modalMask'){ if(modalCloseCb){ const cb = modalCloseCb; modalCloseCb = null; cb(); } else hideModal(); }
});
function confirmDialog(msg){
  return new Promise(res=>{
    $('#modal').innerHTML = `<div class="modal-title">⚠️ 确认删除</div>
      <p style="margin:6px 0 18px;color:var(--text)">${esc(msg)}</p>
      <div class="btn-row"><button class="btn ghost" id="cfNo">取消</button><button class="btn" id="cfYes" style="background:#A32D2D">确定删除</button></div>`;
    $('#modalMask').hidden = false;
    const done = v => { modalCloseCb = null; $('#modalMask').hidden = true; res(v); };
    modalCloseCb = () => done(false);
    $('#cfNo').onclick = () => done(false);
    $('#cfYes').onclick = () => done(true);
  });
}

// ---------- Profile (editable name / class / avatar) ----------
function applyProfile(){
  const av = localStorage.getItem('sw_avatar');
  const nm = localStorage.getItem('sw_teacher') || '林老师';
  const cls = localStorage.getItem('sw_class') || '三(2)班 · 语文';
  if(av) { $('#avatar').style.backgroundImage = 'url('+av+')'; $('#avatar').textContent=''; }
  else { $('#avatar').style.backgroundImage=''; $('#avatar').textContent = nm[0]; }
  $('#teacherName').textContent = nm;
  if($('#teacherClass')) $('#teacherClass').textContent = cls;
  const hn = $('#heroName'); if(hn) hn.textContent = nm;
}
function openProfileModal(){
  const c=getCreds();
  openModal(`<button class="close-x" id="pClose">×</button>
    <div class="modal-title">👤 我的资料与账号</div>
    <div class="m-field"><label>姓名</label><input id="pName" value="${esc(localStorage.getItem('sw_teacher')||'林老师')}"></div>
    <div class="m-field"><label>班级 / 科目</label><input id="pClass" value="${esc(localStorage.getItem('sw_class')||'三(2)班 · 语文')}"></div>
    <div class="m-field"><label>头像</label><button class="btn ghost sm" id="pAvatar">更换头像</button></div>
    <div class="btn-row"><button class="btn ghost" id="pCancel">取消</button><button class="btn" id="pSave">保存</button></div>
    <div class="m-divider"></div>
    <div class="m-section-title">🔐 账号安全</div>
    <div class="m-field"><label>修改用户名（需输入当前密码验证）</label>
      <div style="display:flex;gap:8px"><input id="pCurPassForUser" type="password" placeholder="当前密码"><input id="pNewUser" placeholder="新用户名"></div>
      <button class="btn sm" id="pSaveUser" style="margin-top:6px">保存用户名</button></div>
    <div class="m-field"><label>修改密码（需输入旧密码验证）</label>
      <input id="pOldPass" type="password" placeholder="旧密码">
      <input id="pNewPass" type="password" placeholder="新密码" style="margin-top:6px">
      <input id="pConfirmPass" type="password" placeholder="确认新密码" style="margin-top:6px">
      <button class="btn sm" id="pSavePass" style="margin-top:6px">保存密码</button></div>
    <div class="btn-row" style="margin-top:4px"><button class="btn ghost" id="pLogout" style="color:#A32D2D">退出登录</button></div>`);
  $('#pClose').onclick = hideModal; $('#pCancel').onclick = hideModal;
  $('#pLogout').onclick = ()=>{ localStorage.removeItem('sw_auth'); sessionStorage.removeItem('sw_auth'); location.reload(); };
  $('#pAvatar').onclick = ()=>{
    const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
    inp.onchange = ()=>{ const f=inp.files[0]; if(!f) return; const rd=new FileReader();
      rd.onload = ()=>{ localStorage.setItem('sw_avatar', rd.result); applyProfile(); }; rd.readAsDataURL(f); };
    inp.click();
  };
  $('#pSave').onclick = ()=>{
    localStorage.setItem('sw_teacher', $('#pName').value.trim() || '林老师');
    localStorage.setItem('sw_class', $('#pClass').value.trim() || '三(2)班 · 语文');
    applyProfile(); hideModal();
  };
  $('#pSaveUser').onclick = ()=>{
    if($('#pCurPassForUser').value !== c.pass){ alert('当前密码错误，无法修改用户名。'); return; }
    const nu = $('#pNewUser').value.trim();
    if(!nu){ alert('请输入新用户名。'); return; }
    localStorage.setItem('sw_user', nu); alert('用户名已更新为「'+nu+'」。'); hideModal();
  };
  $('#pSavePass').onclick = ()=>{
    if($('#pOldPass').value !== c.pass){ alert('旧密码错误，无法修改密码。'); return; }
    const np = $('#pNewPass').value, cp = $('#pConfirmPass').value;
    if(!np){ alert('请输入新密码。'); return; }
    if(np !== cp){ alert('两次输入的新密码不一致。'); return; }
    localStorage.setItem('sw_pass', np); alert('密码已更新。'); hideModal();
  };
}
function initProfile(){ applyProfile(); $('#profile').addEventListener('click', openProfileModal); }

// ---------- Top date ----------
function initTopDate(){
  const d = new Date();
  const wk = ['日','一','二','三','四','五','六'][d.getDay()];
  $('#topDate').textContent = d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日 星期'+wk;
}

// ---------- Router ----------
const routes = {
  dashboard: renderDashboard, students: renderStudents, lessons: renderGeneric,
  homework: renderGeneric, scores: renderScores, communications: renderStudentPage,
  notices: renderGeneric, todos: renderTodos, timetable: renderTimetable,
  resources: renderGeneric, events: renderGeneric
};
function navigate(route){
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active', n.dataset.route===route));
  (routes[route]||renderDashboard)(route);
  if(window.innerWidth<=760) window.scrollTo(0,0);
}
document.querySelectorAll('.nav-item').forEach(n=> n.addEventListener('click', ()=>navigate(n.dataset.route)));
window.addEventListener('hashchange', ()=> navigate(location.hash.slice(2)||'dashboard'));
function start(){ navigate(location.hash.slice(2)||'dashboard'); }

// ---------- Dashboard ----------
const QUOTES = [
  '教育是一棵树摇动另一棵树，一朵云推动另一朵云。',
  '用爱心浇灌，用耐心等待，每一朵花都会开放。',
  '把每个孩子都当作独一无二的星星。',
  '教学相长，和孩子一同成长。'
];
function greeting(){
  const h = new Date().getHours();
  if(h<6) return '夜深了'; if(h<12) return '早上好'; if(h<14) return '中午好'; if(h<18) return '下午好'; return '晚上好';
}
function renderDashboard(){
  const nm = localStorage.getItem('sw_teacher') || '林老师';
  const cls = localStorage.getItem('sw_class') || '三(2)班 · 语文';
  content.innerHTML = `
    <div class="hero">
      <div class="leaf l1">🌿</div><div class="leaf l2">🍃</div><div class="leaf l3">🌱</div>
      <h1>${greeting()}，<span id="heroName">${esc(nm)}</span>！</h1>
      <p>今天也是用心陪伴孩子们的一天 · ${esc(cls)}</p>
    </div>
    <div class="widget-grid">
      <div class="widget"><h3>🕒 时钟</h3><div class="clock" id="clk">--:--:--</div><div class="clock-date" id="clkDate"></div></div>
      <div class="widget"><h3>📅 日历</h3>
        <div class="cal-nav"><button id="calPrev">‹</button><span class="cal-title" id="calTitle"></span><button id="calNext">›</button></div>
        <div class="cal-grid" id="cal"></div></div>
      <div class="widget"><h3>✅ 待办事项</h3><div id="dashTodos" style="font-size:13px">加载中…</div>
        <div style="margin-top:8px"><button class="btn ghost sm" onclick="navigate('todos')">查看全部</button></div></div>
      <div class="widget blackboard"><h3>📌 小黑板</h3>
        <textarea id="bb" placeholder="随手记点什么…">${esc(localStorage.getItem('sw_notes')||'')}</textarea>
        <div class="bb-hint">📝 自动保存到本机</div></div>
    </div>
    <div class="section"><div class="widget"><h3>📚 本周课程表</h3><div class="tt-grid" id="tt"></div></div></div>
    <div class="widget-grid section">
      <div class="widget"><h3>👥 班级概况</h3><div class="metric" id="mStudents">-</div><div class="metric-sub" id="mGroups"></div></div>
      <div class="widget"><h3>📝 作业提醒</h3><div class="metric" id="mHw">-</div><div class="metric-sub">进行中</div></div>
      <div class="widget"><h3>📈 平均成绩</h3><div class="metric" id="mAvg">-</div><div class="metric-sub">语文</div></div>
      <div class="widget"><h3>📌 待办未完成</h3><div class="metric" id="mTodos">-</div><div class="metric-sub">未完成</div></div>
    </div>
    <div class="widget-grid section">
      <div class="widget"><h3>⏰ 今日安排</h3><div id="todayEvents">加载中…</div></div>
      <div class="widget"><h3>🔔 近期作业</h3><div id="upHw">加载中…</div></div>
    </div>
    <div class="widget-grid section">
      <div class="widget" style="grid-column:span 2"><h3>💡 每日一言</h3><div style="font-size:14px;color:var(--green-800)">${QUOTES[new Date().getDate()%QUOTES.length]}</div></div>
      <div class="widget" style="grid-column:span 2"><h3>🚀 快捷入口</h3>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${['students','lessons','homework','scores','communications','notices','todos','timetable','resources','events'].map(r=>`<button class="btn ghost sm" onclick="navigate('${r}')">${navLabel(r)}</button>`).join('')}
        </div>
      </div>
    </div>`;
  startClock();
  loadDashboardData();
}
function navLabel(r){ return {students:'学生管理',lessons:'教案管理',homework:'作业管理',scores:'成绩管理',communications:'家校沟通',notices:'通知公告',todos:'待办事项',timetable:'课程表',resources:'教学资料',events:'日程安排'}[r]||r; }

let calOffset = 0;
function startClock(){
  const tick = ()=>{
    const d = new Date();
    const p = n=>String(n).padStart(2,'0');
    $('#clk').textContent = p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
    const wk=['日','一','二','三','四','五','六'][d.getDay()];
    $('#clkDate').textContent = d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' 星期'+wk;
  };
  tick(); setInterval(tick,1000);
}
let allEventsCache = [];
function renderCalendar(){
  const base = new Date(); base.setDate(1); base.setMonth(base.getMonth()+calOffset);
  const y=base.getFullYear(), m=base.getMonth();
  const first = new Date(y,m,1).getDay(); const days=new Date(y,m+1,0).getDate();
  const evSet = new Set(allEventsCache.filter(e=>{ const d=new Date(e.event_date); return d.getFullYear()===y && d.getMonth()===m; }).map(e=>e.event_date));
  $('#calTitle').textContent = y+'年'+(m+1)+'月';
  let h = ['日','一','二','三','四','五','六'].map(x=>'<div class="cal-cell head">'+x+'</div>').join('');
  for(let i=0;i<first;i++) h+='<div class="cal-cell muted"></div>';
  const today = new Date();
  for(let i=1;i<=days;i++){
    const ds = y+'-'+String(m+1).padStart(2,'0')+'-'+String(i).padStart(2,'0');
    const isToday = (calOffset===0 && i===today.getDate());
    const cls = (isToday?'today ':'')+(evSet.has(ds)?'has-ev':'');
    h+='<div class="cal-cell '+(cls)+'">'+i+'</div>';
  }
  $('#cal').innerHTML = h;
}
async function loadDashboardData(){
  const s = await getJSON('/api/stats');
  $('#mStudents').textContent = s.studentCount;
  $('#mGroups').textContent = s.groupCount+' 个小组';
  $('#mTodos').textContent = s.todoOpen;
  $('#mHw').textContent = s.hwOpen;
  $('#mAvg').textContent = s.avgScore;
  $('#todayEvents').innerHTML = s.todayEvents.length? s.todayEvents.map(e=>'• '+esc(e.event_time)+' '+esc(e.title)).join('<br>') : '今日暂无安排 🌿';
  $('#upHw').innerHTML = s.upcomingHw.length? s.upcomingHw.map(h=>'• '+esc(h.title)+'（'+esc(h.due_date)+'）').join('<br>') : '暂无待交作业';
  const tt = await getJSON('/api/timetable');
  renderTimetableGrid(tt);
  allEventsCache = await getJSON('/api/events');
  renderCalendar();
  $('#calPrev').onclick = ()=>{ calOffset--; renderCalendar(); };
  $('#calNext').onclick = ()=>{ calOffset++; renderCalendar(); };
  const todos = await getJSON('/api/todos');
  const live = todos.filter(t=>!t.done).slice(0,5);
  $('#dashTodos').innerHTML = live.length? live.map(t=>`<div style="display:flex;gap:8px;align-items:center;padding:4px 0">
      <input type="checkbox" data-todo="${t.id}"> <span>${esc(t.title)}</span></div>`).join('')
    : '🎉 暂无待办，轻松一下~';
  $('#dashTodos').querySelectorAll('[data-todo]').forEach(c=> c.onchange=async()=>{
    await api('PATCH','/api/todos/'+c.dataset.todo,{done:1});
    c.closest('div').style.opacity=.4; c.disabled=true;
  });
  const bb = $('#bb'); if(bb) bb.oninput = ()=> localStorage.setItem('sw_notes', bb.value);
}
function renderTimetableGrid(rows){
  const days=['周一','周二','周三','周四','周五'];
  const maxP = Math.max(...rows.map(r=>r.period));
  let h='<div class="tt-cell head">节</div>'+days.map(d=>'<div class="tt-cell head">'+d+'</div>').join('');
  const map={}; rows.forEach(r=>{ (map[r.day]=map[r.day]||{})[r.period]=r.subject; });
  for(let p=1;p<=maxP;p++){
    h+='<div class="tt-cell head">第'+p+'节</div>';
    days.forEach(d=>{ h+='<div class="tt-cell subj">'+(map[d]&&map[d][p]?esc(map[d][p]):'—')+'</div>'; });
  }
  $('#tt').innerHTML=h;
}

// ---------- Generic CRUD pages (with confirm delete) ----------
const CFG = {
  lessons:{ title:'教案管理', table:'lessons', cols:[['title','课题'],['unit','单元'],['lesson_date','日期'],['objectives','目标'],['content','内容'],['status','状态',true]],
    fields:[['title','课题','text'],['unit','单元','text'],['lesson_date','日期','date'],['objectives','目标','text'],['content','内容','text'],['status','状态','select:草稿,已完成']] },
  homework:{ title:'作业管理', table:'homework', cols:[['title','标题'],['due_date','截止'],['description','说明'],['status','状态',true]],
    fields:[['title','标题','text'],['due_date','截止','date'],['description','说明','text'],['status','状态','select:进行中,未开始,已完成']] },
  notices:{ title:'通知公告', table:'notices', cols:[['title','标题'],['content','内容'],['audience','对象'],['pinned','置顶'],['date','日期']],
    fields:[['title','标题','text'],['content','内容','text'],['audience','对象','text'],['pinned','置顶','select:0,1'],['date','日期','date']] },
  resources:{ title:'教学资料', table:'resources', cols:[['title','标题'],['category','分类'],['link','链接'],['note','备注']],
    fields:[['title','标题','text'],['category','分类','text'],['link','链接','text'],['note','备注','text']] },
  events:{ title:'日程安排', table:'events', cols:[['title','标题'],['event_date','日期'],['event_time','时间'],['type','类型'],['note','备注']],
    fields:[['title','标题','text'],['event_date','日期','date'],['event_time','时间','text'],['type','类型','select:课,会议,值日,活动'],['note','备注','text']] }
};
async function renderGeneric(route){
  const cfg = CFG[route]; const table = cfg.table;
  let rows = await getJSON('/api/'+table);
  content.innerHTML = `<div class="page-title">${cfg.title}</div>
    <div class="card">
      <div style="font-weight:600;margin-bottom:6px">添加新条目</div>
      <div class="form-row" id="addForm">${cfg.fields.map(f=>fieldHTML(f)).join('')}
        <button class="btn" id="addBtn">添加</button>
      </div>
    </div>
    <div class="section"><table><thead><tr>${cfg.cols.map(c=>'<th>'+c[1]+'</th>').join('')}<th></th></tr></thead>
      <tbody id="tbody"></tbody></table></div>`;
  const tbody = $('#tbody');
  function draw(){
    tbody.innerHTML = rows.map(r=>{
      let cells = cfg.cols.map(c=>{
        let v = r[c[0]];
        if(c[2]===true && (c[0]==='status'||c[0]==='priority')) return '<td>'+statusTag(v)+'</td>';
        if(c[0]==='pinned') return '<td>'+(v? '📌 置顶':'—')+'</td>';
        return '<td>'+esc(v)+'</td>';
      }).join('');
      return '<tr>'+cells+'<td><button class="del" data-del="'+r.id+'">删除</button></td></tr>';
    }).join('');
    tbody.querySelectorAll('[data-del]').forEach(b=> b.onclick=async()=>{
      if(await confirmDialog('确定删除这条记录吗？此操作不可恢复。')){
        await api('DELETE','/api/'+table+'/'+b.dataset.del); rows = rows.filter(r=>r.id!=b.dataset.del); draw();
      }
    });
  }
  draw();
  $('#addBtn').onclick = async ()=>{
    const body={}; cfg.fields.forEach(f=>{ const el=document.getElementById('f_'+f[0]); body[f[0]]=el.value; });
    const created = await api('POST','/api/'+table, body);
    rows.unshift(created); draw();
    cfg.fields.forEach(f=>{ document.getElementById('f_'+f[0]).value=''; });
  };
}
function fieldHTML(f){
  const [key,label,type]=f;
  if(type && type.startsWith('select:')){
    const opts = type.split(':')[1].split(',').map(o=>'<option value="'+o+'">'+o+'</option>').join('');
    return '<div><label style="display:block;font-size:12px;color:var(--muted)">'+label+'</label><select id="f_'+key+'">'+opts+'</select></div>';
  }
  return '<div><label style="display:block;font-size:12px;color:var(--muted)">'+label+'</label><input id="f_'+key+'" type="'+(type||'text')+'" /></div>';
}

// ---------- Students page (group filter + edit + confirm delete) ----------
async function renderStudents(){
  let students = await getJSON('/api/students');
  const groups = [...new Set(students.map(s=>s.group_name))].sort();
  let sortKey='seat_no', sortDir='asc';
  const sArrow=k=> (k===sortKey)?(sortDir==='asc'?' ▲':' ▼'):'';
  content.innerHTML = `<div class="page-title">学生管理</div>
    <div class="card">
      <div style="font-weight:600;margin-bottom:6px">添加学生</div>
      <div class="form-row" id="addForm">
        <div><label style="display:block;font-size:12px;color:var(--muted)">姓名</label><input id="f_name" type="text" placeholder="姓名" /></div>
        <div><label style="display:block;font-size:12px;color:var(--muted)">性别</label><select id="f_gender">${['男','女'].map(o=>'<option>'+o+'</option>').join('')}</select></div>
        <div><label style="display:block;font-size:12px;color:var(--muted)">座号</label><input id="f_seat_no" type="number" /></div>
        <div><label style="display:block;font-size:12px;color:var(--muted)">小组</label><input id="f_group_name" type="text" placeholder="第1组" /></div>
        <div><label style="display:block;font-size:12px;color:var(--muted)">家长</label><input id="f_parent_name" type="text" /></div>
        <div><label style="display:block;font-size:12px;color:var(--muted)">电话</label><input id="f_parent_phone" type="text" /></div>
        <div><label style="display:block;font-size:12px;color:var(--muted)">备注</label><input id="f_notes" type="text" /></div>
        <button class="btn" id="addBtn">添加</button>
      </div>
    </div>
    <div class="filter-bar" id="groupFilter">
      <span style="font-size:13px;color:var(--muted)">按小组筛选：</span>
      <span class="chip active" data-g="all">全部</span>
      ${groups.map(g=>'<span class="chip" data-g="'+esc(g)+'">'+esc(g)+'</span>').join('')}
    </div>
    <div class="section"><table><thead><tr><th>姓名</th><th>性别</th><th>座号</th><th>小组</th><th>家长</th><th>电话</th><th>备注</th><th>操作</th></tr></thead>
      <tbody id="tbody"></tbody></table>
      <div style="font-size:12px;color:var(--muted);margin-top:8px">💡 点击学生姓名可查看其「成绩 / 家校沟通 / 作业」完整档案；点「修改」可编辑，点「删除」需确认。</div>
    </div>`;
  const tbody=$('#tbody');
  let flt='all';
  function draw(){
    const list = flt==='all'? students : students.filter(s=>s.group_name===flt);
    const dir = sortDir==='asc'?1:-1;
    const sorted=[...list].sort((a,b)=>{
      if(sortKey==='name') return (a.name||'').localeCompare(b.name||'','zh')*dir;
      if(sortKey==='seat_no') return (((+a.seat_no)||0)-((+b.seat_no)||0))*dir;
      if(sortKey==='group') return (a.group_name||'').localeCompare(b.group_name||'','zh')*dir;
      return 0;
    });
    tbody.innerHTML = sorted.map(r=>`<tr>
      <td><span class="name-link" data-std="${r.id}">${esc(r.name)}</span></td>
      <td>${esc(r.gender)}</td><td>${esc(r.seat_no)}</td><td>${esc(r.group_name)}</td>
      <td>${esc(r.parent_name)}</td><td>${esc(r.parent_phone)}</td><td>${esc(r.notes)}</td>
      <td><button class="btn ghost sm" data-edit="${r.id}">修改</button> <button class="del" data-del="${r.id}">删除</button></td></tr>`).join('');
    tbody.querySelectorAll('[data-std]').forEach(b=> b.onclick=()=>openStudentDetail(+b.dataset.std));
    tbody.querySelectorAll('[data-edit]').forEach(b=> b.onclick=()=> editStudent(+b.dataset.edit));
    tbody.querySelectorAll('[data-del]').forEach(b=> b.onclick=async()=>{
      const s = students.find(x=>x.id==b.dataset.del);
      if(await confirmDialog('确定删除学生「'+(s?s.name:'')+'」？相关成绩与沟通记录也将无法恢复。')){
        await api('DELETE','/api/students/'+b.dataset.del); students = students.filter(x=>x.id!=b.dataset.del); draw();
      }
    });
  }
  function editStudent(id){
    const s = students.find(x=>x.id==id); if(!s) return;
    openModal(`<button class="close-x" id="eClose">×</button><div class="modal-title">✏️ 修改学生</div>
      <div class="m-field"><label>姓名</label><input id="e_name" value="${esc(s.name)}"></div>
      <div class="m-field"><label>性别</label><select id="e_gender">${['男','女'].map(o=>`<option ${o===s.gender?'selected':''}>${o}</option>`).join('')}</select></div>
      <div class="m-field"><label>座号</label><input id="e_seat_no" type="number" value="${esc(s.seat_no)}"></div>
      <div class="m-field"><label>小组</label><input id="e_group_name" value="${esc(s.group_name)}"></div>
      <div class="m-field"><label>家长</label><input id="e_parent_name" value="${esc(s.parent_name)}"></div>
      <div class="m-field"><label>电话</label><input id="e_parent_phone" value="${esc(s.parent_phone)}"></div>
      <div class="m-field"><label>备注</label><input id="e_notes" value="${esc(s.notes)}"></div>
      <div class="btn-row"><button class="btn ghost" id="eCancel">取消</button><button class="btn" id="eSave">保存</button></div>`);
    $('#eClose').onclick=hideModal; $('#eCancel').onclick=hideModal;
    $('#eSave').onclick=async()=>{
      const body={name:$('#e_name').value, gender:$('#e_gender').value, seat_no:+$('#e_seat_no').value,
        group_name:$('#e_group_name').value, parent_name:$('#e_parent_name').value, parent_phone:$('#e_parent_phone').value, notes:$('#e_notes').value};
      const upd=await api('PATCH','/api/students/'+id, body);
      const i=students.findIndex(x=>x.id==id); if(i>-1) students[i]=Object.assign(students[i],upd);
      hideModal(); draw();
    };
  }
  draw();
  content.querySelectorAll('th.sortable').forEach(th=> th.onclick=()=>{
    const k=th.dataset.sort;
    if(sortKey===k) sortDir = sortDir==='asc'?'desc':'asc';
    else { sortKey=k; sortDir='asc'; }
    draw();
  });
  $('#groupFilter').querySelectorAll('.chip').forEach(c=> c.onclick=()=>{
    $('#groupFilter').querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));
    c.classList.add('active'); flt=c.dataset.g; draw();
  });
  $('#addBtn').onclick = async ()=>{
    const body={}; ['name','gender','seat_no','group_name','parent_name','parent_phone','notes'].forEach(k=> body[k]=document.getElementById('f_'+k).value);
    const created = await api('POST','/api/students', body);
    students.unshift(created); draw();
    ['name','seat_no','group_name','parent_name','parent_phone','notes'].forEach(k=> document.getElementById('f_'+k).value='');
  };
}

// ---------- Student detail modal ----------
async function openStudentDetail(id){
  const d = await getJSON('/api/students/'+id+'/detail');
  const s = d.student;
  const scoreRows = d.scores.length? d.scores.map(x=>`<div class="m-row"><span>${esc(x.exam_name)} · ${esc(x.subject)}</span><span>${esc(x.score)} 分（${esc(x.date)}）</span></div>`).join('') : '<div class="m-empty">暂无成绩记录</div>';
  const commRows = d.communications.length? d.communications.map(x=>`<div class="m-row"><span>${esc(x.channel)} · ${esc(x.date)}</span><span>${esc(x.summary)}</span></div>`).join('') : '<div class="m-empty">暂无沟通记录</div>';
  const hwRows = d.homework.length? d.homework.map(x=>`<div class="m-row"><span>${esc(x.title)}</span><span>${esc(x.due_date)} · ${statusTag(x.status)}</span></div>`).join('') : '<div class="m-empty">暂无作业</div>';
  openModal(`<button class="close-x" id="modalClose">×</button>
    <h2>${esc(s.name)} 的档案</h2>
    <div class="modal-sub">${esc(s.gender)} · 座号 ${esc(s.seat_no)} · ${esc(s.group_name)} · 家长：${esc(s.parent_name)}（${esc(s.parent_phone)}）</div>
    <div class="modal-sub">备注：${esc(s.notes||'—')}</div>
    <div class="m-section"><h4>📊 成绩记录（${d.scores.length} 条）</h4>${scoreRows}</div>
    <div class="m-section"><h4>💬 家校沟通（${d.communications.length} 条）</h4>${commRows}</div>
    <div class="m-section"><h4>📝 班级作业（${d.homework.length} 条）</h4>${hwRows}</div>`);
  $('#modalClose').onclick=hideModal;
}

// ---------- Scores (exam definition + per-exam score entry) ----------
async function renderScores(){
  let [scores, students, exams] = await Promise.all([getJSON('/api/scores'), getJSON('/api/students'), getJSON('/api/exams')]);
  const smap={}; const gmap={}; const seatmap={}; students.forEach(s=>{smap[s.id]=s.name; gmap[s.id]=s.group_name; seatmap[s.id]=s.seat_no;});
  const groups = [...new Set(students.map(s=>s.group_name).filter(Boolean))];
  let cur = exams[0] ? exams[0].name : '';
  let curGrp = 'all';
  function refreshSelects(){
    const exOpts = exams.map(e=>'<option value="'+esc(e.name)+'">'+esc(e.name)+'（'+(e.date||'')+'）</option>').join('');
    const exSel = $('#examSel'); if(exSel) exSel.innerHTML = exOpts || '<option>暂无考试</option>';
  }
  content.innerHTML = `<div class="page-title">成绩管理</div>
    <div class="card">
      <div style="font-weight:600;margin-bottom:8px">📋 考试管理</div>
      <div class="form-row">
        <div><label style="display:block;font-size:12px;color:var(--muted)">选择 / 查看考试</label>
          <select id="examSel" style="min-width:200px">${exams.map(e=>'<option value="'+esc(e.name)+'">'+esc(e.name)+'（'+(e.date||'')+'）</option>').join('')||'<option>暂无考试</option>'}</select></div>
        <button class="btn ghost" id="addExamBtn">＋ 添加考试</button>
        <button class="btn ghost" id="editExamBtn">✏️ 修改</button>
        <button class="del" id="delExamBtn">删除考试</button>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">💡 添加考试时可<b>直接选择参加的学生</b>（全部 / 按小组 / 手动），下方自动生成名单并可直接填写分数。</div>
    </div>
    <div class="section"><div id="examTable"></div></div>`;

  let sortKey='seat_no', sortDir='asc';
  function drawExam(){
    if(!cur){ $('#examTable').innerHTML='<div class="exam-empty">请先在上方添加或选择一场考试。</div>'; return; }
    const list = scores.filter(s=>s.exam_name===cur);
    if(!list.length){
      $('#examTable').innerHTML='<div class="exam-empty">「'+esc(cur)+'」还没有学生成绩，点击下方「＋ 添加学生」把参加本次考试的学生加进来。</div>'+
        '<div style="margin-top:8px"><button class="btn" id="addStuBtn">＋ 添加学生</button></div>';
      bindAddStu(); return;
    }
    const examOpts = exams.map(e=>'<option value="'+esc(e.name)+'" '+(e.name===cur?'selected':'')+'>'+esc(e.name)+'</option>').join('');
    const gf = curGrp;
    const filtered = gf==='all' ? list : list.filter(r=> (gmap[r.student_id]||'')===gf);
    const nums = filtered.map(r=>+r.score).filter(v=>!isNaN(v));
    const avg = nums.length? Math.round(nums.reduce((a,b)=>a+b,0)/nums.length*10)/10 : '-';
    const hi = nums.length? Math.max(...nums): '-';
    const lo = nums.length? Math.min(...nums): '-';
    const arrow=k=> (k===sortKey)? (sortDir==='asc'?' ▲':' ▼') : '';
    const dir = sortDir==='asc'?1:-1;
    const sorted=[...filtered].sort((a,b)=>{
      if(sortKey==='name') return (smap[a.student_id]||'').localeCompare(smap[b.student_id]||'','zh')*dir;
      if(sortKey==='seat_no') return (((+seatmap[a.student_id])||0)-((+seatmap[b.student_id])||0))*dir;
      if(sortKey==='score') return (((+a.score)||-1)-((+b.score)||-1))*dir;
      return 0;
    });
    $('#examTable').innerHTML=`<div style="font-weight:600;margin-bottom:6px">${esc(cur)} · 共 ${filtered.length} 人 · 已录 ${nums.length} 人 · 平均分 ${avg} · 最高 ${hi} · 最低 ${lo}</div>
      <div class="form-row" style="margin-bottom:8px">
        <div><label style="display:block;font-size:12px;color:var(--muted)">按考试筛选</label><select id="examFilter">${examOpts}</select></div>
        <div><label style="display:block;font-size:12px;color:var(--muted)">按小组筛选</label><select id="grpFilter">${'<option value="all">全部小组</option>'+groups.map(g=>'<option value="'+esc(g)+'" '+(g===gf?'selected':'')+'>'+esc(g)+'</option>').join('')}</select></div>
        <button class="btn ghost" id="addStuBtn">＋ 添加学生</button>
      </div>
      <table><thead><tr>
        <th class="sortable" data-sort="name">学生${arrow('name')}</th>
        <th class="sortable" data-sort="seat_no">座号${arrow('seat_no')}</th>
        <th class="sortable" data-sort="score">分数${arrow('score')}</th>
        <th>科目</th><th>日期</th><th>操作</th>
      </tr></thead><tbody id="sbody"></tbody></table>
      <div style="font-size:12px;color:var(--muted);margin-top:6px">✏️ 点击表头「学生 / 座号 / 分数」可升序 ▲ / 降序 ▼ 切换排序；点每行「修改」可录入或调整分数。</div>`;
    const tb=$('#sbody');
    tb.innerHTML=sorted.map(r=>`<tr>
      <td>${esc(smap[r.student_id]||'-')}</td>
      <td>${seatmap[r.student_id]==null?'—':esc(seatmap[r.student_id])}</td>
      <td>${r.score==null?'—':esc(r.score)}</td>
      <td>${esc(r.subject||'语文')}</td>
      <td>${esc(r.date)}</td>
      <td><button class="btn ghost sm" data-edit="${r.id}">修改</button> <button class="del sm" data-del="${r.id}">删除</button></td></tr>`).join('');
    tb.querySelectorAll('[data-edit]').forEach(b=> b.onclick=()=> editScore(+b.dataset.edit));
    tb.querySelectorAll('[data-del]').forEach(b=> b.onclick=async()=>{
      if(await confirmDialog('确定删除该学生本次成绩？')){
        await api('DELETE','/api/scores/'+b.dataset.del);
        scores = scores.filter(x=>x.id!=b.dataset.del);
        drawExam();
      }
    });
    const esel=$('#examFilter'); if(esel) esel.onchange=()=>{ cur=esel.value; $('#examSel').value=cur; drawExam(); };
    const gsel=$('#grpFilter'); if(gsel) gsel.onchange=()=>{ curGrp=gsel.value; drawExam(); };
    document.querySelectorAll('#examTable th.sortable').forEach(th=> th.onclick=()=>{
      const k=th.dataset.sort;
      if(sortKey===k) sortDir = sortDir==='asc'?'desc':'asc';
      else { sortKey=k; sortDir='asc'; }
      drawExam();
    });
    bindAddStu();
  }
  function bindAddStu(){ const b=$('#addStuBtn'); if(b) b.onclick=()=> openAddStudents(cur); }
  function openAddStudents(examName){
    const ex = exams.find(e=>e.name===examName);
    const inExam = new Set(scores.filter(s=>s.exam_name===examName).map(s=>s.student_id));
    const avail = students.filter(s=>!inExam.has(s.id));
    if(!avail.length){ alert('该考试已包含全部学生'); return; }
    openModal(`<button class="close-x" id="aClose">×</button><div class="modal-title">＋ 添加学生到「${esc(examName)}」</div>
      <div class="m-field"><label>选择方式</label>
        <select id="a_mode"><option value="all">全部未加入学生（${avail.length}人）</option><option value="group">按小组</option><option value="manual">手动勾选</option></select></div>
      <div id="a_groupBox" hidden><div class="m-field"><label>小组</label><div>${groups.map(g=>'<label style="margin-right:10px;white-space:nowrap"><input type="checkbox" class="a-grp" value="'+esc(g)+'"> '+esc(g)+'</label>').join('')}</div></div></div>
      <div id="a_manualBox" hidden style="max-height:240px;overflow:auto"><div class="m-field"><label>学生（${avail.length}人）</label><div>${avail.map(s=>'<label style="display:block"><input type="checkbox" class="a-stu" value="'+s.id+'"> '+esc(s.name)+'（'+esc(s.group_name||'')+'）</label>').join('')}</div></div></div>
      <div class="btn-row"><button class="btn ghost" id="aCancel">取消</button><button class="btn" id="aSave">添加</button></div>`);
    $('#aClose').onclick=hideModal; $('#aCancel').onclick=hideModal;
    const modeSel=$('#a_mode');
    const sync=()=>{ $('#a_groupBox').hidden = modeSel.value!=='group'; $('#a_manualBox').hidden = modeSel.value!=='manual'; };
    modeSel.onchange=sync; sync();
    $('#aSave').onclick=async()=>{
      let ids=[];
      if(modeSel.value==='all') ids = avail.map(s=>s.id);
      else if(modeSel.value==='group'){ const gs=[...document.querySelectorAll('.a-grp')].filter(c=>c.checked).map(c=>c.value); ids = avail.filter(s=>gs.includes(s.group_name)).map(s=>s.id); }
      else { ids = [...document.querySelectorAll('.a-stu')].filter(c=>c.checked).map(c=>+c.value); }
      if(!ids.length){ alert('请至少选择一名学生'); return; }
      const items = ids.map(sid=>({student_id:sid, exam_name:examName, subject:'语文', score:null, date: ex?ex.date:''}));
      await api('POST','/api/scores/bulk',{items});
      scores = await getJSON('/api/scores');
      drawExam(); hideModal();
    };
  }
  function editScore(id){
    const s=scores.find(x=>x.id==id); if(!s) return;
    openModal(`<button class="close-x" id="sClose">×</button><div class="modal-title">✏️ 修改成绩</div>
      <div class="m-field"><label>学生</label><select id="s_student_id">${students.map(x=>'<option value="'+x.id+'" '+(x.id==s.student_id?'selected':'')+'>'+esc(x.name)+'</option>').join('')}</select></div>
      <div class="m-field"><label>考试</label><select id="s_exam_name">${exams.map(e=>'<option value="'+esc(e.name)+'" '+(e.name==s.exam_name?'selected':'')+'>'+esc(e.name)+'</option>').join('')}</select></div>
      <div class="m-field"><label>科目</label><input id="s_subject" value="${esc(s.subject)}"></div>
      <div class="m-field"><label>分数</label><input id="s_score" type="number" value="${esc(s.score)}"></div>
      <div class="m-field"><label>日期</label><input id="s_date" type="date" value="${esc(s.date)}"></div>
      <div class="btn-row"><button class="btn ghost" id="sCancel">取消</button><button class="btn" id="sSave">保存</button></div>`);
    $('#sClose').onclick=hideModal; $('#sCancel').onclick=hideModal;
    $('#sSave').onclick=async()=>{
      if(!(await confirmDialog('确定保存本次成绩修改？'))) return;
      const body={student_id:+$('#s_student_id').value, exam_name:$('#s_exam_name').value, subject:$('#s_subject').value, score:+$('#s_score').value, date:$('#s_date').value};
      const upd=await api('PATCH','/api/scores/'+id, body);
      const i=scores.findIndex(x=>x.id==id); if(i>-1) scores[i]=Object.assign(scores[i],upd);
      drawExam(); hideModal();
    };
  }
  function openExamModal(isEdit){
    if(!isEdit){ openAddExamModal(); return; }
    const ex = exams.find(e=>e.name===cur); if(!ex) return;
    openModal(`<button class="close-x" id="eClose">×</button><div class="modal-title">✏️ 修改考试</div>
      <div class="m-field"><label>考试名称</label><input id="xe_name" value="${esc(ex.name)}" placeholder="如：第一单元测试"></div>
      <div class="m-field"><label>考试日期</label><input id="xe_date" type="date" value="${esc(ex.date||'')}"></div>
      <div class="m-field"><label>备注</label><input id="xe_note" value="${esc(ex.note||'')}" placeholder="如：第一单元 字词与课文理解"></div>
      <div style="font-size:12px;color:var(--muted);margin:4px 0 8px">改名后，该考试下所有学生成绩将自动跟随新名称。</div>
      <div class="btn-row"><button class="btn ghost" id="xeCancel">取消</button><button class="btn" id="xeSave">保存</button></div>`);
    $('#eClose').onclick=hideModal; $('#xeCancel').onclick=hideModal;
    $('#xeSave').onclick=async()=>{
      const body={name:$('#xe_name').value.trim(), date:$('#xe_date').value, note:$('#xe_note').value.trim()};
      if(!body.name){ alert('请填写考试名称'); return; }
      await api('PATCH','/api/exams/'+ex.id, body);
      scores = await getJSON('/api/scores');
      const fresh = await getJSON('/api/exams');
      exams.length=0; fresh.forEach(e=>exams.push(e));
      refreshSelects();
      cur = body.name; $('#examSel').value=cur; drawExam(); hideModal();
    };
  }
  function openAddExamModal(){
    openModal(`<button class="close-x" id="eClose">×</button><div class="modal-title">＋ 添加考试</div>
      <div class="m-field"><label>考试名称</label><input id="xe_name" placeholder="如：第三单元测试"></div>
      <div class="m-field"><label>考试日期</label><input id="xe_date" type="date"></div>
      <div class="m-field"><label>科目</label><input id="xe_subject" value="语文"></div>
      <div class="m-field"><label>备注</label><input id="xe_note" placeholder="如：第三单元 字词与课文理解"></div>
      <div class="m-field"><label>参加学生</label>
        <select id="xe_mode"><option value="all">全部学生（${students.length}人）</option><option value="group">按小组</option><option value="manual">手动勾选</option></select></div>
      <div id="xe_groupBox" hidden><div class="m-field"><label>小组</label><div>${groups.map(g=>'<label style="margin-right:10px;white-space:nowrap"><input type="checkbox" class="xe-grp" value="'+esc(g)+'"> '+esc(g)+'</label>').join('')}</div></div></div>
      <div id="xe_manualBox" hidden style="max-height:240px;overflow:auto"><div class="m-field"><label>学生（${students.length}人）</label><div>${students.map(s=>'<label style="display:block"><input type="checkbox" class="xe-stu" value="'+s.id+'"> '+esc(s.name)+'（'+esc(s.group_name||'')+'）</label>').join('')}</div></div></div>
      <div class="btn-row"><button class="btn ghost" id="xeCancel">取消</button><button class="btn" id="xeSave">创建考试</button></div>`);
    $('#eClose').onclick=hideModal; $('#xeCancel').onclick=hideModal;
    const modeSel=$('#xe_mode');
    const sync=()=>{ $('#xe_groupBox').hidden = modeSel.value!=='group'; $('#xe_manualBox').hidden = modeSel.value!=='manual'; };
    modeSel.onchange=sync; sync();
    $('#xeSave').onclick=async()=>{
      const name=$('#xe_name').value.trim(); const date=$('#xe_date').value; const subject=$('#xe_subject').value.trim()||'语文'; const note=$('#xe_note').value.trim();
      if(!name){ alert('请填写考试名称'); return; }
      let ids=[];
      if(modeSel.value==='all') ids = students.map(s=>s.id);
      else if(modeSel.value==='group'){ const gs=[...document.querySelectorAll('.xe-grp')].filter(c=>c.checked).map(c=>c.value); if(!gs.length){ alert('请至少选择一个小组'); return; } ids = students.filter(s=>gs.includes(s.group_name)).map(s=>s.id); }
      else { ids = [...document.querySelectorAll('.xe-stu')].filter(c=>c.checked).map(c=>+c.value); if(!ids.length){ alert('请至少勾选一名学生'); return; } }
      await api('POST','/api/exams', {name, date, note});
      const items = ids.map(sid=>({student_id:sid, exam_name:name, subject, score:null, date}));
      if(items.length) await api('POST','/api/scores/bulk',{items});
      const fresh = await getJSON('/api/exams');
      exams.length=0; fresh.forEach(e=>exams.push(e));
      scores = await getJSON('/api/scores');
      refreshSelects();
      cur = name; $('#examSel').value=cur; drawExam(); hideModal();
    };
  }
  $('#examSel').onchange=()=>{ cur=$('#examSel').value; drawExam(); };
  $('#addExamBtn').onclick=()=> openExamModal(false);
  $('#editExamBtn').onclick=()=>{ if(!cur){ alert('请先选择一场考试'); return; } openExamModal(true); };
  $('#delExamBtn').onclick=async()=>{
    if(!cur){ alert('请先选择一场考试'); return; }
    if(!(await confirmDialog('确定删除考试「'+cur+'」？该考试下所有成绩也将一并删除，不可恢复。'))) return;
    const ex = exams.find(e=>e.name===cur); if(!ex) return;
    await api('DELETE','/api/exams/'+ex.id);
    scores = await getJSON('/api/scores');
    const idx = exams.findIndex(e=>e.id===ex.id); if(idx>-1) exams.splice(idx,1);
    cur = exams[0] ? exams[0].name : '';
    refreshSelects(); $('#examSel').value=cur; drawExam();
  };
  drawExam();
}

// ---------- Communications (auto-linked, confirm delete) ----------
const CFG_STUDENT = {
  communications:{ title:'家校沟通', table:'communications', cols:[['student','学生'],['date','日期'],['channel','方式'],['summary','内容'],['parent_reply','反馈']],
    fields:[['student_id','学生','student'],['date','日期','date'],['channel','方式','select:微信,电话,面谈'],['summary','内容','text'],['parent_reply','反馈','text']] }
};
async function renderStudentPage(route){
  const cfg = CFG_STUDENT[route]; const table=cfg.table;
  const [rows, students] = await Promise.all([getJSON('/api/'+table), getJSON('/api/students')]);
  const smap = {}; students.forEach(s=> smap[s.id]=s.name);
  content.innerHTML = `<div class="page-title">${cfg.title}</div>
    <div class="card"><div style="font-weight:600;margin-bottom:6px">添加新条目</div>
      <div class="form-row" id="addForm">${cfg.fields.map(f=>fieldHTMLStudent(f,students)).join('')}
        <button class="btn" id="addBtn">添加</button></div>
      <div style="font-size:12px;color:var(--muted)">📌 学生名单自动同步自「学生管理」，新增学生将自动出现在此处。</div></div>
    <div class="section"><table><thead><tr>${cfg.cols.map(c=>'<th>'+c[1]+'</th>').join('')}<th></th></tr></thead>
      <tbody id="tbody"></tbody></table></div>`;
  const tbody=$('#tbody');
  function draw(){ tbody.innerHTML = rows.map(r=>{
    const cells = cfg.cols.map(c=> c[0]==='student'? '<td><span class="name-link" data-std="'+(r.student_id||'')+'">'+esc(smap[r.student_id]||'-')+'</span></td>' : '<td>'+esc(r[c[0]])+'</td>').join('');
    return '<tr>'+cells+'<td><button class="del" data-del="'+r.id+'">删除</button></td></tr>';
  }).join('');
    tbody.querySelectorAll('[data-del]').forEach(b=> b.onclick=async()=>{
      if(await confirmDialog('确定删除这条沟通记录？')){ await api('DELETE','/api/'+table+'/'+b.dataset.del); rows=rows.filter(r=>r.id!=b.dataset.del); draw(); }
    });
    tbody.querySelectorAll('[data-std]').forEach(b=> b.onclick=()=>{ if(b.dataset.std) openStudentDetail(+b.dataset.std); });
  }
  draw();
  $('#addBtn').onclick=async()=>{ const body={}; cfg.fields.forEach(f=>{ const el=document.getElementById('f_'+f[0]); body[f[0]]= el.value; });
    const created=await api('POST','/api/'+table, body); rows.unshift(created); draw(); cfg.fields.forEach(f=>document.getElementById('f_'+f[0]).value=''); };
}
function fieldHTMLStudent(f, students){
  const [key,label,type]=f;
  if(type==='student'){ const opts=students.map(s=>'<option value="'+s.id+'">'+esc(s.name)+'</option>').join(''); return '<div><label style="display:block;font-size:12px;color:var(--muted)">'+label+'</label><select id="f_'+key+'">'+opts+'</select></div>'; }
  return fieldHTML(f);
}

// ---------- Todos (edit + confirm delete + restore) ----------
async function renderTodos(){
  let todos = (await getJSON('/api/todos')).slice().reverse();
  content.innerHTML=`<div class="page-title">待办事项</div>
    <div class="card"><div style="font-weight:600;margin-bottom:6px">添加待办</div>
      <div class="form-row" id="addForm">
        <div><label style="display:block;font-size:12px;color:var(--muted)">标题</label><input id="f_title" type="text" placeholder="待办内容"></div>
        <div><label style="display:block;font-size:12px;color:var(--muted)">截止</label><input id="f_due_date" type="date"></div>
        <div><label style="display:block;font-size:12px;color:var(--muted)">优先级</label><select id="f_priority">${['高','中','低'].map(o=>'<option>'+o+'</option>').join('')}</select></div>
        <button class="btn" id="addBtn">添加</button>
      </div></div>
    <div class="section"><table><thead><tr><th>标题</th><th>截止</th><th>优先级</th><th>状态</th><th>操作</th></tr></thead><tbody id="tbody"></tbody></table></div>`;
  const tbody=$('#tbody');
  function draw(){ tbody.innerHTML=todos.map(r=>`<tr>
    <td style="${r.done?'text-decoration:line-through;color:var(--muted)':''}">${esc(r.title)}</td>
    <td>${esc(r.due_date)}</td><td>${statusTag(r.priority)}</td>
    <td>${r.done? tag('已完成','blue'):tag('未完成','amber')}</td>
    <td><button class="btn ghost sm" data-toggle="${r.id}">${r.done?'↺ 恢复':'✓ 完成'}</button>
        <button class="btn ghost sm" data-edit="${r.id}">修改</button>
        <button class="del" data-del="${r.id}">删除</button></td></tr>`).join('');
    tbody.querySelectorAll('[data-toggle]').forEach(b=> b.onclick=async()=>{ const r=todos.find(x=>x.id==b.dataset.toggle); await api('PATCH','/api/todos/'+r.id,{done:r.done?0:1}); r.done=r.done?0:1; draw(); });
    tbody.querySelectorAll('[data-edit]').forEach(b=> b.onclick=()=> editTodo(+b.dataset.edit));
    tbody.querySelectorAll('[data-del]').forEach(b=> b.onclick=async()=>{ if(await confirmDialog('确定删除该待办？')){ await api('DELETE','/api/todos/'+b.dataset.del); todos=todos.filter(x=>x.id!=b.dataset.del); draw(); } });
  }
  function editTodo(id){ const t=todos.find(x=>x.id==id); if(!t) return;
    openModal(`<button class="close-x" id="tClose">×</button><div class="modal-title">✏️ 修改待办</div>
      <div class="m-field"><label>标题</label><input id="t_title" value="${esc(t.title)}"></div>
      <div class="m-field"><label>截止时间</label><input id="t_due_date" type="date" value="${esc(t.due_date)}"></div>
      <div class="m-field"><label>优先级</label><select id="t_priority">${['高','中','低'].map(o=>`<option ${o===t.priority?'selected':''}>${o}</option>`).join('')}</select></div>
      <div class="m-field"><label>状态</label><select id="t_done">${['0','1'].map(v=>`<option value="${v}" ${((t.done?1:0)==v)?'selected':''}>${(v==='1')?'已完成':'未完成'}</option>`).join('')}</select></div>
      <div class="btn-row"><button class="btn ghost" id="tCancel">取消</button><button class="btn" id="tSave">保存</button></div>`);
    $('#tClose').onclick=hideModal; $('#tCancel').onclick=hideModal;
    $('#tSave').onclick=async()=>{
      const body={title:$('#t_title').value, due_date:$('#t_due_date').value, priority:$('#t_priority').value, done:+$('#t_done').value};
      const upd=await api('PATCH','/api/todos/'+id, body); const i=todos.findIndex(x=>x.id==id); if(i>-1) todos[i]=Object.assign(todos[i],upd);
      hideModal(); draw();
    };
  }
  draw();
  $('#addBtn').onclick=async()=>{ const body={title:$('#f_title').value, due_date:$('#f_due_date').value, priority:$('#f_priority').value};
    if(!body.title){ alert('请填写标题'); return; }
    const c=await api('POST','/api/todos', body); todos.unshift(c); draw(); $('#f_title').value=''; $('#f_due_date').value=''; };
}

// ---------- Timetable (week picker + editable dates + interactive cells) ----------
function parseDate(s){ const [y,m,d]=String(s).split('-').map(Number); return new Date(y, m-1, d); }
function mondayOf(dateStr){ const d=parseDate(dateStr); const dow=(d.getDay()+6)%7; d.setDate(d.getDate()-dow); return d; }
function todayMondayStr(){ const n=new Date(); const dow=(n.getDay()+6)%7; const m=new Date(n); m.setDate(n.getDate()-dow); const p=x=>String(x).padStart(2,'0'); return m.getFullYear()+'-'+p(m.getMonth()+1)+'-'+p(m.getDate()); }
function currentWeek(ts){ if(!ts) return 1; const t=mondayOf(todayMondayStr()), s=mondayOf(ts); const diff=Math.round((t-s)/86400000); return Math.max(1, Math.floor(diff/7)+1); }
function dayDatesFor(termStart, wk){
  const base=mondayOf(termStart); const monday=new Date(base); monday.setDate(base.getDate()+(wk-1)*7);
  const dd={}; ['周一','周二','周三','周四','周五'].forEach((d,i)=>{ const x=new Date(monday); x.setDate(monday.getDate()+i); dd[d]=(x.getMonth()+1)+'/'+x.getDate(); });
  return dd;
}
async function renderTimetable(){
  let rows = await getJSON('/api/timetable');
  const settings = await getJSON('/api/settings');
  let termStart = settings.term_start || todayMondayStr();
  let week = currentWeek(termStart);
  let dayDates = dayDatesFor(termStart, week);
  content.innerHTML=`<div class="page-title">课程表</div>
    <div class="card">
      <div style="font-weight:600;margin-bottom:8px">📅 周次与日期</div>
      <div class="form-row">
        <div><label style="display:block;font-size:12px;color:var(--muted)">当前周次</label>
          <div style="display:flex;align-items:center;gap:8px">
            <button class="btn ghost sm" id="wkPrev">‹</button>
            <span id="wkLabel" style="min-width:64px;text-align:center;font-weight:600">第 ${week} 周</span>
            <button class="btn ghost sm" id="wkNext">›</button>
          </div></div>
        <div><label style="display:block;font-size:12px;color:var(--muted)">学期第1周 · 周一</label><input id="termStart" type="date" value="${termStart}"></div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">💡 修改「学期第1周 周一」可整体平移所有日期；用 ‹ › 切换查看不同周次（课程每周重复，修改任一周均作用于该日次）。</div>
    </div>
    <div class="filter-bar" id="ttFilter"><span style="font-size:13px;color:var(--muted)">按星期筛选：</span>
      <span class="chip active" data-d="all">全部</span>${['周一','周二','周三','周四','周五'].map(d=>'<span class="chip" data-d="'+d+'">'+d+'</span>').join('')}</div>
    <div style="font-size:12px;color:var(--muted);margin:4px 0 10px">💡 点击任意格子可「修改 / 删除」该节课程；节次不限于第六节，可自由增加。</div>
    <div class="section"><div class="tt-grid" id="ttFull"></div></div>`;
  let flt='all';
  function draw(){ const list = flt==='all'? rows : rows.filter(r=>r.day===flt); renderTimetableFull(list, dayDates);
    $('#ttFull').querySelectorAll('.tt-subj-cell').forEach(c=> c.onclick=()=> openCell(c.dataset.day, +c.dataset.period)); }
  function openCell(day, period){
    const r=rows.find(x=>x.day===day && x.period===period); const exists=!!r;
    openModal(`<button class="close-x" id="cClose">×</button><div class="modal-title">${exists?'✏️ 修改课程':'➕ 添加课程'}（${esc(day)} 第${period}节）</div>
      <div class="m-field"><label>科目</label><input id="c_subject" value="${exists?esc(r.subject):''}" placeholder="语文"></div>
      <div class="m-field"><label>时间（如 08:30-09:10）</label><input id="c_time" value="${exists?esc(r.time||''):''}"></div>
      <div class="m-field"><label>备注</label><input id="c_note" value="${exists?esc(r.note||''):''}"></div>
      <div class="btn-row"><button class="btn ghost" id="cCancel">取消</button>${exists?'<button class="btn" id="cDelete" style="background:#A32D2D">删除</button>':''}<button class="btn" id="cSave">${exists?'保存':'添加'}</button></div>`);
    $('#cClose').onclick=hideModal; $('#cCancel').onclick=hideModal;
    if(exists){ $('#cDelete').onclick=async()=>{ if(await confirmDialog('确定删除该节课程？')){ await api('DELETE','/api/timetable/'+r.id); rows=rows.filter(x=>x.id!=r.id); hideModal(); draw(); } }; }
    $('#cSave').onclick=async()=>{
      const body={day, period, subject:$('#c_subject').value, time:$('#c_time').value||'', note:$('#c_note').value||''};
      if(exists){ const upd=await api('PATCH','/api/timetable/'+r.id, body); const i=rows.findIndex(x=>x.id==r.id); if(i>-1) rows[i]=Object.assign(rows[i],upd); }
      else { const c=await api('POST','/api/timetable', body); rows.push(c); }
      hideModal(); draw();
    };
  }
  function recompute(){ dayDates=dayDatesFor(termStart, week); $('#wkLabel').textContent='第 '+week+' 周'; draw(); }
  $('#wkPrev').onclick=()=>{ week=Math.max(1, week-1); recompute(); };
  $('#wkNext').onclick=()=>{ week++; recompute(); };
  $('#termStart').onchange=async()=>{ termStart=$('#termStart').value; if(termStart){ await api('POST','/api/settings',{term_start:termStart}); week=currentWeek(termStart); recompute(); } };
  $('#ttFilter').querySelectorAll('.chip').forEach(c=> c.onclick=()=>{ $('#ttFilter').querySelectorAll('.chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); flt=c.dataset.d; draw(); });
  draw();
}
function renderTimetableFull(rows, dayDates){
  const days=['周一','周二','周三','周四','周五'];
  const maxP=Math.max(6, ...rows.map(r=>r.period));
  let h='<div class="tt-cell head">节</div>'+days.map(d=>'<div class="tt-cell head"><div>'+d+'</div><div class="tt-date">'+(dayDates[d]||'')+'</div></div>').join('');
  const map={}; rows.forEach(r=>{ (map[r.day]=map[r.day]||{})[r.period]=r; });
  for(let p=1;p<=maxP;p++){
    h+='<div class="tt-cell head">第'+p+'节</div>';
    days.forEach(d=>{ const c=map[d]&&map[d][p];
      h+='<div class="tt-cell subj tt-subj-cell" data-day="'+d+'" data-period="'+p+'">'+(c? esc(c.subject)+'<div class="tt-time">'+(c.time||'')+'</div>'+(c.note?'<div class="tt-time">'+esc(c.note)+'</div>':'') :'＋ 点击添加')+'</div>'; });
  }
  $('#ttFull').innerHTML=h;
}

// ---------- AI assistant (minimize + close) ----------
function initAI(){
  const fab=$('#aiFab'), panel=$('#aiPanel'), close=$('#aiClose'), min=$('#aiMin'), send=$('#aiSend'), text=$('#aiText'), msgs=$('#aiMsgs');
  const history=[];
  function show(){ panel.hidden=false; fab.style.display='none'; localStorage.setItem('sw_ai_open','1'); text.focus(); }
  function hide(){ panel.hidden=true; fab.style.display='block'; localStorage.setItem('sw_ai_open','0'); }
  if(localStorage.getItem('sw_ai_open')==='1') show(); else hide();
  fab.onclick=()=> show();
  close.onclick=()=> hide();
  min.onclick=()=> hide();
  function push(role, txt){ const d=document.createElement('div'); d.className='msg '+(role==='user'?'user':'bot'); d.textContent=txt; msgs.appendChild(d); msgs.scrollTop=msgs.scrollHeight; }
  send.onclick=async()=>{ const m=text.value.trim(); if(!m) return; push('user',m); text.value=''; history.push({role:'user',content:m}); push('bot','小文正在思考…');
    try{ const r=await api('POST','/api/ai',{message:m, history}); const last=msgs.querySelector('.bot:last-child'); last.textContent=r.reply; history.push({role:'assistant',content:r.reply}); }
    catch(e){ msgs.querySelector('.bot:last-child').textContent='抱歉，连接失败了，请稍后再试。'; }
  };
  text.addEventListener('keydown', e=>{ if(e.key==='Enter') send.onclick(); });
}

// ---------- Login gate ----------
const AUTH_USER='pengyu';
const AUTH_PASS='Pengyu20001005';
function getCreds(){
  let u=localStorage.getItem('sw_user'), p=localStorage.getItem('sw_pass');
  if(u==null){ u=AUTH_USER; localStorage.setItem('sw_user',u); }
  if(p==null){ p=AUTH_PASS; localStorage.setItem('sw_pass',p); }
  return {user:u, pass:p};
}
getCreds(); // 首次以默认值初始化账号，之后以 localStorage 中修改后的值为准
function isAuthed(){ return !!(localStorage.getItem('sw_auth')||sessionStorage.getItem('sw_auth')); }
function showLogin(){
  const mask=$('#loginMask'); mask.hidden=false;
  const err=$('#loginErr'); const u=$('#loginUser'); const p=$('#loginPass'); const btn=$('#loginBtn'); const rm=$('#rememberMe');
  err.textContent=''; u.focus();
  function tryLogin(){
    const c=getCreds();
    if(u.value.trim()===c.user && p.value===c.pass){
      (rm.checked?localStorage:sessionStorage).setItem('sw_auth','1');
      mask.hidden=true; boot();
    } else { err.textContent='用户名或密码错误，请重试。'; p.value=''; p.focus(); }
  }
  btn.onclick=tryLogin;
  p.addEventListener('keydown', e=>{ if(e.key==='Enter') tryLogin(); });
  u.addEventListener('keydown', e=>{ if(e.key==='Enter'){ p.focus(); } });
}
function boot(){
  initProfile(); initTopDate(); initAI(); start();
}
if(isAuthed()){ boot(); } else { showLogin(); }
