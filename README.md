# 안심콜 FE 로컬 프로토타입

React + Vite. Node.js 18 이상이 필요합니다.

```powershell
npm.cmd install
npm.cmd run dev
```

Chrome으로 터미널에 표시된 localhost 주소를 엽니다. 마이크 권한과 한국어 음성은 시연 장비에서 확인하세요. 음성 인식에는 인터넷 연결이 필요할 수 있습니다. 마이크 대신 텍스트로 답할 수 있습니다.

기본 모드는 브라우저 메모리의 목 API입니다. 수사기관 사칭 시나리오 하나와 규칙 기반 판정으로 UI를 확인할 수 있습니다. 실제 개인정보 대신 가상 답변을 사용하세요.

- 위험 경로: 초반 두 턴에 가상 답변을 한 뒤 송금 요구에 “송금할게요”라고 답합니다.
- 거절 경로: “기관 대표번호로 직접 확인할게요”, “송금하지 않겠어요”처럼 두 번 대응합니다.

실제 BE 연결 시 프로젝트 폴더의 `.env.local`에 아래 설정을 추가하고 개발 서버를 재시작합니다. 포트는 BE 팀과 확정하세요.

```
VITE_USE_MOCK=false
BACKEND_URL=http://localhost:8080
```

FE-1은 `src/api.js`와 앱 흐름·리포트, FE-2는 프로필·전화 수신, FE-3은 통화 상태·타이머, FE-4는 `src/voice.js`에 있습니다. 실제 서버의 firstTurn, 턴 응답, 종료·재시도 동작은 연동 전에 명세를 확정해야 합니다.

`run-local.ps1` can also start the app using the bundled Codex Node runtime when the system Node version is older than 18.

## 한국어 TTS

별도 PowerShell 창에서 `.\run-tts.ps1`을 실행합니다. Python 3.10 이상 또는 Codex 번들 Python을 사용하며 첫 실행 시 Supertonic 3 모델(약 400MB)을 받습니다. 서비스가 준비되면 Chrome에서 체험을 시작하세요. 발화는 로컬 서버에서 합성하고 API 키나 호출 비용은 없습니다. 로컬 엔진이 꺼져 있으면 브라우저 음성으로 재생합니다.
