# Hook 구현 로드맵 — My Own React (Didact)

> 현재 `didact.js` 구조가 확장 가능하다고 검증한 결과를 바탕으로,
> 리액트의 핵심 훅을 **구현 난이도와 의존 관계 순서**로 정리한 문서.
> 각 항목은 [목표] → [구현 포인트] → [검증 방법] 순서로 체크할 것.

**난이도**: ★☆☆ 쉬움 / ★★☆ 중간 / ★★★ 어려움
**상태**: ✅ 완료 / 🚧 진행 중 / ⬜ 미착수

---

## 0. 이미 완료된 훅 (패턴의 원형)

이 아래 훅들은 모두 **같은 4줄 패턴**으로 구현됨 — 이 패턴이 모든 훅의 공통 인프라.

```
① oldHook 조회   → wipFiber.alternate.hooks[hookIndex]
② hook 객체 생성 → oldHook이 있으면 이어받고, 없으면 초기화
③ 훅 등록        → wipFiber.hooks.push(hook); hookIndex++
④ 값 반환        → (상태/참조/캐시)
```

- [x] ✅ `useState` — action 큐잉 + 함수형 업데이트 (`typeof action === "function"`)
- [x] ✅ `useEffect` — deps 얕은 비교, cleanup 라이프사이클, 페인트 후 실행(setTimeout)
- [x] ✅ `useRef` — 리렌더 간 동일 객체 보장 (oldHook 재사용)
- [x] ✅ `useMemo` — deps 기반 캐시
- [x] ✅ `useContext` — 부모 방향 순회로 가장 가까운 Provider 탐색
- [ ] 🚧 `useDeepMemo` — 깊은 비교 함수(`hadDeepChangeDeps`) 미구현 상태. 지금은 useMemo와 동일하게 동작

---

## 1단계: useState 패턴 일반화 (기존 코드 복사 수준)

### 1-1. `useReducer(reducer, initialState)` ★☆☆ ⬜

- **목표**: useState의 큐 처리부를 사용자 정의 reducer로 일반화
- **구현 포인트**
  - [ ] useState의 `typeof action === "function" ? action(hook.state) : action` 부분을 `reducer(hook.state, action)`으로 교체
  - [ ] 리액트는 useState를 "reducer에 `basicStateReducer`를 쓰는 useReducer"로 구현함을 확인
    ```js
    // 실제 리액트 소스 (ReactFiberHooks.js)
    function basicStateReducer(state, action) {
      return typeof action === "function" ? action(state) : action;
    }
    ```
  - [ ] useState를 useReducer 위에 얹어 리팩토링하는 방향도 고려
- **검증**: dispatch 여러 번 연속 호출 시 순서대로 체인 적용되는지, deps 없이 매 렌더 새 함수가 와도 큐가 정상 동작하는지

### 1-2. `useCallback(fn, deps)` ★☆☆ ⬜

- **목표**: 함수 자체를 deps 기반으로 캐시 (useMemo와 로직 100% 동일)
- **구현 포인트**
  - [ ] useMemo 복사 후 `hook.value = callback()` 대신 `hook.value = callback` 저장
- **검증**: deps가 같으면 리렌더 후에도 `prev === next` 참조 동일성 유지되는지 (React.memo 흉내 내는 데모에 사용 가능)

---

## 2단계: 커밋 단계 확장 — "페인트 전" 이펙트

### 2-1. `useLayoutEffect` ★★☆ ⬜

- **목표**: 브라우저 페인트 **전에** 동기 실행되는 이펙트 (didact의 useEffect는 페인트 후)
- **구현 포인트**
  - [ ] `fiber.effects` 외에 `fiber.layoutEffects` 배열을 별도 수집
  - [ ] `commitRoot` 안에서 DOM 갱신(`commitWork`) 직후, `setTimeout` 이전에 동기 실행
    - commitRoot는 이미 동기 함수라 "페인트 전" 삽입 지점이 자연스럽게 존재
  - [ ] useEffect와 deps 비교/클린업 로직 공유 (공통 헬퍼로 추출 권장)
- **학습 포인트**: 리액트의 커밋 3단계(mutation → layout → paint → passive) 구조가 왜 필요한지 몸으로 익히기
- **검증**: layoutEffect 안에서 DOM 측정(`getBoundingClientRect`) + 위치 보정 시 깜빡임이 없는지, useEffect와 실행 순서(레이아웃이 먼저) 로그로 확인

### 2-2. `useImperativeHandle(ref, createHandle, deps)` ★★☆ ⬜ (2-1 의존)

- **목표**: 부모가 넘긴 ref에 "노출하고 싶은 메서드만" 커스터마이징해서 할당
- **구현 포인트**
  - [ ] useLayoutEffect의 인프라 재사용 (리액트도 내부적으로 layout effect로 구현)
  - [ ] `ref.current = createHandle()` 할당
- **검증**: 자식 컴포넌트가 `focus()` 같은 메서드만 노출하고, 부모가 ref로 호출 가능한지

---

## 3단계: 구현 전 인프라 정비 (훅이 아니라 코어 작업)

### 3-1. 기존 버그 수정 ★★☆ ⬜

- [ ] **삭제된 서브트리 클린업 누락** — `runEffects`가 `deletions`의 최상위 파이버 클린업만 실행함. 삭제된 자손 컴포넌트들의 cleanup도 재귀로 실행하도록 수정 (리액트: `commitPassiveUnmountEffectsInsideOfDeletedTree`)
- [ ] **`hook.cleanup()` null 가드** — cleanup을 반환하지 않는 이펙트에서 TypeError 방지 (코드 주석에 TODO 존재)
- [ ] **렌더 중 setState 무한루프 방지** — render 단계에서 상태가 안 바뀌는 업데이트면 재시도 횟수 제한(리액트는 ~25회) 도입
- [ ] **훅 순서 검증(dev 경고)** — old/new hooks 개수 비교. "훅은 최상위에서만 호출" 규칙이 왜 존재하는지 경고 메시지로 체감
- [ ] `useDeepMemo`의 `hadDeepChangeDeps` 완성 (배열/객체 재귀 비교) 또는 제거

### 3-2. `key` 기반 리스트 재조정 ★★☆ ⬜

- **목표**: 현재 `reconcileChildren`은 **인덱스 위치로만** old/new 매칭 → 리스트 재정렬 시 상태가 엉뚱한 항목에 붙음
- **구현 포인트**
  - [ ] createElement에서 `key` 추출 (children이 아니라 props 레벨)
  - [ ] reconcileChildren에 key → oldFiber 매칭 맵 추가 (리액트: `Map`에 oldFiber들 담아 key로 조회)
  - [ ] 이동(재정렬) 시 `appendChild`가 아니라 `insertBefore` 필요 → commitWork의 PLACEMENT 처리 확장
- **왜 중요**: 훅 상태의 정체성(alternate 매칭)이 위치 기반이므로, key가 없으면 리스트 아이템의 state/useEffect가 전부 섞임
- **검증**: key 없는 리스트 vs key 있는 리스트에서 입력값/상태가 어떻게 섞이는지 비교 데모

---

## 4단계: 리액트 최신 훅들

### 4-1. `useSyncExternalStore(subscribe, getSnapshot)` ★★☆ ⬜ (3-1 의존)

- **목표**: 리액트 외부의 상태(외부 스토어)를 훅으로 구독
- **구현 포인트**
  - [ ] mount 시 `subscribe` 등록, unmount 시 해제 (이펙트 인프라 사용)
  - [ ] 스토어 변경 감지 → 기존 setState의 리렌더 트리거 재사용
  - [ ] getSnapshot 값이 렌더 사이에 변했는지 비교(tearing 방지 개념 소개)
- **검증**: 바닐라 JS 이벤트 이미터를 만들고 구독해 리렌더되는 데모

### 4-2. `useId` ★★☆ ⬜ (3-2 의존 권장)

- **목표**: 클라이언트/서버 간 일관된 고유 id 생성
- **구현 포인트**
  - [ ] 렌더 순회 중 파이버 트리 위치 기반 id 카운터 (예: `:r0`, `:r1`)
  - [ ] key가 있어야 트리 구조가 바뀌어도 id가 안정적으로 유지됨
- **검증**: label htmlFor 연결 데모

### 4-3. Context의 구독 기반 리렌더 ★★★ ⬜

- **목표**: 현재는 매 업데이트마다 루트부터 전체 리렌더되어 useContext가 동작함. "값이 바뀐 Provider 아래의 소비자만" 리렌더하도록 개선
- **구현 포인트**
  - [ ] Provider value 변경 감지
  - [ ] 소비자(Provider 아래에서 useContext를 호출한 파이버) 추적/마킹
  - [ ] 해당 서브트리만 리렌더 스케줄링
- **검증**: Provider 밖 컴포넌트가 리렌더되지 않음을 렌더 카운터로 확인

---

## 5단계 (도전 과제): 우선순위 렌더링 — Concurrent의 핵심

### 5-1. 우선순위(lane) 시스템 도입 ★★★ ⬜

- **목표**: 긴급 업데이트가 오면 진행 중인 낮은 우선순위 렌더를 버리고 재시작
- **지금 구조의 한계**: `nextUnitOfWork` 하나, `wipRoot` 하나인 단일 트랙. setState가 wipRoot를 통째로 교체(469번 줄)하며 우선순위 개념이 없음
- **구현 포인트**
  - [ ] 업데이트에 우선순위 필드 부여 (긴급: 클릭 / 낮음: 전환)
  - [ ] workLoop가 렌더 중 더 높은 우선순위 업데이트 감지 → 현재 렌더 폐기 후 재시작
  - [ ] 렌더가 중단 가능하려면 함수 컴포넌트 재호출이 멱등(같은 입력 → 같은 결과)해야 함을 이해
- **검증**: index.js의 "500ms 렉 유발" 데모를 우선순위 버전으로 개선

### 5-2. `useTransition` / `useDeferredValue` ★★★ ⬜ (5-1 의존)

- **목표**: 상태 업데이트에 "긴급하지 않음" 표시 → 렌더를 낮은 우선순위로 지연
- **구현 포인트**
  - [ ] 5-1의 lane 시스템 위에 두 개의 업데이트 채널 구성
  - [ ] `isPending` 플래그 훅 (transition 진행 중 표시)
- **검증**: 검색 입력 + 무거운 리스트 필터링 데모에서 타이핑이 끊기지 않는지 확인

---

## 진행 요약

| 순서 | 항목 | 난이도 | 의존 | 상태 |
|---|---|---|---|---|
| ✅ | useState / useEffect / useRef / useMemo / useContext | - | - | 완료 |
| 1-1 | useReducer | ★☆☆ | - | ⬜ |
| 1-2 | useCallback | ★☆☆ | - | ⬜ |
| 2-1 | useLayoutEffect | ★★☆ | - | ⬜ |
| 2-2 | useImperativeHandle | ★★☆ | 2-1 | ⬜ |
| 3-1 | 버그 수정 (클린업 누락, null 가드, 렌더 중 setState) | ★★☆ | - | ⬜ |
| 3-2 | key 기반 reconcile | ★★☆ | - | ⬜ |
| 4-1 | useSyncExternalStore | ★★☆ | 3-1 | ⬜ |
| 4-2 | useId | ★★☆ | 3-2 | ⬜ |
| 4-3 | Context 구독 기반 리렌더 | ★★★ | 3-2 | ⬜ |
| 5-1 | 우선순위(lane) 시스템 | ★★★ | 3-2 | ⬜ |
| 5-2 | useTransition / useDeferredValue | ★★★ | 5-1 | ⬜ |

> **원칙**: 매 단계마다 실제 리액트 소스(`ReactFiberHooks.js`)의 대응 함수와 나란히 놓고 비교하기.
> 훅 → `mountState`/`updateState`, 이펙트 → `commitPassiveMountEffects`, 스케줄링 → `Scheduler.js`
