import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { mockEnabled, request } from './api.js';
import { useVoice } from './voice.js';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@fontsource/black-han-sans/400.css';
import '@fontsource-variable/noto-serif-kr';
import './style.css';

const notice = '연습에서는 주민번호, 계좌번호, 카드번호, 비밀번호 등 실제 개인정보를 말하지 마세요.';
const types = { INSTITUTION: '기관 사칭', LOAN: '대출 빙자', FAMILY_CHILD: '자녀 사칭', FAMILY_KIDNAP: '자녀 납치 빙자', FAMILY_SPOUSE: '배우자 사고 빙자', NOSHOW_PROXY_PURCHASE: '노쇼·대리구매' };
const states = { speaking: '상대방이 말하는 중', ready: '내 차례', recording: '음성 인식 중', review: '인식된 답변 확인', waiting: '상대방의 답변을 기다리는 중' };
const callHints = {
  speaking: '상대방의 말이 끝나면 답할 수 있어요.',
  ready: '마이크로 말하거나 텍스트로 답할 수 있어요.',
  recording: '말을 마치면 녹음 완료를 눌러 주세요.',
  review: '내용을 확인하고 보내세요. 답변을 고칠 수도 있어요.',
  waiting: '답변을 보냈어요. 잠시만 기다려 주세요.',
};
const steps = ['안내', '프로필', '전화 수신', '통화', '리포트'];

function PhoneIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3H4.8A1.8 1.8 0 0 0 3 4.9 17.5 17.5 0 0 0 19.1 21a1.8 1.8 0 0 0 1.9-1.8V17l-5-2-1.5 2a13 13 0 0 1-7.5-7.5L9 8 7 3Z" /></svg>;
}

function CallPortrait({ self = false }) {
  return <figure className={'call-portrait ' + (self ? 'self' : 'suspect')}>
    <span className="call-portrait-image" aria-hidden="true" />
    <figcaption>{self ? '나' : '보이스피싱범'}</figcaption>
  </figure>;
}

function CallPreview() {
  return <div className="hero-art" aria-hidden="true">
    <div className="orbit orbit-outer" /><div className="orbit orbit-inner" />
    <div className="preview-phone">
      <span className="preview-island" />
      <div className="preview-caller">
        <div className="preview-avatar"><PhoneIcon /></div>
        <strong>알 수 없는 발신자</strong>
        <span className="preview-caption">수신 전화</span>
      </div>
      <div className="wave">{[12, 23, 17, 34, 45, 24, 39, 28, 42, 20, 30, 14, 21, 9].map((height, index) => <i key={index} style={{ height: (height / 45) * 100 + '%' }} />)}</div>
      <div className="preview-answer"><PhoneIcon /><span>받기</span></div>
      <span className="preview-home" />
    </div>
  </div>;
}

function Select({ label, options, ...props }) {
  return <label>{label}<select {...props}><option value="">선택해 주세요</option>{options.map(option => {
    const [value, text] = Array.isArray(option) ? option : [option, option];
    return <option key={value} value={value}>{text}</option>;
  })}</select></label>;
}

const genders = [['FEMALE', '여성'], ['MALE', '남성']];
function Profile({ onSubmit, onBack, busy, profile }) {
  const [children, setChildren] = useState(() => (profile?.children ?? []).map((_, index) => index));
  const nextChild = useRef(children.length);
  function submit(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const { ageGroup, gender, job, married, region } = fields;
    const profile = { ageGroup, gender, job };
    if (married) profile.married = married === 'yes';
    if (region.trim()) profile.region = region.trim();
    if (children.length) profile.children = children.map(id => ({ gender: fields['gender' + id], ageGroup: fields['age' + id] }));
    onSubmit(profile);
  }
  return <form onSubmit={submit}>
    <div className="grid">
      <Select label="연령대 *" name="ageGroup" defaultValue={profile?.ageGroup ?? ""} options={['10대', '20대', '30대', '40대', '50대', '60대', '70대 이상']} required />
      <Select label="성별 *" name="gender" defaultValue={profile?.gender ?? ""} options={genders} required />
      <Select label="직업 *" name="job" defaultValue={profile?.job ?? ""} options={['학생', '직장인', '자영업자', '주부', '무직·은퇴', '기타']} required />
      <Select label="기혼 여부" name="married" defaultValue={profile?.married === undefined ? "" : profile.married ? "yes" : "no"} options={[[ 'yes', '기혼' ], [ 'no', '미혼' ]]} />
      <label>거주 지역 <input name="region" defaultValue={profile?.region ?? ""} placeholder="예: 서울 마포구" maxLength={40} /></label>
    </div>
    {children.map((id, index) => <fieldset key={id}><legend>자녀 {index + 1}</legend><div className="grid">
      <Select label="성별" name={'gender' + id} defaultValue={profile?.children?.[id]?.gender ?? ""} options={genders} required />
      <Select label="연령대" name={'age' + id} defaultValue={profile?.children?.[id]?.ageGroup ?? ""} options={['미취학', '초등학생', '중고등학생', '성인']} required />
    </div><button type="button" className="quiet" onClick={() => setChildren(list => list.filter(child => child !== id))}>삭제</button></fieldset>)}
    <div className="actions profile-actions"><button className="text-button" type="button" onClick={onBack}>이전</button><button className="quiet" type="button" onClick={() => setChildren(list => [...list, nextChild.current++])}>+ 자녀 추가</button>
    <button disabled={busy}>{busy ? '전화 준비 중…' : '전화 준비하기'}</button></div>
  </form>;
}

function Report({ report, onReset }) {
  const bad = report.result === 'SCAMMED';
  const evidence = report.riskyMoments?.find(moment => moment.turn === report.scammedTurn);
  const moments = (title, list) => !!list?.length && <section><h3>{title}</h3>{list.map((moment, index) => <blockquote key={index}>“{moment.quote}”<small>{moment.why}</small></blockquote>)}</section>;
  return <>
    <div className={'score ' + (bad ? 'bad' : '')}><span>{bad ? '모의 사기에 당했어요' : '모의 사기에 당하지 않았어요'}</span><strong>{report.score}<small> / 100점</small></strong></div>
    <p>{report.summary}</p>
    {bad && <section><h3>{report.scammedTurn}번째 턴에서 당했어요</h3><p>{report.scammedAction}</p>{evidence && <blockquote>“{evidence.quote}”<small>{evidence.why}</small></blockquote>}</section>}
    {!bad && moments('이 부분은 위험했어요', report.riskyMoments)}
    {!bad && moments('이 부분은 잘 대처했어요', report.goodMoments)}
    {!!report.realWorldTips?.length && <section><h3>실제 통화에서 기억할 점</h3><ul>{report.realWorldTips.map(tip => <li key={tip}>{tip}</li>)}</ul></section>}
    {!!report.relatedScamTypes?.length && <section><h3>관련 사기 유형</h3><p>{report.relatedScamTypes.map(type => types[type] ?? type).join(' · ')}</p></section>}
    <button onClick={onReset}>처음으로</button>
  </>;
}

function App() {
  const voice = useVoice();
  const [page, setPage] = useState(0);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mode, setMode] = useState('ready');
  const [conversation, setConversation] = useState([]);
  const [draft, setDraft] = useState('');
  const [seconds, setSeconds] = useState(600);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(null);
  const [ringing, setRinging] = useState(false);
  const call = useRef({ ended: false });
  const ring = useRef(null);
  const transcript = useRef(null);
  const panel = useRef(null);
  const endpoint = action => '/api/sessions/' + session.sessionId + '/' + action;
  function showError(err, next) {
    setError(err.message);
    setRetry(next ? () => next : null);
  }
  function clearError() { setError(''); setRetry(null); }

  function stopRing() {
    ring.current?.();
    ring.current = null;
    setRinging(false);
  }

  function startRing() {
    if (ring.current || !window.AudioContext) return;
    const audio = new AudioContext();
    audio.resume().catch(() => {});
    function beep() {
      [0, 0.28].forEach(offset => {
        const wave = audio.createOscillator();
        const gain = audio.createGain();
        const start = audio.currentTime + offset;
        wave.frequency.value = 440;
        gain.gain.setValueAtTime(0.065, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        wave.connect(gain).connect(audio.destination);
        wave.start(start);
        wave.stop(start + 0.23);
      });
    }
    beep();
    const timer = setInterval(beep, 2200);
    ring.current = () => { clearInterval(timer); audio.close().catch(() => {}); };
    setRinging(true);
  }

  async function prepare(profile) {
    setProfile(profile);
    clearError();
    setBusy(true);
    setPage(2);
    startRing();
    try {
      setSession(await request('POST', '/api/sessions', profile));
    } catch (err) { stopRing(); showError(err, () => prepare(profile)); }
    finally { setBusy(false); }
  }

  async function loadReport() {
    clearError();
    setBusy(true);
    try { setReport(await request('GET', endpoint('report'))); }
    catch (err) { showError(err, loadReport); }
    finally { setBusy(false); }
  }

  async function finish(reason) {
    if (call.current.ended) return;
    call.current.ended = true;
    clearInterval(call.current.timer);
    voice.stopListening(true);
    voice.stopSpeaking();
    setPage(4);
    async function closeSession() {
      clearError();
      setBusy(true);
      try {
        if (reason) await request('POST', endpoint('end'), { reason });
      } catch (err) {
        showError(err, closeSession);
        setBusy(false);
        return;
      }
      await loadReport();
    }
    await closeSession();
  }

  function record() {
    clearError();
    setDraft('');
    setMode('recording');
    call.current.recording = true;
    voice.listen(text => {
      if (call.current.ended) return;
      call.current.recording = false;
      setDraft(text);
      setMode('review');
    }, message => {
      call.current.recording = false;
      setError(message);
      setMode('review');
    });
  }

  async function send(text, isFinal = false) {
    const state = call.current;
    if (!text.trim() || state.ended || state.pending) return;
    clearError();
    state.pending = true;
    setMode('waiting');
    try {
      const reply = await request('POST', endpoint('turns'), { userText: text.trim(), isFinal });
      if (state.ended) return;
      setConversation(list => [...list, { speaker: 'USER', text: text.trim() }, reply]);
      setDraft('');
      setMode('speaking');
      await voice.speak(reply.text, reply.speaker);
      if (state.ended) return;
      if (reply.ended || isFinal || state.expired) await finish(reply.ended ? null : 'TIMEOUT');
      else setMode('ready');
    } catch (err) {
      if (state.ended) return;
      if (err.code === 'SESSION_ENDED') return finish(null);
      if (state.expired) return finish('TIMEOUT');
      setMode('review');
      showError(err, () => send(text, isFinal));
    } finally { state.pending = false; }
  }

  async function expire() {
    const state = call.current;
    if (state.ended || state.expired) return;
    state.expired = true;
    clearInterval(state.timer);
    if (state.recording) {
      const text = await voice.stopListening();
      if (state.ended) return;
      if (text.trim()) return send(text, true);
    }
    if (!state.pending) await finish('TIMEOUT');
  }

  async function accept() {
    if (!session || call.current.pending || busy) return;
    const state = call.current;
    clearError();
    stopRing();
    setBusy(true);
    setPage(3);
    setMode('speaking');
    state.pending = true;
    setConversation([session.firstTurn]);
    voice.unlockAudio();
    const firstAudio = voice.speak(session.firstTurn.text, session.firstTurn.speaker);
    try {
      const start = await request('POST', endpoint('start'));
      state.started = true;
      if (state.hangupRequested) return finish('HANG_UP');
      const deadline = Date.parse(start.deadlineAt);
      if (!Number.isFinite(deadline)) throw new Error('서버의 통화 마감 시간을 읽을 수 없어요.');
      function tick() {
        const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        setSeconds(remaining);
        if (!remaining) expire();
      }
      state.timer = setInterval(tick, 250);
      tick();
      await firstAudio;
      if (!state.ended) {
        if (state.expired) await finish('TIMEOUT');
        else setMode('ready');
      }
    } catch (err) {
      voice.stopSpeaking();
      clearInterval(state.timer);
      setPage(2);
      showError(err, accept);
    } finally { state.pending = false; setBusy(false); }
  }

  function hangUp() {
    if (call.current.started) return finish('HANG_UP');
    call.current.hangupRequested = true;
    voice.stopSpeaking();
  }

  function reset() {
    stopRing();
    call.current = { ended: false };
    setSession(null);
    setProfile(null);
    setConversation([]);
    setDraft('');
    setReport(null);
    setSeconds(600);
    clearError();
    setPage(0);
  }

  function backToProfile() {
    stopRing();
    clearError();
    setSession(null);
    call.current = { ended: false };
    setPage(1);
  }

  useEffect(() => {
    if (page === 0) return;
    const heading = panel.current?.querySelector('h1');
    heading?.focus();
  }, [page]);

  useEffect(() => () => { clearInterval(call.current.timer); ring.current?.(); }, []);
  useEffect(() => {
    if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [conversation, voice.text, mode]);

  return <main className={page === 2 ? "receiving" : page === 3 ? "in-call" : undefined}>
    <header className="site-head">
      <div className="brand"><span className="brand-icon"><PhoneIcon /></span><span>안심콜</span></div>
      <span className="badge"><span className="status-dot" />{mockEnabled ? '모의 체험' : '서버 연결'}</span>
    </header>
    <nav aria-label="체험 단계" className="steps">{steps.map((name, i) => <span className={i === page ? 'current' : i < page ? 'complete' : ''} aria-current={i === page ? 'step' : undefined} key={name}><b>{i < page ? '✓' : i + 1}</b>{name}</span>)}</nav>
    <div className={page === 3 ? "call-scene" : "page-content"}>
    {page === 3 && <CallPortrait />}
    <article ref={panel} className={'panel page-' + page}>
      {page === 3 && <aside className="notice">{notice}</aside>}
      {page === 0 && <>
        <div className="hero">
          <div className="hero-copy">

            <h1>수상한 전화,<br />어떻게 <em>답할까?</em></h1>
            <p className="intro">모의 보이스피싱 전화에 직접 답해 보세요. 통화가 끝나면 내가 잘 대처한 순간과 놓친 신호를 알려드려요.</p>
            <aside className="notice"><strong>체험 전 확인</strong><span>{notice}</span></aside>
            <button className="hero-start" onClick={() => setPage(1)}>체험 시작 <span aria-hidden="true">→</span></button>

          </div>
          <CallPreview />
        </div>

      </>}
      {page === 1 && <><h1 tabIndex={-1}>연습용 프로필</h1><p>별표는 필수 항목이에요.</p><Profile profile={profile} onSubmit={prepare} onBack={() => setPage(0)} busy={busy} /></>}
      {page === 2 && <div className="incoming-stage">
        <div className="incoming">
          <span className="incoming-notch" aria-hidden="true" />
          <div className="caller">
            <div className="phone"><PhoneIcon /></div>
            <h1 tabIndex={-1}>알 수 없는 발신자</h1>
            <p role="status">{session ? '수신 전화' : busy ? '전화 연결 중…' : '전화를 준비하지 못했어요.'}</p>
          </div>
          <div className="incoming-controls">
            <button className="ringer" aria-pressed={!ringing} onClick={ringing ? stopRing : startRing}>{ringing ? '무음으로 전환' : '벨소리 켜기'}</button>
            <div className="call-options">
              <button className="call-choice decline" disabled={busy} onClick={backToProfile}><span><PhoneIcon /></span>거절</button>
              <button className="call-choice accept" disabled={!session || busy} onClick={accept}><span><PhoneIcon /></span>받기</button>
            </div>
          </div>
          <span className="incoming-home" aria-hidden="true" />
        </div>
      </div>}
      {page === 3 && <><div className="call-head"><div><h1 tabIndex={-1}>모의 통화</h1></div><span className="timer">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span></div>
      <div className="call-guide"><p className={`call-status ${mode}`} role="status"><span className="status-dot" />{states[mode]}</p><p className="call-hint">{callHints[mode]}</p></div>
      <div className="transcript" ref={transcript} role="log" aria-label="통화 자막">{conversation.map((entry, i) => <div className={'bubble ' + (entry.speaker === 'USER' ? 'mine' : '')} key={i}><small>{entry.speaker === 'USER' ? '나' : entry.speaker === 'B' ? '연결된 상대' : '상대방'}</small>{entry.text}</div>)}{mode === 'recording' && <div className="bubble mine">{voice.text || '듣고 있어요…'}</div>}</div>
      {!voice.supported && <p className="hint">음성 인식은 Chrome에서 열어 주세요. 아래에서 텍스트로 답할 수 있어요.</p>}
      {mode === 'review' && <label>내 답변<textarea placeholder="예: 제가 공식 번호를 찾아 다시 전화할게요." value={draft} onChange={event => setDraft(event.target.value)} rows={3} maxLength={2000} /></label>}
      <div className="actions call-actions">
        {mode === 'ready' && <>{voice.supported && <button onClick={record}>마이크 켜기</button>}<button className="quiet" onClick={() => { clearError(); setDraft(''); setMode('review'); }}>텍스트로 답하기</button></>}
        {mode === 'recording' && <button onClick={() => voice.stopListening()}>녹음 완료</button>}
        {mode === 'review' && <>{voice.supported && <button className="quiet" onClick={record}>다시 말하기</button>}<button disabled={!draft.trim() || !!retry} onClick={() => send(draft)}>보내기</button></>}
        <button className="danger" onClick={hangUp}>통화 끊기</button>
      </div></>}
      {page === 4 && <><h1 tabIndex={-1}>대응 리포트</h1>{report ? <Report report={report} onReset={reset} /> : busy ? <div className="report-loading" role="status"><span className="spinner" aria-hidden="true" /><div><strong>대화를 분석하고 있어요</strong><p>잠시 후 대응 점수와 피드백을 볼 수 있어요.</p></div></div> : null}</>}
      {error && <div className="error" role="alert">{error} {retry && <button className="quiet" disabled={busy} onClick={retry}>재시도</button>}</div>}
    </article>
    {page === 3 && <CallPortrait self />}
    </div>

  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
