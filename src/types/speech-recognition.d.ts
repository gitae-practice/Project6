// TypeScript의 기본 lib.dom.d.ts에는 SpeechRecognitionResult 등 결과 타입만 있고
// SpeechRecognition 본체(웹 음성 인식 API)는 아직 표준 타입에 없어서 직접 선언해준다.
// (Chrome/Edge는 webkitSpeechRecognition이라는 접두사 붙은 이름으로 window에 노출한다)
// 참고: https://developer.mozilla.org/docs/Web/API/SpeechRecognition

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  // 마이크가 오디오를 캡처하기 시작/끝났는지(onaudiostart/end), 그 안에서 "말소리"로 보이는
  // 신호를 감지했는지(onspeechstart/end)까지 단계별로 알 수 있어서, "듣고는 있는데 인식이 안
  // 된다"는 문제가 마이크 자체 문제인지, 인식 엔진(네트워크) 문제인지 구분하는 데 쓴다.
  onaudiostart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => void) | null;
}

declare const SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

interface Window {
  SpeechRecognition?: typeof SpeechRecognition;
  webkitSpeechRecognition?: typeof SpeechRecognition;
}
