/** @jsx Didact.createElement */

// 1. 컨텍스트 생성 (기본값: "🏃 기본 모드")
const ThemeContext = Didact.createContext("🏃 기본 모드");

// 2. 최하위 자식 컴포넌트 (구독자)
function DeepChild() {
  const theme = Didact.useContext(ThemeContext);
  return (
    <div style="border: 1px solid #ccc; padding: 10px; margin-top: 10px;">
      <h4>최하위 자식 (DeepChild)</h4>
      <p>
        현재 테마: <strong>{theme}</strong>
      </p>
    </div>
  );
}

// 3. 중간 컴포넌트 (단순 전달)
function Intermediate() {
  return (
    <div style="background: #f9f9f9; padding: 10px;">
      <h3>중간 컴포넌트</h3>
      <DeepChild />
    </div>
  );
}

// 4. 최상위 앱 컴포넌트 (공급자)
function App() {
  const [count, setCount] = Didact.useState(0);
  const theme = count % 2 === 0 ? "☀️ 라이트 모드" : "🌙 다크 모드";

  // 고의로 메인 스레드를 500ms 동안 차단하는 함수
  const blockMainThread = () => {
    const start = performance.now();
    // 500ms 동안 빈 루프를 돌며 브라우저의 메인 스레드를 독점합니다.
    while (performance.now() - start < 500) {
      // 아무것도 안 함 (동기적 차단)
    }
    setCount((c) => c + 1);
  };

  return (
    <div>
      <h1>Didact Context Test</h1>
      
      {/* 일반 전환 버튼 */}
      <button onClick={() => setCount((c) => c + 1)}>
        일반 전환 (클릭 횟수: {count})
      </button>

      {/* 렉 유발 버튼 */}
      <button
        onClick={blockMainThread}
        style="margin-left: 10px; background: red; color: white; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px;"
      >
        500ms 렉 유발 후 전환
      </button>

      <hr />

      {/* 상황 A: Provider 내부에 있는 경우 - theme 전달 */}
      <section>
        <h2>A. Provider 내부</h2>
        <ThemeContext.Provider value={theme}>
          <Intermediate />
        </ThemeContext.Provider>
      </section>

      <hr />

      {/* 상황 B: Provider 외부에 있는 경우 - 기본값 출력 확인 */}
      <section>
        <h2>B. Provider 외부</h2>
        <Intermediate />
      </section>
    </div>
  );
}

const container = document.getElementById("root");
Didact.render(<App />, container);
