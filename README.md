# my-own-react (Didact)

리액트의 핵심 개념인 **Fiber 아키텍처와 Hooks를 바닐라 JavaScript로 직접 구현해보는 학습 프로젝트**입니다.
빌드 도구나 의존성 없이, 약 630줄의 단일 파일(`src/didact.js`)로 동작하는 미니 리액트를 만들었습니다.

> "만들어 보는 것"이 목표이기 때문에, 실제 리액트 소스(`ReactFiberHooks.js` 등)와 나란히 놓고 비교하며 학습하는 것을 원칙으로 합니다.

## 구현된 기능

### 코어
- **`createElement`** — JSX를 객체 트리(가상 DOM)로 변환합니다. `/** @jsx Didact.createElement */` 프라그마로 Babel이 리액트 대신 이 함수를 호출하게 만듭니다.
- **Fiber 기반 렌더링** — 각 엘리먼트를 "파이버"라는 작업 단위로 쪼개어, 브라우저가 한가할 때(`requestIdleCallback`) 조금씩 처리합니다. 이 덕분에 렌더링 도중에도 화면이 끊기지 않습니다.
- **재조정(Reconciliation)** — 이전 파이버 트리와 새 파이버 트리를 `type` 기준으로 비교(diffing)해서, 바뀐 부분만 실제 DOM에 반영합니다. 타입이 같으면 기존 DOM 노드를 재사용하는 것이 성능 최적화의 핵심입니다.
- **Commit 단계** — Render(계산)와 Commit(DOM 반영)을 분리했습니다. 계산이 모두 끝난 뒤에 한 번에 DOM을 갱신해 깜빡임을 방지합니다.

### Hooks
모든 훅은 리액트와 동일하게 **"호출 순서"에 의존하는 4줄 패턴**으로 구현했습니다.
`① 이전 훅 조회(oldFiber.alternate) → ② 훅 생성/이어받기 → ③ wipFiber에 등록 → ④ 값 반환`

- `useState` — action 큐잉, 함수형 업데이트(`setCount(c => c + 1)`) 지원
- `useEffect` — deps 얕은 비교, cleanup 라이프사이클, 페인트 후 실행
- `useRef` — 리렌더 간 동일 객체 보장
- `useMemo` — deps 기반 값 캐싱
- `createContext` / `useContext` — 부모 방향 순회로 가장 가까운 Provider 탐색

## 데모로 확인할 수 있는 것

`index.js`의 데모는 두 가지를 보여줍니다.

1. **Context 전파** — Provider 내부/외부에서 `useContext`가 어떻게 다르게 동작하는지
2. **Fiber의 시간 분할** — 메인 스레드를 500ms 동안 고의로 막는 버튼을 눌러, 일반적인 동기 렌더링과의 차이를 체감

## 실행 방법

빌드 과정이 없습니다. JSX를 브라우저에서 Babel standalone이 실시간으로 변환합니다.

```bash
# 아무 정적 서버나 사용 (예: npx serve)
npx serve .

# 브라우저에서 http://localhost:3000 접속
```

`index.html`을 더블클릭해 파일로 열어도 동작합니다.

## 파일 구조

```
my-own-react/
├── index.html          # 진입점. Babel standalone으로 JSX 트랜스파일
├── src/
│   ├── didact.js       # 미니 리액트 본체 (createElement, fiber, hooks 전부)
│   └── index.js        # 데모 앱 (Context + 렉 유발 테스트)
└── HOOK_ROADMAP.md     # 앞으로 구현할 훅들의 로드맵
```

## 학습 로드맵

현재 구현에는 한계도 명확히 남아 있습니다(인덱스 기반 재조정이라 `key`가 없고, Context 변경 시 전체가 리렌더됨 등).
앞으로 `useReducer`, `useCallback`, `useLayoutEffect`, key 기반 재조정, 우선순위(lane) 시스템까지 확장할 계획입니다.

자세한 단계별 계획은 **[HOOK_ROADMAP.md](./HOOK_ROADMAP.md)**를 참고하세요.

## 참고

이 프로젝트는 Rodrigo Pombo의 ["Build Your Own React"](https://pomb.dev/build-your-own-react) ([didact 저장소](https://github.com/pomber/didact)) 아이디어를 바탕으로, 실제 리액트 내부 구현을 학습하며 확장했습니다.
