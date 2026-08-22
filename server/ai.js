// ai.js - Floating AI assistant proxy (calls LLM if configured, else heuristic fallback)
const SYSTEM_PROMPT = `你是"小文"，一位贴心的小学语文教师工作台 AI 助手。你帮助老师写家长消息、设计教案、出练习题、润色评语、安排班务。回答简洁、温暖、实用，使用中文。`;

function heuristic(message) {
  const m = (message || '').trim();
  if (!m) return '你好，我是你的 AI 小助手小文～ 可以帮你写家长消息、设计教案、出练习题、整理班务。想先试试什么？';
  if (/(家长|微信|沟通|回复)/.test(m)) {
    return '【家长消息参考】\n家长您好，我是孩子的语文老师。最近孩子在课堂上（进步/情况）……想和您同步一下，也欢迎您反馈孩子在家的情况，我们一起帮助孩子成长。\n——你可按实际情况把括号里的内容替换掉哦。';
  }
  if (/(教案|教学设计|课件)/.test(m)) {
    return '【教案简框架】\n1. 课题与目标：明确本课要掌握的生字、词句与情感目标。\n2. 导入：用图片/故事/提问激发兴趣。\n3. 新授：范读—品词—感悟—朗读。\n4. 练习：抄写、造句或小练笔。\n5. 小结与作业。\n把课题发我，我帮你细化。';
  }
  if (/(题|练习|测试|作业)/.test(m)) {
    return '【出题意向】\n可以出：①看拼音写词语 ②形近字组词 ③按课文填空 ④阅读理解小题 ⑤小练笔。\n告诉我年级和课文，我直接给你一份题。';
  }
  if (/(评语|鼓励|表扬)/.test(m)) {
    return '【评语参考】\n你是个爱思考的孩子，课堂上那双亮晶晶的眼睛总让我欢喜。继续多读多写，你会越来越棒！';
  }
  if (/(班务|班主任|班级|安排)/.test(m)) {
    return '【班务小贴士】\n- 用"小组制"培养责任感，6人一组轮流值日。\n- 每周一次班会做小结与表彰。\n- 重要事项发通知并置顶，家长群同步。';
  }
  return '收到～我是小文，可以帮你：写家长消息、设计教案、出练习题、写评语、理班务。把具体需求发我，我马上帮你做。';
}

async function chat(message, history = []) {
  const key = process.env.LLM_API_KEY;
  const base = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
  if (!key) return { reply: heuristic(message), mode: 'heuristic' };
  try {
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }]
      .concat((history || []).map(h => ({ role: h.role, content: h.content })))
      .concat([{ role: 'user', content: message }]);
    const resp = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ model: process.env.LLM_MODEL || 'gpt-4o-mini', messages, temperature: 0.7 })
    });
    const data = await resp.json();
    const reply = data.choices && data.choices[0] && data.choices[0].message.content;
    return { reply: reply || heuristic(message), mode: 'llm' };
  } catch (e) {
    return { reply: heuristic(message), mode: 'heuristic-fallback' };
  }
}

module.exports = { chat };
