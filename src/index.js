/** @jsx Didact.createElement */

function Counter() {
  const [count, setCount] = Didact.useState(0);
  const [other, setOther] = Didact.useState(0);

  // 케이스 1: 마운트 시 딱 한 번!
  Didact.useEffect(() => {
    console.log("✅ [Mount Only] 처음 한 번만 실행되어야 함");
    return () =>
      console.log("🧹 [Unmount Only] 컴포넌트가 사라질 때만 실행되어야 함");
  }, []);

  // 케이스 2: count가 바뀔 때만!
  Didact.useEffect(() => {
    console.log(`🚀 [Count Update] 실행! 현재 값: ${count}`);
    return () =>
      console.log(`🧼 [Count Cleanup] 이전 값(${count}) 치우는 중...`);
  }, [count]);

  return (
    <div style="border: 2px solid #ccc; padding: 10px;">
      <h2>useEffect 테스트</h2>
      <p>카운트: {count}</p>
      <button onClick={() => setCount((c) => c + 1)}>
        Count 증가 (이펙트 발생)
      </button>

      <p>다른 상태: {other}</p>
      <button onClick={() => setOther((o) => o + 1)}>
        Other 증가 (이펙트 미발생)
      </button>
    </div>
  );
}

function App() {
  const [show, setShow] = Didact.useState(true);

  return (
    <div>
      <h1>Didact Engine Test Lab</h1>
      <button onClick={() => setShow(!show)}>
        {show
          ? "자식 컴포넌트 제거 (언마운트)"
          : "자식 컴포넌트 살리기 (마운트)"}
      </button>
      <hr />
      {show ? <Counter /> : <p>컴포넌트가 소멸되었습니다.</p>}
    </div>
  );
}

// 컴포넌트를 태그처럼 사용(Babel이 처리)
/* 다음과 같은 형식으로 저장된다.
{
  type: App,
  props: {
    name: "민재",
    children: [],
  }
}
*/

const root = document.getElementById("root");
Didact.render(<App />, root);
