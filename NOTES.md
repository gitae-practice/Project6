# Project6 진행 노트

## 완료된 작업

### 2026-09-15 (계속 10)
- **모바일 스텝 표시에 면접관 이름도 같이 보이도록 변경** (사용자 확인 후 요청) — 예전엔 화면
  공간 절약을 위해 모바일에서 "1/2/3" 순번만 보여줬는데, 이름도 보고 싶다는 요청으로 숫자 대신
  글자 크기만 줄인(`text-[10px]`) 실제 이름("기술 면접관" 등)을 모바일에서도 그대로 표시
- **메시지별 다시 듣기 버튼에 일시정지/처음부터 기능 추가** (사용자 요청 — 재생 중일 때 눌러도
  처음부터 다시 재생되기만 해서 불편했음) — `activeSpeechKey`/`isSpeechPaused` state 추가,
  `speak(text, role, key)`에 key를 넘기면 utterance의 onstart/onpause/onresume/onend로 상태를
  추적. 이제 재생 중이 아닌 메시지는 재생 버튼 하나만, 재생 중인 메시지는 "일시정지/재생" 토글
  버튼과 "처음부터 다시 듣기"(RotateCcw) 버튼 두 개를 보여줌 (`speechSynthesis.pause()/resume()` 사용)
- tsc/lint/build 전부 통과 확인

### 2026-09-15 (계속 9)
- **메시지별 "다시 듣기" 버튼 추가** (사용자 요청) — 면접관 메시지마다 이름 레이블 옆에 작은
  스피커 아이콘 버튼을 추가해서, 자동 음성 안내(토글)와 별개로 아무 메시지나 원할 때 다시
  들을 수 있게 함. 스트리밍이 끝난(완성된) 메시지에만 노출됨
- **면접관별 목소리가 다 똑같이 들린다는 피드백** — pitch 차이를 1.4/0.7에서 1.8/0.5로(스펙상
  거의 한계치) 더 크게 벌림. 시스템에 로컬 한국어 목소리가 1개뿐인 환경이면 pitch/rate 조절이
  유일한 구분 수단이라 한계가 있을 수 있음 — 여전히 구분 안 되면 콘솔의
  `[음성합성] {role} 역할에 배정된 목소리: ...` 로그로 실제 목소리 개수 확인 필요
- tsc/lint/build 전부 통과 확인

### 2026-09-15 (계속 8)
- **STT 마이크 문제 사용자 쪽 환경 이슈였음이 확인됨** — "마이크 상태가 이상했었나보다, 지금은
  인식 잘 된다"고 확인. 지난번 진단(onspeechstart가 안 찍힘)대로 OS/장치 쪽 문제였던 것으로 보임
- **음성 안내(TTS) 토글 기본값을 켜짐으로 변경** (사용자 요청) — "중간에 껐다 켰을 때 특정
  면접관에서 안 들리던" 문제를 근본적으로 재현 안 시키는 방향: 세션 시작부터 켜져 있으면 그
  꺼짐→켜짐 전환 자체가 없어지므로 해당 경로의 버그를 회피할 수 있음. `isTtsEnabled` 초기값을
  `false`→`true`로 변경
- 면접관별 목소리 차이(로컬 목소리 우선 선택 + pitch/rate 차등)는 기존 그대로 유지 — 콘솔 로그
  (`[음성합성] {role} 역할에 배정된 목소리: ...`)로 실제 배정 상태 계속 확인 필요
- tsc/lint/build 전부 통과 확인

### 2026-09-15 (계속 7)
- **답변 입력창 위치가 흔들리던 문제 수정** (사용자 발견: "채팅창에 따라 하단바 위치가 변동됨") —
  "다음 면접관으로" 버튼이 스크롤 영역과 입력창 사이에 별도의 줄로 조건부 렌더링되고 있었는데,
  이 버튼이 나타나고 사라질 때마다(스트리밍 시작/종료마다) 플렉스 레이아웃의 높이 배분이 바뀌면서
  입력창이 위아래로 흔들려 보였음. 버튼을 스크롤 영역 안(대화 목록 마지막)으로 옮겨서, 입력창은
  항상 화면 맨 아래 같은 자리에 고정되고 버튼은 스크롤되는 콘텐츠의 일부가 되도록 수정. 버튼이
  나타날 때도 스크롤이 맨 아래로 따라가도록 스크롤 effect의 의존성에 `isStreaming` 추가
- tsc/lint/build 전부 통과 확인

### 2026-09-15 (계속 6)
- **"새 면접 시작" 버그 발견 및 수정** (사용자 발견) — 면접 진행 중에 사이드바의 "새 면접 시작"을
  눌러도 입력 폼으로 안 돌아가던 문제. 원인: 그 버튼이 `<Link href="/">`인데, 면접 진행 화면도
  같은 "/" 경로에서 `InterviewChat`의 내부 state(`started` 등)로만 화면이 바뀌는 구조라, 이미
  "/"에 있으면 Link가 같은 경로라 아무 네비게이션도 안 일어나 상태가 그대로 남아있었음.
  `DashboardChrome`에 `resetKey` state를 추가해서, "새 면접 시작" 클릭 시 이 값을 증가시켜
  `{children}`(페이지 전체)을 강제로 다시 마운트시키는 방식으로 우회 — `InterviewChat`의 모든
  state가 초기값으로 완전히 리셋됨. `HistorySidebar`에 `onNewInterview` 콜백 prop 추가
- **면접관 전환 시 이전 음성이 계속 재생되던 문제 수정** (사용자 발견: "음성 나오는 중 다음
  면접관으로 넘어가면 그대로 음성이 출력되고 있음") — `handleNextInterviewer()` 맨 앞에
  `speechSynthesis.cancel()`을 추가해서 넘어가는 순간 즉시 끊기도록 함 (이전엔 다음 면접관의
  질문이 다 스트리밍될 때까지는 아무것도 안 끊어서 이전 목소리가 계속 흘러나왔음)
- **면접관별 목소리 차이를 더 크게 키움** — pitch/rate 차이가 미묘해서 "다 같은 목소리로 들린다"는
  피드백을 받아 격차를 크게 늘림(인성: pitch 1.15→1.4·rate 0.95→0.92, 압박: pitch 0.85→0.7·
  rate 1.05→1.15). 다만 시스템에 로컬 한국어 목소리가 1개뿐인 환경(Windows에서 흔함)이면
  진짜 다른 사람 목소리처럼 들리게 하는 데는 한계가 있음 — 지난번 추가한 콘솔 로그
  (`[음성합성] {role} 역할에 배정된 목소리: ...`)로 실제 배정 상태를 계속 확인 중
- **STT 진단 결과 확인** — 사용자가 공유한 콘솔 로그: `시작됨` → `마이크 캡처 시작` →
  `마이크 캡처 종료` → `종료: no-speech` 순으로 찍히고, **`말소리 감지됨`(onspeechstart)은 한
  번도 안 찍힘**. 이는 브라우저가 마이크에 접근은 하지만(오디오 캡처 자체는 시작됨) 실제 사람
  목소리로 인식할 만한 신호가 전혀 들어오지 않는다는 뜻 — 코드 로직 문제라기보다 OS/브라우저의
  마이크 입력 자체(잘못된 입력 장치 선택, Windows 마이크 개인정보 설정, 물리적 음소거 등) 문제일
  가능성이 매우 높다고 판단해 사용자에게 안내함 (Windows 설정 → 개인정보 및 보안 → 마이크 확인 요청)
- tsc/lint/build 전부 통과 확인

### 2026-09-15 (계속 5)
- **STT 진단 로그가 아예 안 보이던 문제 수정** — `console.debug`는 크롬 개발자도구 콘솔의 기본
  로그 레벨 필터("Verbose")가 꺼져있으면 화면에 안 찍힌다. 전부 `console.log`/`console.error`로
  바꿔서 기본 설정에서도 항상 보이게 함 + `recognition.start()`를 try/catch로 감싸서 동기 예외가
  나도 조용히 묻히지 않고 콘솔+화면에 남게 함
- **TTS가 기술 면접관 때만 유독 안 들리는 문제의 진짜 원인 추정** (사용자가 "토글을 언제 켜든
  기술 면접관에서만 안 되고 다른 면접관에선 된다"고 명확히 짚어줌 — 단순 타이밍/경합 문제가
  아니라 역할(role)에 결부된 문제임을 확인) — 크롬 목소리 목록엔 "Google 한국의"처럼 네트워크
  (원격 서버) 합성 목소리가 섞여 있는 경우가 있는데, 이런 목소리는 크롬 버전/환경에 따라 에러도
  없이 조용히 재생이 안 되는 경우가 보고돼 있음. 역할별 목소리 배정이 항상 배열 0번(기술)부터
  시작하는데, 하필 그 자리가 네트워크 목소리였을 가능성이 큼 → `pickVoiceForRole()`이 기기에
  실제 설치된(`localService: true`) 목소리를 우선 선택하도록 수정
  - 확인용으로 어떤 목소리가 배정됐는지(`이름/언어/로컬-네트워크 여부`)와 재생이 실제로
    시작됐는지(`onstart`)를 콘솔에 로그로 남기도록 추가 — 이번에도 안 되면 이 로그로 정확한
    원인(배정된 목소리가 뭔지, 재생 시작 자체가 안 되는지)을 바로 확인 가능
- tsc/lint/build 전부 통과 확인

### 2026-09-15 (계속 4)
- **TTS가 첫 번째(기술) 면접관 때만 안 들리던 원인 발견** (사용자 리포트: "토글 켜도 소리 안 나는데
  인성 면접관으로 넘어가면 들림") — `speechSynthesis.getVoices()`가 비어있을 때 `voiceschanged`
  이벤트를 한 번만(`{once:true}`) 기다리도록 했었는데, 이 이벤트가 우리가 리스너를 달기도 전에
  이미 한 번 발생해버렸을 수 있다는 걸 놓쳤음 — 그러면 그 리스너는 영원히 다시 안 불려서 첫
  재생 시도가 조용히 멈춰버림. 두 번째 시도부턴 이미 목소리 목록이 채워져 있어 정상 동작해서
  마치 "두 번째부터만 되는" 것처럼 보였던 것. `voiceschanged`를 300ms만 기다렸다가 그래도 안 오면
  목소리 없이라도(브라우저 기본 목소리로) 재생을 강행하도록 수정 — 이벤트를 무한정 기다리지 않게 함
- **STT 진단 로그 추가** — 계속 안 된다는 리포트에 따라, 표준 방식(non-continuous)으로도 안
  된다면 코드 로직보다는 마이크 자체(OS 권한/장치) 문제일 가능성을 의심 중. `onaudiostart`/
  `onaudioend`/`onspeechstart`/`onspeechend` 이벤트에 콘솔 로그를 추가해서, 마이크 캡처 자체가
  시작되는지(안 되면 OS/브라우저 마이크 권한·장치 문제), 말소리는 감지되는데 결과가 없는지(그러면
  인식 서버 통신 문제)를 구분할 수 있게 함 — 사용자에게 어느 로그까지 찍히는지 확인 요청 예정
  (`src/types/speech-recognition.d.ts`에 해당 이벤트 핸들러 타입 추가)
- tsc/lint/build 전부 통과 확인

### 2026-09-15 (계속 3)
- **STT를 continuous 모드에서 non-continuous(기본) 모드로 되돌림** (사용자 피드백: 여전히
  텍스트가 실시간으로 안 채워지고, "말이 끝나면 마이크가 자동으로 꺼지는" 원래 방식이 더 낫다고
  판단) — 직전에 추가한 "무음이면 자동 재시작" 로직(`shouldListenRef`)까지 통째로 되돌림.
  `continuous: false`가 훨씬 단순하고 안정적으로 잘 검증된 표준 방식이라, 한 번 말하고 멈추면
  자동으로 인식이 끝나고 마이크도 꺼지며, 답변이 길면 마이크를 다시 눌러 이어가는 방식으로 정리
  - `recognition.onerror`에서 "aborted"(사용자가 버튼으로 직접 멈춘 경우)도 "no-speech"와
    같이 정상 상황으로 취급해 화면에 에러로 띄우지 않도록 함
- **면접관별로 TTS 목소리를 다르게 구현** (사용자 요청) — `speak(text, role)`로 역할을 같이
  넘겨서: ① 시스템에 설치된 한국어 목소리가 여러 개면 면접관마다 실제로 다른 voice를 배정
  (`pickVoiceForRole` — `INTERVIEWER_ORDER`에서의 순서로 voice 목록을 순환 배정), ② 목소리가
  하나뿐이거나 아예 없어도 최소한 톤 차이는 나도록 역할별 pitch/rate를 다르게 고정
  (기술=기본, 인성=조금 높고 느리게, 압박=조금 낮고 빠르게)
- **콘솔에 뜬 "음성 합성 오류: interrupted" 관련** — 이건 다음 발화를 재생하려고 우리 코드가
  직접 이전 발화를 `cancel()`해서 생기는 정상적인 부작용이지 실제 실패가 아니었음. `interrupted`/
  `canceled` 에러 코드는 로그를 남기지 않도록 제외해서 불필요한 빨간 에러로 안 보이게 함
- tsc/lint/build 전부 통과 확인

### 2026-09-15 (계속 2)
- **STT 진짜 원인 찾음** — 콘솔에 "no-speech" 에러가 반복적으로 뜨는 걸 보고 파악: Chrome은
  `continuous: true`로 설정해도 몇 초만 조용하면 "no-speech" 에러와 함께 인식 세션 자체를
  내부적으로 끊어버리는 알려진 특성이 있음(스펙상 동작은 아니고 Chrome 구현체 특성). 마이크를
  누르고 바로 말하지 않으면, 정작 말을 시작했을 땐 이미 세션이 끊겨 있어서 "듣고 있는 것처럼
  보이지만 실제로는 아무것도 인식 안 되는" 상황이 벌어짐 — 사용자가 겪은 증상과 정확히 일치
  - `shouldListenRef`로 "사용자가 아직 멈추라고 안 했다"는 의도를 별도로 기억해두고, `onend`에서
    이 값이 true면 즉시 `recognition.start()`로 재시작하도록 수정 — 이제 사용자가 마이크 버튼을
    눌러서 끄기 전까지는 중간에 조용한 구간이 있어도 알아서 이어서 계속 듣는다
    (`recognitionRef.current?.stop()`을 호출하는 모든 곳에서 그 직전에 `shouldListenRef.current
    = false`를 먼저 설정하도록 통일 — 안 그러면 stop() 자체도 onend를 유발해서 즉시 재시작해버림)
  - "no-speech"는 이제 콘솔에 `console.debug`로만 남기고 화면 에러로는 안 보여줌(정상적인 재시작
    상황이라 사용자에게 에러처럼 보일 필요 없음)
- **TTS 추가 방어 코드** — cancel+speak 경합 수정만으로는 부족할 가능성을 감안해 목소리(voice)
  선택 로직 추가: `speechSynthesis.getVoices()`에서 한국어 목소리를 직접 찾아 지정하고
  (`lang`만 지정하고 시스템에 해당 언어 목소리가 아예 없으면 일부 브라우저가 에러 없이 조용히
  재생을 안 하는 경우가 있음), 없으면 아무 목소리로라도 재생 시도. 목소리 목록이 비동기로 늦게
  채워지는 브라우저를 위해 `voiceschanged` 이벤트 처리도 추가. `utterance.onstart`/`onerror`를
  `console.debug`/`console.error`로 남겨서 재생이 실제로 "시작됐는지"까지 확인 가능하게 함
- 직전 커밋 관련: Fast Refresh 콘솔에 떴던 JSX 파싱 에러("Expected '</', got jsx text')는 편집
  중간 단계(첫 edit에서 div를 하나 더 열고 안 닫은 상태)를 dev 서버가 일시적으로 잡아낸 것으로,
  같은 턴의 후속 edit으로 이미 수정되어 최종 커밋된 코드에는 존재하지 않음 (tsc/build 통과로 확인)
- tsc/lint/build 전부 통과 확인

### 2026-09-15 (계속)
- **STT/TTS 안 되던 문제 진단 및 수정 시도** (사용자 리포트: "말해도 실시간으로 텍스트 안 채워짐,
  음성인식은 하는것같은데" + "음성도 안나옴")
  - **TTS**: Chrome이 `speechSynthesis.cancel()` 직후 곧바로 `.speak()`를 호출하면 새 발화가
    씹혀서 아예 소리가 안 나는 알려진 버그가 있음 — `speak()`가 매번 무조건 `cancel()` 후 바로
    `speak()`하고 있었던 게 원인일 가능성이 높음. 지금 뭔가 말하고 있을 때(`synth.speaking` ||
    `synth.pending`)만 `cancel()`하고, 그 다음 `speak()`는 `setTimeout(..., 50)`으로 한 틱 미뤄서
    호출하도록 수정 + `utterance.onerror`로 실패 시 콘솔에 원인 로그
  - **STT**: 마이크는 켜지는데 결과가 하나도 안 들어오면 원인(권한 거부/네트워크 오류/무음 등)을
    전혀 알 수 없던 게 문제라 판단 — `recognition.onerror`에서 에러 코드를 콘솔에 로그 + 화면에도
    한글로 번역해서 보여주도록 수정(`translateSpeechError`: not-allowed/network/audio-capture 등).
    단, `no-speech`는 continuous 모드에서 흔히 발생하는 정상적인 상황이라 에러로 띄우지 않고 계속
    듣는 상태를 유지함
  - **중요**: 코드 검토로 확인 가능한 범위(Chrome의 cancel+speak 경합 버그, 에러 미노출)는
    고쳤지만, 브라우저를 직접 열어 테스트하지 못했기 때문에 완전히 해결됐는지는 미확인 — 여전히
    안 되면 이제는 화면에 뜨는 에러 메시지(또는 브라우저 콘솔의 "음성 인식 오류"/"음성 합성 오류"
    로그)를 같이 알려줘야 원인을 좁힐 수 있음
- tsc/lint/build 전부 통과 확인

### 2026-09-15
- **STT/TTS 음성 입출력 구현** — 둘 다 브라우저 내장 Web Speech API라 서버/API 키 없이 구현 가능
  - **STT(음성 답변 입력)**: 입력창 옆에 마이크 버튼 추가(`SpeechRecognition`, `lang: "ko-KR"`,
    `continuous`+`interimResults`). 녹음 중엔 실시간으로 중간 결과가 입력창에 반영되고, 문장이
    확정될 때마다 이어붙여진다. 이미 입력해둔 텍스트는 지우지 않고 그 뒤에 계속 이어붙임. 답변
    전송 시 자동으로 마이크도 꺼짐
  - **TTS(면접관 질문 음성 안내)**: 면접관 프로필 헤더에 스피커 토글 추가(기본 꺼짐 — 브라우저
    자동재생 정책 + 갑자기 소리 나는 것 방지). 켜두면 답변 스트리밍이 끝난 시점에 그 답변 전체를
    한 번에 읽어줌(토큰 스트리밍 도중 끊어 읽으면 부자연스러워서 완료 후 일괄 재생)
  - 둘 다 Chrome/Edge 계열만 안정 지원이라 `window.SpeechRecognition`/`webkitSpeechRecognition`,
    `speechSynthesis` 지원 여부를 기능 감지해서 미지원 브라우저에는 버튼 자체를 숨김. SSR 시점엔
    `window`가 없어 항상 false로 시작 → 마운트 후 `queueMicrotask`로 한 틱 미뤄서 재확인
    (동기 호출 시 `react-hooks/set-state-in-effect`에 걸림, 이전 세션에서 겪은 것과 동일 패턴)
  - `src/types/speech-recognition.d.ts` 신규 — TypeScript 기본 lib.dom.d.ts에 `SpeechRecognition`
    본체 타입이 없어서(결과 타입들만 있음) 직접 앰비언트 선언 추가
  - 화면 이탈/재시작 시 마이크·음성 재생 정리(`recognition.stop()`, `speechSynthesis.cancel()`)
- tsc/lint/build 전부 통과 확인. TypeScript/UI 변경만 있어서 schema.sql 재실행 불필요

### 2026-09-11 (계속)
- **로그인 ↔ 회원가입 전환 시 입력값이 그대로 남아있던 버그 수정** — 회원가입 폼에 입력한
  이메일/비밀번호(+이름)가 로그인 화면으로 전환해도 지워지지 않고 남아있던 문제. 모드 전환
  버튼의 `onClick`에서 `fullName`/`email`/`password`를 전부 빈 문자열로 초기화하도록 수정
  (`AuthForm.tsx`)
- tsc/lint/build 전부 통과 확인

### 2026-09-11
- **홈 화면 상단 인사말 추가** — 회원가입 시 입력한 이름(`user_metadata.full_name`)을 가져와서
  "안녕하세요, OOO님"을 새 면접 시작 화면(`InterviewChat`의 `!started` 상태) 제목 위에 표시.
  이름이 없는 계정(과거 가입 등)은 조용히 생략됨. `(dashboard)/page.tsx`를 서버 컴포넌트로 바꿔
  `supabase.auth.getUser()`로 이름을 읽어 `InterviewChat`에 prop으로 전달
- **일반 유저용 마이페이지(`/mypage`) 신규 구현** — 이름/비밀번호 변경 목적(이메일은 변경 불가)
  - 2단계 구조: ①비밀번호 재확인(이메일 표시 + 비밀번호 입력 → `signInWithPassword`로 검증해야
    통과) → ②이름/새 비밀번호 변경 폼(`supabase.auth.updateUser({ data, password })`). 비밀번호
    입력칸은 비워두면 이름만 변경됨. 나중에 회원탈퇴 기능을 추가할 때 이 재인증 단계를 그대로
    재사용할 수 있게 구조를 잡아둠(아직 탈퇴 기능 자체는 구현 안 함 — 범위 밖)
  - `DashboardChrome` 헤더(모바일/데스크톱 둘 다)에 `UserCog` 아이콘으로 마이페이지 링크 추가
  - Supabase 에러 메시지 한글화 함수(`translateAuthError`)가 `AuthForm.tsx`에 로컬로만 있던 것을
    `src/lib/supabase/authErrors.ts`로 공용 분리해서 마이페이지에서도 재사용 (중복 제거)
- tsc/lint/build 전부 통과 확인. TypeScript/UI 변경만 있어서 schema.sql 재실행 불필요

### 2026-09-07 (계속 7)
- **추이 차트에 좌우 화살표 스크롤 버튼 추가** (사용자 요청 — 스크롤바를 없앤 대신 눈에 보이는
  넘김 버튼이 있으면 좋겠다는 피드백)
  - `useDragToScroll()`을 `useHorizontalScrollController()`로 확장: 마우스 드래그 스크롤 기능은
    그대로 두고, ① 스크롤 위치·카드 크기(ResizeObserver)를 감시해서 "더 넘길 방향이 있을 때만"
    좌/우 화살표를 보여주는 `canScrollLeft`/`canScrollRight`, ② 화살표를 누르고 있는 동안
    `requestAnimationFrame`으로 한 프레임씩 조금씩 이동시켜 마우스 휠 클릭(오토스크롤)처럼
    부드럽게 계속 흘러가는 `startAutoScroll`/`stopAutoScroll`을 추가
  - 화살표 버튼은 카드 좌/우 끝에 원형 버튼(`bg-surface` + `border-border`)으로 겹쳐 배치, lucide
    `ChevronLeft`/`ChevronRight` 아이콘 사용
  - 구현 중 겪은 린트 이슈 2건: (1) 훅이 반환한 객체를 `trendScroll.xxx`처럼 JSX에서 바로 점(.)
    접근하면 내부에 ref를 쓰는 훅이라는 이유로 `react-hooks/refs`가 "렌더링 중 ref 접근"으로
    오탐지 — 훅 호출 시점에 바로 구조분해해서 지역 변수로 만들어 해결. (2) 초기 상태를 맞추려고
    effect 안에서 `updateScrollState()`를 동기 호출했더니 `react-hooks/set-state-in-effect`에
    걸림 — `ResizeObserver`는 `observe()` 호출 시 최초 한 번은 알아서 비동기로 콜백을 실행해주므로
    그 동기 호출 자체를 제거해서 해결
- tsc/lint/build 전부 통과 확인

### 2026-09-07 (계속 6)
- **추이 차트의 "일/월" 기준을 롤링 윈도우 → 달력 기준으로 변경** (사용자 요청) — 기존엔 "일"이
  지금 시각 기준 이전 24시간 롤링(예: 어제 11시~오늘 11시), "월"이 정확히 29일 전~오늘로 고정된
  칸 수(30개)였는데, 아래처럼 변경:
  - **일**: 롤링 24시간 → **오늘 00시(KST)부터 지금까지** 고정 (24칸, 아직 안 지난 미래 시간대는
    0건으로 표시됨 — 예를 들어 지금이 낮 2시면 15~23시는 데이터가 없어 빈 막대로 보이는 게 정상)
  - **주**: 기존 롤링 7일 그대로 유지 (사용자가 "주는 지금처럼"이라고 명시)
  - **월**: 고정 29일 전 → **지금 기준 정확히 한 달 전(interval '1 month')부터 오늘까지**로 변경.
    달마다 날짜 수가 달라 칸 수가 28~31개로 가변적이 됨 — 프론트 라벨도 "최근 30일"에서
    "최근 한 달"로 같이 수정 (`OverviewSection.tsx`의 `TREND_LABEL`)
  - "일" 기준으로 필터링하는 인기 직무/점수 분포의 cutoff도 롤링 24시간에서 "오늘 00시(KST)"로
    같이 맞춤 — 카드 제목이 이미 "오늘 인기 지원 직무"처럼 "오늘"을 달력일로 표현하고 있어서 실제
    쿼리 기준도 거기 맞춰야 일관됨
  - **schema.sql 재실행 필요**
- tsc/lint/build 전부 통과 확인

### 2026-09-07 (계속 5)
- **추이 차트 시간대 버그 발견 및 수정** (사용자가 "왜 하필 11시부터, 8월10일부터 시작하지?"라고
  질문해서 발견) — Supabase Postgres 서버는 기본 UTC로 동작하는데, `now()`/`current_date`를 그대로
  써서 시간·날짜 버킷을 나누고 있었음. 한국(KST, UTC+9)과 최대 9시간 차이가 나서, 예를 들어 "일"
  차트의 맨 왼쪽(가장 오래된 시점)이 사용자 기준 "24시간 전"이 아니라 UTC 기준 24시간 전이라
  실제 로컬 시각과 어긋나 보였고, "월" 차트도 날짜 경계가 하루씩 밀려 보일 수 있었음
  - `admin_period_charts()`에 `kst_now timestamp := (now() at time zone 'Asia/Seoul')` 선언 추가,
    일/주/월 추이 버킷 생성과 세션 매칭을 전부 이 값 기준으로 변경
  - `admin_dashboard_stats()`의 "신규 가입자(오늘/어제)" 판정도 같은 이유로 KST 기준 날짜로 수정
    (`(created_at at time zone 'Asia/Seoul')::date = kst_today`)
  - 롤링 24시간/7일/1개월 윈도우(day_ago/week_ago/month_ago, cutoff)는 절대 시간 차이라 시간대와
    무관해서 그대로 둠 — 오직 "달력상 오늘/이번 시간대" 같은 경계 판정만 KST로 맞췄음
  - **schema.sql 재실행 필요**
- tsc/lint 통과 확인 (TypeScript 파일 변경 없음, SQL만 수정)

### 2026-09-07 (계속 4)
- 추이 차트 가로 스크롤 영역에 스크롤바가 그대로 보여서 어색하다는 피드백 — 기능(스크롤/드래그)은
  그대로 두고 시각적으로만 스크롤바를 숨김. `globals.css`에 `.no-scrollbar` 유틸리티 클래스 추가
  (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`) 후 해당 컨테이너에 적용
- **마우스 드래그 스크롤이 실제로는 동작 안 하던 버그 수정** — `useDragToScroll()`을 `useRef` +
  `useEffect(deps: [])`로 짰었는데, 이 스크롤 영역은 데이터 로딩이 끝나야 조건부로 렌더링되는
  DOM이라 마운트 시점엔 아직 노드가 없어서(로딩 문구만 있음) effect가 빈 리스너 등록 없이 한 번
  실행되고 끝나버렸고, 이후 실제 노드가 생겨도 effect가 다시 실행되지 않아 리스너가 영영 안
  붙어있었음. `useRef` 대신 `useState`로 DOM 노드를 들고 콜백 ref로 넘기는 방식으로 바꿔서, 노드가
  실제로 마운트될 때 state가 갱신되며 effect가 그 시점에 다시 실행되도록 수정
- tsc/lint/build 전부 통과 확인

### 2026-09-07 (계속 3)
- **추이 차트 접근 방식 자체를 변경** — 라벨 솎아내기(간격 계산 + 좌우 정렬)로 두 차례 고쳐봤지만
  칼럼 폭이 좁을 때 겹침/카드 밖 삐져나감이 반복돼서, 사용자 제안대로 "막대 개수가 많으면 라벨을
  줄이는 대신 가로 스크롤로 넘겨보기" 방식으로 교체
  - 막대 하나당 고정 폭(40px)을 주고 라벨은 전부 그대로 표시 — 더 이상 어떤 라벨도 숨기거나
    정렬을 바꾸지 않아도 됨 (겹침 자체가 구조적으로 발생하지 않음)
  - 데이터가 적을 때(주=7개)는 고정 폭 합이 카드 폭보다 작아 기존처럼 꽉 차 보이고, 많을 때
    (일=24개/월=30개)만 자연스럽게 `overflow-x-auto`로 스크롤 영역이 됨
  - 데스크톱에서 스크롤바 대신 마우스로 클릭+드래그해서 넘길 수 있게 `useDragToScroll()` 훅 추가
    (포인터 이벤트로 scrollLeft 직접 조작, `pointerType === "mouse"`일 때만 동작해서 터치 화면의
    기본 스와이프 스크롤과 충돌하지 않음)
  - `pickTrendLabelIndices()`/좌우 정렬 등 이전 두 차례 수정에서 추가했던 라벨 계산 로직은 전부 제거
- tsc/lint/build 전부 통과 확인

### 2026-09-07 (계속 2)
- **추이 차트 라벨 버그 2건 추가 수정** (사용자가 재확인 스크린샷으로 발견 — 1차 수정이 불완전했음)
  1. 라벨 선택 알고리즘 버그: 기존엔 "맨 끝에서부터 step 간격으로 고르고 0번을 별도로 강제 추가"
     하는 방식이라, step 나머지에 따라 0번과 1번처럼 거의 붙어있는 두 인덱스가 동시에 뽑혀 라벨
     두 개가 겹쳐 보이는 경우가 있었음 (월 30개 기준 실제로 발생: "08/09"와 "08/10"이 인접 선택됨).
     0~마지막 인덱스를 maxLabels개로 균등 분할해서 뽑는 방식(`Math.round(k * step)`)으로 교체 —
     양 끝은 항상 포함되면서 간격도 항상 고르게 됨
  2. 맨 앞/맨 뒤 라벨이 카드 경계 밖으로 삐져나가 옆 카드(점수 분포 등) 글자와 겹쳐 보이던 문제 —
     라벨 span이 좁은 칼럼 안에서 가운데 정렬이라 텍스트가 칼럼보다 넓으면 양옆으로 균등하게
     넘치는데, 맨 앞/맨 뒤 칼럼은 넘칠 공간이 카드 바깥쪽밖에 없어서 옆 카드까지 침범했음.
     맨 앞은 왼쪽 정렬(오른쪽으로만 넘침), 맨 뒤는 오른쪽 정렬(왼쪽으로만 넘침)로 바꿔서 항상
     차트 안쪽으로만 넘치게 수정 + 카드에 `overflow-hidden` 추가(안전장치)
- tsc/lint/build 전부 통과 확인

### 2026-09-07 (계속)
- **개요 탭 추이 차트 라벨 겹침 버그 수정** (사용자가 스크린샷으로 발견) — "일" 선택 시 시간대별
  24개 라벨이 전부 표시되면서 서로 겹쳐 깨져 보이던 문제. `pickTrendLabelIndices()` 헬퍼를 추가해
  포인트 개수가 많을 때(일=24개/월=30개) 최근 시점(오늘/지금) 기준으로 일정 간격만 남기고 나머지는
  숨기되, 맨 처음 지점은 항상 남겨서 차트의 시작/끝 지점은 계속 보이게 함 (기존에는 월만 5개 간격
  솎아내고 일은 전혀 안 솎아내고 있었음)
- tsc/lint/build 전부 통과 확인

### 2026-09-07
- **관리자 대시보드 개요 탭 하단 3개 차트(인기 지원 직무 TOP5 / 면접 시작 추이 / 점수 분포)를
  상단 일·주·월 토글에 연동** — 기존에는 스탯 카드 6개만 토글에 반응하고 이 3개는 항상 전체
  기간(직무·점수 분포) 또는 고정 최근 7일(추이)로 집계되고 있었음
  - 새 DB 함수 `admin_period_charts(p_period text)` 추가 — 스탯 카드용 `admin_dashboard_stats()`와
    달리 "지금 vs 과거 시점 비교"가 아니라 "선택된 기간 동안의 집계 자체"라서 별도 함수로 분리,
    토글 클릭마다 그 기간으로 다시 통째로 집계해서 받아옴
  - 추이 차트는 기간별로 가로축 단위 자체가 바뀜: 일=시간별 24개, 주=일별 7개(기존과 동일),
    월=일별 30개 (월 선택 시 막대 30개가 라벨까지 다 붙으면 겹쳐서 5개 간격으로만 날짜 표시)
  - 인기 직무/점수 분포도 필터링 범위가 "오늘/이번 주/이번 달"로 바뀌고, 차트 제목도 그에 맞춰
    동적으로 바뀜 (신규 가입자 카드에 이미 적용했던 라벨 전환 패턴과 동일)
  - `admin_dashboard_stats()`에서는 이제 쓰이지 않는 `top_job_roles`/`sessions_last_7_days`/
    `score_distribution` 필드를 제거 (중복 집계 방지, `admin_period_charts()`로 완전히 이관)
  - `OverviewSection`은 차트 결과에 요청 당시 기간(`period`)을 같이 저장해서, 응답이 현재 선택된
    기간과 일치하는지 렌더링 시점에 비교하는 방식으로 로딩 상태를 표현 — effect 안에서
    setState를 동기 호출하지 않아도 되게 해서 `react-hooks/set-state-in-effect` 린트를 피함
  - **schema.sql 재실행 필요** (새 함수 `admin_period_charts` 추가 + 기존 함수 필드 변경)
- tsc/lint/build 전부 통과 확인

### 2026-08-31 (계속 10)
- **개발 중 쌓인 테스트 더미 데이터 정리**: `user_id`가 없던(로그인 붙이기 전 세션) 옛 테스트
  세션들을 사용자가 직접 `delete from interview_sessions where user_id is null;`로 정리 —
  관리자 대시보드의 총 세션 수와 세션 관리 탭 목록 행 수가 이제 정확히 일치함
- **스탯 카드 증감 표시를 "절대값 / 퍼센트" 둘 다 보여주도록 변경** — 이전에는 상황에 따라
  절대값만 보이거나(이전 값이 0일 때) 퍼센트만 보이거나(그 외) 해서 형식이 오락가락해 보였음.
  이제 비교 가능한 경우엔 항상 "+3 / +150%"처럼 같이 보여주고, 이전 값이 0이라 퍼센트를 정의할
  수 없는 경우에만 절대값만 표시 (0으로 나누기라 퍼센트 자체가 성립하지 않으므로)
  - `computeTrendFromPair()`(`lib/admin.ts`) 로직 수정, 스톡/플로우 지표 공통 적용
- tsc/lint/build 전부 통과 확인

### 2026-08-31 (계속 9)
- **관리자 대시보드 데이터 정합성 버그 2건 수정** (사용자가 직접 화면 비교하다 발견)
  1. "세션 관리" 탭에 실제보다 훨씬 적은 세션만 보이던 문제 — `admin_list_sessions()`가
     `auth.users`와 INNER JOIN이라, 로그인 기능 붙이기 전(초기 개발 단계)에 만들어져 `user_id`가
     비어있는 옛 테스트 세션들이 통째로 빠지고 있었음. LEFT JOIN으로 바꾸고 매칭 안 되는 이메일은
     "(알 수 없음)"으로 표시하도록 수정
  2. "오늘 신규 가입자 1명"인데 "변동없음"으로 뜨던 문제 — 비교 대상 값(어제 신규 가입자)이 0일 때
     0으로 나누는 퍼센트 계산을 아예 "비교 불가"로 처리해버려서 생긴 버그. 0 → N으로 늘어난 경우는
     퍼센트 대신 절대 증가량("+1")으로 보여주도록 `computeTrendFromPair()` 수정
- **"신규 가입자"를 플로우 지표로 재설계** — 나머지 5개 카드(총 가입자 등)는 "누적값 vs N일 전 누적값"
  비교인데, 신규 가입자는 원래부터 "그 기간에 새로 생긴 수"라 성격이 다르다는 걸 사용자가 지적함.
  일/주/월 토글에 따라 라벨과 값 자체가 "오늘/이번 주/이번 달 신규 가입자"로 바뀌고, 비교 대상도
  "어제/그 이전 7일/그 이전 1개월"로 맞춰서 새로 계산 (`admin_dashboard_stats()`의 `new_users_today`
  필드를 `new_users`로 교체, `AdminFlowStat` 타입 + `computeFlowTrend()` 추가)
- tsc/lint/build 전부 통과 확인

### 2026-08-31 (계속 8)
- **세션 삭제를 소프트 삭제로 전환** (사용자가 직접 발견한 버그: 삭제된 세션은 완전히 사라지므로
  관리자 대시보드의 일/주/월 증감률이 삭제 시점에 따라 왜곡될 수 있었음)
  - `interview_sessions`에 `deleted_at timestamptz` 컬럼 추가 (null이면 정상)
  - `HistorySidebar`의 삭제 버튼이 이제 `.delete()`가 아니라 `.update({ deleted_at: now() })` 호출
  - 유저 화면의 일반 조회(사이드바 목록, `/history/[id]` 상세)에는 `.is("deleted_at", null)` 필터 추가
  - `admin_dashboard_stats()`는 애초에 deleted_at을 참조하지 않으므로 별도 수정 없이 그대로
    정확해짐 (행이 실제로 안 지워지니 created_at 기준 과거 집계가 항상 맞게 나옴)
  - `admin_list_sessions()`에는 `is_deleted` 필드를 추가해 관리자 세션 목록에는 삭제 여부와
    무관하게 계속 노출하되 "유저가 삭제함" 배지로 구분 표시
  - **한계 확인**: 계정 탈퇴(회원 삭제)는 이 수정으로 해결되지 않음 — 앱에 자체 탈퇴 기능이
    없고, 유일한 계정 삭제 경로(Supabase 대시보드에서 관리자가 직접 삭제)는 `auth.users` 자체를
    하드 삭제하는 것이라 세션의 `deleted_at`과 무관하게 cascade로 전부 사라짐. 나중에 앱 내
    "회원 탈퇴" 기능을 만든다면 그때도 실제 삭제 대신 비활성화 처리가 필요함
  - tsc/lint/build 전부 통과 확인

### 2026-08-31 (계속 7)
- **개요 탭에 일/주/월 비교 기간 토글 추가** — 여러 차례 요구사항이 다듬어지다가 최종적으로
  "일 / 주 / 월" 3단 토글(기본값 "일")로 확정
  - `admin_dashboard_stats()`가 스탯마다 `{value, day, week, month}` 4개 값을 반환하도록 확장
    (1일 전/7일 전/1개월 전 시점 기준으로 각각 동일한 방식으로 재계산)
  - `computeStatTrend(stat, period)`가 선택된 기간에 맞는 비교값으로 증감률 계산
  - 비교 데이터가 없거나 변화가 0%로 반올림되면 화살표 없이 "변동없음"으로 통일 (기존 "전주 대비 -/0%" 문구는 폐기)
  - 토글 버튼은 세션 관리 탭의 완료/미완료 토글과 같은 스타일(선택 시 accent 배경) 재사용
  - tsc/lint/build 전부 통과 확인

### 2026-08-31 (계속 6)
- **평균 점수 계산 방식 변경**: "완료된 면접 전체의 평균"(면접을 많이 본 유저가 과대 반영됨)에서
  "유저별 평균의 평균"(유저 한 명 한 명이 동일한 비중)으로 변경 — `admin_dashboard_stats()`에서
  유저별로 group by해서 평균 낸 뒤 그걸 다시 평균
- **스탯 카드 6개에 전주 대비 증감 표시 추가**
  - `admin_dashboard_stats()`가 각 지표를 `{value, previous}` 형태로 반환하도록 변경 —
    `previous`는 "7일 전 시점 기준으로 같은 방식으로 계산한 값" (예: 가입자 수는 7일 전까지 가입한
    사람 수, 진행 중인 면접은 7일 전 시점엔 아직 리포트가 없었던 세션 수, 평균 점수는 7일 전까지의
    리포트만으로 계산한 유저별 평균의 평균)
  - `computeStatTrend()` 헬퍼(`lib/admin.ts`)가 증감률을 계산해 상승은 emerald-400 + ▲, 하락은
    red-400 + ▼, 비교 데이터가 없거나(null) 이전 값이 0이면 "전주 대비 -", 변화가 0%로 반올림되면
    "전주 대비 0%"로 표시 (두 경우 다 화살표 숨김)
  - tsc/lint/build 전부 통과 확인

### 2026-08-31 (계속 5)
- **관리자 대시보드 확장 — 탭 구조 + 유저/세션 관리 (익명화 처리)**
  - 처음엔 유저 이메일을 그대로 보여달라는 요청이었으나, 앞서 "개인정보 노출 안 함" 방향과
    충돌한다고 판단해 익명화 절충안 제안 → 이메일 마스킹(`abc***@gmail.com`)으로 확정
  - DB 함수 `admin_mask_email()` 추가 — 이메일 마스킹을 DB 함수 안에서부터 처리해서 마스킹 전
    원본 이메일이 애초에 서버 응답에 담기지 않게 함 (Next.js 서버 컴포넌트조차 원본을 안 봄)
  - `admin_dashboard_stats()`에 `in_progress_sessions`(리포트 없는 세션 = 진행 중, 별도 status
    컬럼 없이 판단), `new_users_today`, `score_distribution`(0-2/3-4/5-6/7-8/9-10 5구간) 추가
  - `admin_list_users()` / `admin_list_sessions()` / `admin_get_session_detail(session_id)` 신규
    — 전부 이전과 같은 security definer + 함수 내부 관리자 이메일 확인 패턴, service_role 키 불필요
  - 화면: `AdminTabs`(탭 상태 + 유저/세션 목록 지연 로딩·캐싱 + 모달 상태 관리) 아래 개요/유저 관리/세션 관리
    3개 탭. 개요 탭엔 요약 카드 6개(신규 2개 포함) + 인기 직무/7일 추이/점수 분포 막대그래프 3개.
    유저 관리 탭 행 클릭 → 그 유저의 지난 면접 목록 모달 → 항목 클릭 → 리포트+대화 전문 상세 모달
    (한 단계 더 깊이 열림). 세션 관리 탭은 완료/미완료 토글 + 날짜 범위로 클라이언트 필터링
  - `groupMessagesByRole()`를 `lib/interview/transcript.ts`에 추가해 히스토리 상세 페이지와
    관리자 세션 상세 모달이 메시지→역할별 그룹핑 로직을 공유하도록 정리 (중복 제거)
  - tsc/lint/build 전부 통과 확인 (SessionDetailModal은 `key={sessionId}`로 모달을 다시 마운트시켜
    set-state-in-effect 린트 규칙을 우회 없이 자연스럽게 통과)

### 2026-08-31 (계속 4)
- **관리자 로그인 시 자동 이동**: 로그인 후 일반 유저와 똑같이 면접 화면으로 가던 문제 수정 — `(dashboard)/layout.tsx`에서 로그인한 유저가 `admin@admin.com`이면 곧바로 `/admin`으로 리다이렉트하도록 추가 (주소창에 직접 `/admin`을 쳐야만 갈 수 있던 것을 개선)
- **버그로 오인했던 것 정정**: `/admin`의 "← 오늘의 면접관" 버튼이 클릭해도 제자리로 튕겨 나오는 걸 버그로 보고 한 번 "로그인 시점에만 리다이렉트"로 바꿨다가, 실제 요청은 "관리자는 면접 볼 일이 없으니 그 버튼 자체를 없애라"는 것이었음을 확인 — 레이아웃 강제 리다이렉트(admin이면 `(dashboard)` 그룹 어떤 경로로 와도 항상 `/admin`)로 원복하고, `/admin` 헤더에서 "오늘의 면접관" 링크는 완전히 삭제. `AuthForm`의 로그인 성공 처리도 원래의 단순한 `router.refresh()`로 되돌림 (레이아웃이 알아서 처리하므로 중복 로직 불필요)

### 2026-08-31 (계속 3)
- **관리자 페이지 — 사용 통계 대시보드**
  - 처음 구상했던 "전체 유저 계정/개인정보 열람" 대신, 개인정보 없이 숫자만 다루는 통계 대시보드로 방향 전환 (사용자 피드백 반영)
  - Postgres 함수 `admin_dashboard_stats()`를 `security definer`로 만들어 RLS를 우회해 전체 집계를 계산하되, 함수 안에서 호출자 이메일이 `admin@admin.com`인지 직접 확인 — 이 방식 덕분에 **Supabase service_role 키가 앱 코드에 전혀 필요 없어짐** (기존 계획의 가장 큰 걸림돌이었던 부분 해소)
  - 반환값도 개별 유저 정보 없이 총 가입자 수/총 세션 수/완료된 면접 수/평균 점수/인기 지원 직무 TOP 5/최근 7일 일별 추이만 집계해서 줌
  - `/admin` 페이지 신규 — `user.email === 'admin@admin.com'` 아니면 `/`로 리다이렉트, 통과하면 `supabase.rpc('admin_dashboard_stats')` 호출해 대시보드 렌더링 (스탯 카드 4개 + 인기 직무 막대그래프 + 7일 추이 막대그래프, 차트 라이브러리 없이 순수 CSS로 구현)
  - 관리자 계정은 코드로 생성하지 않고 Supabase 대시보드(Authentication → Users → Add user, Auto Confirm 체크)에서 직접 생성하는 방식으로 안내 — 이 역시 service_role 키 불필요
  - tsc/lint/build 전부 통과 확인 (비로그인 상태 `/admin` 접근 시 307 리다이렉트 curl로 검증)

### 2026-08-31 (계속 2)
- **포트폴리오 PDF 업로드 추가** (선택 사항)
  - `interview_sessions`에 `portfolio_content` 컬럼 추가 — **schema.sql 재실행 필요**
  - `/api/interview/extract-resume`를 `/api/interview/extract-pdf`로 일반화 — 이력서/포트폴리오 둘 다 처리 방식이 동일(PDF를 Claude 문서 입력으로 그대로 읽어 텍스트 추출)해서 `kind: "resume" | "portfolio"` 파라미터로 안내 문구만 다르게 줌
  - 클라이언트 쪽 파일 검증+base64 변환+API 호출 로직을 `lib/interview/extractPdf.ts`로, 업로드 UI(점선 박스+PDF 선택 버튼+상태 문구)를 `PdfUploadStrip` 컴포넌트로 뽑아서 이력서/포트폴리오 둘 다 재사용
  - 이력서는 필수(PDF/텍스트 중 하나), 포트폴리오는 선택 — `canStart`에는 포트폴리오 "분석 중"만 걸리고 존재 여부는 안 걸림
  - 면접관에게는 "포트폴리오 내용: ..."으로 이력서와 구분해서 전달 → 포트폴리오 속 프로젝트를 구체적으로 참고해서 질문 가능
  - tsc/lint/build 전부 통과 확인

### 2026-08-31 (계속)
- **로그인/회원가입 에러 메시지 한글화**
  - Supabase Auth 에러(`Invalid login credentials`, `User already registered` 등)를 `translateAuthError()`로 매핑해 한글로 표시
  - ID/PW 중 어느 쪽이 틀렸는지는 의도적으로 구분하지 않음 — 구분하면 특정 이메일의 가입 여부를 외부에서 알아낼 수 있는 계정 유출(user enumeration) 취약점이 생기기 때문에 Supabase가 원래도 동일한 메시지를 주는 것 (보안 설계를 그대로 존중)
- **리포트 PDF 다운로드**
  - `ReportWithDownload` 컴포넌트 신규 — `ReportCard`를 감싸서 "PDF로 다운로드" 버튼 제공, 면접 종료 화면/`/history/[id]` 상세 페이지 둘 다에서 재사용
  - html2canvas로 화면에 실제 렌더링된 카드를 캡처 → jsPDF로 캡처 크기 그대로 한 페이지 PDF 생성 (A4 강제 맞춤 없이 잘림 방지)
  - 텍스트 기반 PDF(@react-pdf/renderer 등) 대신 스크린샷 방식을 택한 이유: 한글 폰트를 PDF 라이브러리에 별도로 임베드할 필요 없이 현재 테마/디자인을 그대로 재사용할 수 있어서
  - html2canvas/jsPDF는 다운로드 버튼을 누를 때만 동적 import로 불러와 초기 번들 크기에 영향 없음 (빌드 청크 분리 확인)
  - tsc/lint/build 전부 통과 확인
  - **버그**: 실사용 테스트에서 "PDF 생성에 실패했습니다" 발생 — 원인은 Tailwind v4 기본 팔레트(`blue-400` 등)가 `oklch()` 색상 함수를 쓰는데 원조 html2canvas가 이를 파싱하지 못해서였음. `html2canvas-pro`(oklch/oklab/lab/lch 지원 포크)로 교체해서 해결 (앱 스타일링에는 영향 없음, 캡처 도구만 교체)
  - **개선**: PDF에 날짜/직무 헤더와 대화 전문이 안 담긴다는 피드백 반영 — `ReportWithDownload`를 `report` 전용에서 `children`을 받는 범용 `PdfExportSection`으로 일반화하고, 날짜/직무 헤더 + `ReportCard` + `InterviewTranscript`(신규, 대화 전문 렌더링 공통 컴포넌트)를 전부 캡처 영역 안에 넣음 — 면접 종료 화면에도 이제 대화 전문이 함께 보이고 PDF에도 그대로 포함됨
  - 이 김에 `ChatTurn`/`HistoryByRole`/트리거 메시지 판별 로직이 `InterviewChat.tsx`·`report/route.ts`·`history/[id]/page.tsx` 세 곳에 각각 따로 있던 것을 `lib/interview/transcript.ts`로 통합 (중복 제거)
  - **재구성**: 버튼을 우측 상단 고정 + 클릭 시 바로 다운로드하지 않고 체크박스(리포트/대화 내역)로 포함할 내용을 먼저 고른 뒤 다운로드하도록 변경
    - `PdfExportSection`을 `children` 방식에서 `header`/`report`/`transcript` 세 개의 슬롯을 받는 방식으로 재설계
    - 버튼+체크박스 팝오버는 헤더와 같은 줄 우측에 배치, 캡처 직전에만 `visibility: hidden`으로 잠깐 숨겼다가 캡처 후 복원 (React state 리렌더를 기다리지 않고 ref로 직접 DOM 스타일을 건드려서 html2canvas 호출 시점과 동기적으로 맞춤)
    - 리포트/대화 내역도 같은 방식(ref + `style.display`)으로 체크 해제 시 캡처에서 제외

### 2026-08-31
- **지원 직무 필수화 + 이력서 입력 검증 (토큰 낭비 방지)**
  - `canStart = jobRole 있음 && (PDF 추출 텍스트 또는 수기 입력 중 하나 있음) && 분석 중 아님`으로 게이팅
  - "시작하기" 버튼을 `canStart` 기준으로 disabled 처리, 불충족 시 안내 문구 노출
  - 라벨/힌트 텍스트를 "(선택)" → "(필수)"로 변경, PDF/텍스트 둘 중 하나만 있으면 된다는 안내 추가
  - `buildKickoffMessage()`는 이제 직무/이력서가 항상 존재한다고 가정하도록 단순화 (기존 "둘 다 없을 때" 분기 제거 — canStart가 막아주므로 도달 불가능해진 코드)
  - tsc/lint/build 전부 통과 확인
- **히스토리 기록 삭제 기능**
  - `HistorySidebar`의 각 항목 옆에 휴지통 버튼 추가, `window.confirm` 확인 후 `interview_sessions` 행 삭제
  - 스키마에 이미 `on delete cascade`(메시지/리포트)와 `delete_own_sessions` RLS 정책, GRANT delete가 되어 있어서 스키마 변경 없이 프론트만 추가하면 됐음
  - 보고 있던 기록을 삭제하면 홈으로 이동 + `router.refresh()`로 목록 즉시 갱신
- **회원가입 시 실명 입력 → 면접관이 이름 참고**
  - `AuthForm` 회원가입 모드에만 "이름" 입력란 추가, `supabase.auth.signUp`의 `options.data.full_name`(user_metadata)에 저장 — 별도 테이블/스키마 변경 없음
  - `/api/interview` route에서 매 요청마다 `user.user_metadata.full_name`을 읽어 시스템 프롬프트에 "지원자의 이름은 OOO입니다" 문구로 주입
- **로그인 화면 모바일 브랜딩 슬라이드**
  - 브랜딩 패널을 `hidden md:flex`로 완전히 숨기던 것을 없애고, CSS `scroll-snap`만으로 모바일 2패널(브랜딩→폼) 스와이프 캐러셀 구현 (별도 제스처 라이브러리 없이 네이티브 터치 스크롤 사용)
  - md 이상에서는 `md:snap-none md:overflow-visible`로 되돌려 기존 고정 2열 레이아웃 그대로 유지
  - 모바일 브랜딩 슬라이드 하단에 "옆으로 밀어 로그인하기" 힌트 텍스트 추가 (스와이프 발견성 문제 방지)
  - 폼 마크업을 두 번 두지 않고 하나만 유지해서 중복 id 문제 없이 구현
- 위 1~4 항목 전부 tsc/lint/build 통과 확인

### 2026-08-29
- **유저별 면접 히스토리 기능 완성**
  - `interview_reports` 테이블 신규 추가 (session_id unique FK / overall_score / summary / interviewer_feedback jsonb / strengths / improvements), RLS+GRANT까지 schema.sql 반영
  - `/api/interview/report`가 sessionId를 받아 생성한 리포트를 upsert로 저장하도록 수정
  - 로그인 후 화면 전체가 `(dashboard)` 라우트 그룹으로 재구성: `layout.tsx`(인증 분기 + 좌측 사이드바 조회), `page.tsx`(새 면접), `history/[id]/page.tsx`(지난 기록 상세 — 리포트 카드 + 전체 대화)
  - `HistorySidebar` — 로그인 직후부터 항상 왼쪽에 떠 있는 지난 기록 목록, 리포트 있는 세션만 노출
  - PostgREST 임베드가 배열/단일객체 둘 다로 올 수 있어 `firstReport()` 헬퍼로 방어 처리
  - tsc/lint/build 전부 통과 확인
- **디자인 전면 리뉴얼** (기능 로직은 그대로, 스타일만 교체)
  - 순수 중립 팔레트(라이트 #fafafa / 다크 #0a0a0a)로 변경, 오렌지(#f97316) 포인트 컬러로 통일
  - 카드/패널 공통 glassmorphism 적용 (`globals.css`의 `.glass-card` — foreground 기준 color-mix라 라이트/다크 모두 자연스럽게 동작)
  - 로그인 화면: 좌(브랜딩+면접관 3인 뱃지) / 우(폼) 2열 레이아웃으로 재구성
  - 홈 화면: 그라데이션 타이틀 + 면접관 3인 미리보기 카드(기술=blue/인성=green/압박=red, 순차 fade-in)
  - 면접 진행 화면: pill 3개 → 체크 아이콘이 채워지는 스텝 프로그레스 바, 면접관 헤더에 역할별 글로우, 하단 입력바 프로스티드 스티키 처리
  - 리포트 화면: 단일 카드 → Bento grid(점수 링/총평/면접관별 피드백 3칸/강점·보완점)로 재구성, 점수 구간별(초록/주황/빨강) 색상 연동
  - 역할별 아이콘/색상을 `roles.ts`의 `INTERVIEWER_ICON`/`INTERVIEWER_ACCENT`로 중앙화 (Tailwind가 소스에 리터럴로 없는 클래스는 생성 못 하는 문제 때문에 `hover:bg-blue-400` 같은 조합형 클래스도 전부 완성된 문자열로 미리 정의)
  - Tailwind 사용 상태 점검: 인라인 style 전무, `globals.css` 하나로만 관리되는 것 확인 — 별도 정리 불필요
  - 프로덕션 빌드 CSS에서 신규 클래스(`hover:bg-blue-400` 등) 실제 생성 여부까지 grep으로 검증

### 2026-08-29 (계속)
- **모바일 반응형 레이아웃 수정**
  - 타이틀/서브타이틀 폰트 반응형(`text-3xl md:text-4xl lg:text-5xl`), 전반적인 패딩/여백 모바일 축소
  - 사이드바를 모바일에서 드로어로 전환 — `DashboardChrome` 클라이언트 컴포넌트가 햄버거 버튼+오버레이+열림 상태를 관리, `HistorySidebar`는 isOpen/onClose props로 열림 애니메이션만 담당
  - 면접관 3인 미리보기 카드: 모바일 가로 배치, md 이상 세로 배치
  - 스텝 인디케이터: 모바일에서 라벨 숨기고 순번만 표시
  - 리포트 Bento grid, 로그인 2열 레이아웃 브레이크포인트를 sm→md로 통일
  - 홈 화면 입력 폼 카드 너비를 면접관 3인 카드 줄 너비(max-w-2xl)에 맞춤
  - 지난 기록 상세 페이지의 대화 말풍선 폭(85% 제한)을 위쪽 리포트 Bento grid와 맞춰 컨테이너 전체 폭으로 변경
- **기본 테마 다크모드 + 로그인 화면 테마 토글 + 토글 버튼 크기 조정**
  - `ThemeToggle` 기본값을 다크로 고정 (localStorage에 저장된 값이 있으면 그 값 우선) — 처음엔 라이트로 잘못 적용했다가 다크로 정정
  - 로그인 화면(`AuthForm`)은 별도 헤더가 없어 토글이 아예 없었음 — 우측 상단에 고정 배치로 추가
  - 토글/로그아웃/햄버거 버튼이 작아서 잘 안 보인다는 피드백 반영 — h-9→h-11로 확대 (아이콘도 h-4→h-5)

### 2026-08-26
- Supabase Auth 로그인/회원가입 추가 (AuthForm, LogoutButton), page.tsx에서 서버 사이드로 로그인 분기
- Next.js 16 대응: middleware.ts → proxy.ts로 전환 (파일명/함수명만 변경, 기능 동일) — 세션 쿠키 자동 갱신
- interview_sessions에 user_id 컬럼 추가, RLS를 "본인 세션만" 정책으로 전면 교체
- 세 API 라우트(/api/interview, /extract-resume, /report) 전부 인증 체크 추가 — 비로그인 직접 호출 401 확인
- curl로 비로그인 상태 API 차단 + 홈 화면 로그인 폼 렌더링 검증 완료
- 남은 확인: 실제 회원가입→로그인→면접 진행→DB user_id 저장까지는 브라우저에서 직접 테스트 필요 (이메일 확인 설정에 따라 흐름이 달라질 수 있음)

### 2026-08-25 (계속 2)
- PDF 업로드 구조 재설계: 추출 내용을 텍스트박스에 넣지 않고 `resumeFileText`로 별도 보관, 수기 입력(`resumeContent`)과는 완전히 분리
- 면접관에게는 두 소스를 합친 `combinedResumeContent`를 전달 — 실제로 수기 입력+PDF 내용 둘 다 반영되는지 curl로 검증 완료 (두 정보의 차이까지 짚어서 질문함)
- "시작하기" 버튼을 이력서 분석 중(isExtractingResume)에는 비활성화 — 분석 완료 후에만 면접 시작 가능
- 컬럼명 resume_summary → resume_content 변경, Supabase RENAME COLUMN + PostgREST 스키마 캐시 이슈 대응(NOTIFY pgrst 안내)

### 2026-08-25 (계속)
- 버그 수정: job_role/resume_summary 컬럼을 Supabase에 반영 안 해서 /api/interview 500 에러 나던 문제 — schema.sql 재실행으로 해결
- 프론트: 서버 에러(non-ok 응답, 스트리밍 도중 에러) 발생 시 채팅창에 바로 표시하도록 개선 (이전엔 조용히 멈춤)
- 이력서 PDF 업로드 기능 추가 — `/api/interview/extract-resume`, Claude의 document 입력으로 직접 읽음 (OCR 라이브러리 불필요), 업로드하면 이력서 요약 칸이 자동으로 채워짐 (수정 가능)
- 핸드메이드 테스트 PDF로 추출 기능 실제 검증 완료

### 2026-08-25
- 이력서/직무 입력 폼 추가 (시작 화면, 선택 입력) — 입력 시 첫 질문 kickoff 메시지에 반영
- 면접관 전환 시 sessionId를 새로 만들지 않고 유지하도록 변경 (세션 하나 = 면접 한 판 전체)
- interview_sessions에 job_role/resume_summary 컬럼 추가
- `/api/interview/report` 신규 — zod 스키마 + `output_config.format`으로 구조화된 평가 리포트 생성 (종합점수/총평/면접관별피드백/강점/보완점)
- "면접 마치기" 클릭 시 자동으로 리포트 생성 → 종료 화면에 카드로 표시
- 실제 curl 테스트로 리포트 API 정상 작동 확인
- Vercel 배포는 후순위로 미루기로 결정 (코드에 영향 없음, 사용자 확인됨)
- next.config.ts에 devIndicators: false 추가 (개발 모드 좌하단 N 배지 제거)

### 2026-08-24 (계속)
- 엔드투엔드 실사용 테스트 완료 — Anthropic API 결제 후 실제 스트리밍 호출, Supabase insert까지 curl로 검증
- Supabase "Automatically expose new tables" 꺼둔 상태라 anon 권한 GRANT 별도 실행 필요했음 (schema.sql에 반영)
- 버그: "다음 면접관으로" 전환 시 첫 질문을 안 받아와서 화면이 비어 보이던 문제 수정 (`startInterviewer` 공용 함수로 리팩터링)
- 브랜딩: 여러 후보(3개의 관문, 면접관은 셋 등) 검토 후 "오늘의 면접관"으로 확정, 부제 "기술을 묻고, 사람을 보고, 압박을 견딘다"
- 면접 종료 화면에 "홈으로 돌아가기" 버튼 추가

### 2026-08-24
- Next.js(App Router) + TypeScript + Tailwind CSS v4로 프로젝트 스캐폴딩
- 웜 뉴트럴 + 테라코타 포인트 컬러 디자인 시스템 적용, 라이트/다크 토글 구현
  - `ThemeToggle`은 React state 대신 ref로 DOM 직접 조작 — set-state-in-effect 린트 규칙 위반 및 하이드레이션 불일치 방지
- Supabase 클라이언트(브라우저용 `lib/supabase/client.ts`, 서버용 `lib/supabase/server.ts`) 작성
- `interview_sessions` / `interview_messages` 테이블 스키마 작성 (`supabase/schema.sql`), 현재는 RLS 전체 허용 정책(임시)
- Anthropic Claude API(`claude-sonnet-5`) 연동 — 면접관 3명(기술/인성/압박) 역할별 system prompt 분리 (`lib/interview/roles.ts`)
- `/api/interview` Route Handler — Claude 스트리밍 응답을 SSE로 중계 + 완료 시 Supabase에 대화 기록 저장
- 프론트 `InterviewChat` 컴포넌트 — 면접관 순회 UI, 실시간 스트리밍 렌더링, 반응형 레이아웃
- lint / 타입체크 / 프로덕션 빌드 통과 확인

## 다음 할 일

- **관리자 페이지 후속 기능 (선택)** — 사용 통계 대시보드는 완료됨. 필요하면 다음 중에서 추가로 선택 가능: Claude API 사용량/비용 모니터링, 면접관 프롬프트를 DB로 옮겨 관리자가 직접 수정, 시스템 상태(DB 연결/에러 로그) 확인
  - 계정 정보: `admin@admin.com` / `admin1234` (Supabase 대시보드에서 Auto Confirm으로 직접 생성 완료 필요 — 아직 안 만들었다면 로그인 전 이 계정부터 생성)
- STT/TTS 음성 입출력 (Web Speech API, 브라우저 무료, Chrome/Edge만 안정적)
  - STT(`SpeechRecognition`): 음성 답변 → 입력창 텍스트 자동 변환
  - TTS(`SpeechSynthesis`): 면접관 질문 음성으로 읽어주기
  - 주의: STT는 Chrome/Edge 계열만 안정적 지원, Firefox/Safari 불안정 — 데모는 크롬 기준으로
- Vercel 배포 (최후순위로 미뤄둠)
