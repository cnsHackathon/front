import { useEffect, useRef, useState } from 'react';

const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;

export function useVoice() {
  const input = useRef(null);
  const playback = useRef(null);
  const audioContext = useRef(null);
  const voices = useRef([]);
  const [text, setText] = useState('');

  function stopListening(discard = false) {
    const active = input.current;
    if (!active) return Promise.resolve('');
    if (discard) {
      active.cancel();
    } else if (!active.stopping) {
      active.stopping = true;
      active.stopTimeout = setTimeout(() => active.finish(), 2000);
      try { active.recognition.stop(); } catch { active.finish(); }
    }
    return active.done;
  }

  function listen(onEnd, onError) {
    setText('');
    if (!Recognition) {
      onError('음성 인식은 Chrome에서 열어 주세요. 텍스트로도 답할 수 있어요.');
      return;
    }
    const active = { recognition: new Recognition(), confirmed: '', interim: '', stopping: false };
    let resolve;
    active.done = new Promise(done => { resolve = done; });
    const engine = active.recognition;
    engine.lang = 'ko-KR';
    engine.continuous = true;
    engine.interimResults = true;
    active.finish = (discard = false) => {
      if (input.current !== active) return;
      clearTimeout(active.timeout);
      clearTimeout(active.stopTimeout);
      input.current = null;
      const result = discard ? '' : [active.confirmed, active.interim].filter(Boolean).join(' ').trim();
      resolve(result);
      if (!discard) onEnd(result);
    };
    active.cancel = () => {
      active.finish(true);
      try { engine.abort(); } catch { /* Already stopped. */ }
    };
    engine.onresult = event => {
      if (input.current !== active) return;
      active.interim = '';
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal) active.confirmed += ' ' + result[0].transcript;
        else active.interim += ' ' + result[0].transcript;
      }
      setText([active.confirmed, active.interim].join(' ').trim());
    };
    engine.onend = () => {
      if (input.current !== active) return;
      if (active.stopping) return active.finish();
      active.interim = '';
      try { engine.start(); } catch { active.finish(); }
    };
    engine.onerror = event => {
      if (input.current !== active || event.error === 'no-speech') return;
      onError('음성 인식을 이어갈 수 없어요. 마이크 권한과 연결을 확인하거나 텍스트로 답해 주세요.');
      active.finish();
    };
    input.current = active;
    active.timeout = setTimeout(() => stopListening(), 60_000);
    try { engine.start(); } catch {
      onError('마이크를 시작할 수 없어요. 텍스트로도 답할 수 있어요.');
      active.finish();
    }
  }

  function stopSpeaking() {
    playback.current?.();
    window.speechSynthesis?.cancel();
  }

  function speakWithBrowser(text, speaker) {
    stopSpeaking();
    if (!window.speechSynthesis || !text) return Promise.resolve();
    const sentences = text.match(/[^.!?。！？]+[.!?。！？]*/g) ?? [text];
    return new Promise(resolve => {
      let index = 0;
      let watchdog;
      function finish() {
        clearTimeout(watchdog);
        if (playback.current === finish) playback.current = null;
        resolve();
      }
      function playNext() {
        if (playback.current !== finish) return;
        clearTimeout(watchdog);
        if (index >= sentences.length) return finish();
        const speech = new SpeechSynthesisUtterance(sentences[index++]);
        speech.lang = 'ko-KR';
        speech.voice = voices.current[speaker === 'B' ? 1 : 0] ?? voices.current[0] ?? null;
        speech.pitch = speaker === 'B' && voices.current.length < 2 ? 0.8 : 1;
        speech.rate = speaker === 'B' ? 0.9 : 1;
        speech.onend = playNext;
        speech.onerror = finish;
        watchdog = setTimeout(() => { finish(); window.speechSynthesis.cancel(); }, 20_000);
        window.speechSynthesis.speak(speech);
      }
      playback.current = finish;
      playNext();
    });
  }

  function unlockAudio() {
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return;
    audioContext.current ??= new AudioContext();
    audioContext.current.resume().catch(() => {});
  }

  function speak(text, speaker) {
    stopSpeaking();
    if (!text) return Promise.resolve();
    const context = audioContext.current;
    if (!context || context.state === 'closed') return speakWithBrowser(text, speaker);

    return new Promise(resolve => {
      const controller = new AbortController();
      let source;
      let stopped = false;
      const timeout = setTimeout(() => controller.abort(), 12000);

      function finish() {
        clearTimeout(timeout);
        if (playback.current === cancel) playback.current = null;
        resolve();
      }

      playback.current = () => {
        stopped = true;
        controller.abort();
        source?.stop();
        clearTimeout(timeout);
        resolve();
      };
      const cancel = playback.current;
      async function play() {
        try {
          const response = await fetch('/local-tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice: speaker === 'B' ? 'F2' : 'M1', lang: 'ko', speed: 1.02 }),
            signal: controller.signal,
          });
          if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/')) {
            throw new Error('Local TTS unavailable');
          }
          const buffer = await context.decodeAudioData(await response.arrayBuffer());
          if (stopped) return;
          if (context.state !== 'running') throw new Error('Audio playback blocked');
          clearTimeout(timeout);
          source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(context.destination);
          source.onended = finish;
          source.start();
        } catch {
          if (stopped) return;
          if (playback.current === cancel) playback.current = null;
          clearTimeout(timeout);
          await speakWithBrowser(text, speaker);
          resolve();
        }
      }
      play();
    });
  }

  useEffect(() => {
    const synth = window.speechSynthesis;
    const refresh = () => { voices.current = synth?.getVoices().filter(voice => /^ko\b/i.test(voice.lang)) ?? []; };
    refresh();
    synth?.addEventListener('voiceschanged', refresh);
    return () => {
      synth?.removeEventListener('voiceschanged', refresh);
      input.current?.cancel();
      stopSpeaking();
      audioContext.current?.close().catch(() => {});
    };
  }, []);

  return { text, listen, stopListening, speak, stopSpeaking, unlockAudio, supported: !!Recognition };
}
