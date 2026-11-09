const sessions = new Map();
const utterances = [
  '안녕하세요. 수사기관 담당자입니다. 고객님 명의의 계좌와 관련해 확인할 사항이 있습니다.',
  '계좌를 보호해야 합니다. 통화를 끊지 말고 제 안내를 들어주세요.',
  '조사가 끝날 때까지만 안전계좌로 돈을 옮겨주시겠습니까?',
  '지금 처리하지 않으면 계좌 사용이 제한될 수 있습니다. 그래도 거절하시겠습니까?',
];
const wait = () => new Promise(resolve => setTimeout(resolve, 300));
const turn = (turnNo, text, endReason = null) => ({ turnNo, speaker: 'C', text, ended: !!endReason, endReason });
const fail = (code, message) => Object.assign(new Error(message), { code });

async function mock(method, path, body) {
  await wait();
  if (path === '/api/sessions' && method === 'POST') {
    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, { turns: [], firstTurn: turn(1, utterances[0]) });
    return { sessionId, timeLimitSec: 600, firstTurn: sessions.get(sessionId).firstTurn };
  }
  const [, id, action] = /^\/api\/sessions\/([^/]+)\/(\w+)$/.exec(path) ?? [];
  const session = sessions.get(id);
  if (!session) throw fail('SESSION_NOT_FOUND', '세션을 찾을 수 없습니다.');
  if (action === 'start') {
    session.startedAt ??= new Date().toISOString();
    session.deadlineAt ??= new Date(Date.parse(session.startedAt) + 600_000).toISOString();
    return { startedAt: session.startedAt, deadlineAt: session.deadlineAt };
  }
  if (!session.startedAt) throw fail('SESSION_NOT_STARTED', '통화를 먼저 시작해 주세요.');
  if (action === 'end') {
    session.endReason ??= body.reason;
    return { ended: true };
  }
  if (action === 'turns') {
    if (session.endReason) throw fail('SESSION_ENDED', '이미 끝난 통화입니다.');
    if (Date.now() >= Date.parse(session.deadlineAt) && !body.isFinal) {
      session.endReason = 'TIMEOUT';
      throw fail('SESSION_ENDED', '통화 시간이 종료됐습니다.');
    }
    const no = session.turns.length + 1;
    const text = body.userText;
    const verify = /대표\s*번호|공식|직접\s*확인/.test(text);
    const refuse = /안\s*(할|해|보내)|못\s*(해|보내)|거절|끊을|않겠|않을|사기/.test(text);
    const agreed = !refuse && no >= 3 && /송금할|보낼게|보내겠|이체할|동의/.test(text);
    const repeated = (verify || refuse) && session.turns.some(entry => entry.verify || entry.refuse);
    session.turns.push({ no, text, verify, refuse, agreed });
    session.endReason = agreed ? 'SCAMMED' : repeated ? 'DETECTED' : body.isFinal ? 'TIMEOUT' : null;
    const next = { SCAMMED: '알겠습니다. 통화를 종료하겠습니다.', DETECTED: '알겠습니다. 통화를 마치겠습니다.', TIMEOUT: '통화 시간이 종료되었습니다.' };
    return turn(no + 1, next[session.endReason] ?? utterances[Math.min(no, 3)], session.endReason);
  }
  if (action !== 'report' || !session.endReason) throw fail('SESSION_NOT_ENDED', '통화를 먼저 종료해 주세요.');
  const bad = session.turns.find(entry => entry.agreed);
  const verified = session.turns.find(entry => entry.verify);
  const refused = session.turns.find(entry => entry.refuse);
  const points = (verified ? 40 : 0) + (refused ? 60 : 0);
  const moment = (entry, why) => ({ turn: entry.no, quote: entry.text, why });
  return {
    score: bad ? Math.min(49, Math.round(points * 0.49)) : 50 + points * 0.4,
    result: bad ? 'SCAMMED' : 'SAFE',
    summary: '수사기관을 사칭해 계좌 보호를 이유로 송금을 요구한 모의 통화입니다.',
    scammedTurn: bad?.no ?? null,
    scammedAction: bad ? '안전계좌 송금에 동의' : null,
    checkpoints: [
      { id: 'VERIFY_OFFICIAL', achieved: !!verified, turn: verified?.no ?? null },
      { id: 'REFUSE_TRANSFER', achieved: !!refused, turn: refused?.no ?? null },
    ],
    riskyMoments: bad ? [moment(bad, '공식 확인 전에 송금에 동의했어요.')] : [],
    goodMoments: [verified && moment(verified, '공식 경로로 다시 확인하려 했어요.'), refused && moment(refused, '송금 요구를 거절했어요.')].filter(Boolean),
    realWorldTips: ['통화에서 안내받은 번호 대신 기관 대표번호를 직접 찾아 확인하세요.'],
    relatedScamTypes: ['LOAN', 'FAMILY_CHILD'],
  };
}

export const mockEnabled = import.meta.env?.VITE_USE_MOCK !== 'false';

export async function request(method, path, body) {
  if (mockEnabled) return mock(method, path, body);
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw fail(error.code, error.message ?? '서버 요청에 실패했습니다.');
  }
  return response.json();
}
