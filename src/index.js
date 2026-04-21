/** @jsx Didact.createElement */

function SimpleRefTest() {
  // 1. 일반 값 보관용 Ref
  const countRef = Didact.useRef(0);
  // 2. DOM 접근용 Ref
  const inputRef = Didact.useRef(null);
  
  const [renderCount, setRenderCount] = Didact.useState(0);

  const handleRefClick = () => {
    countRef.current += 1;
    console.log("📦 현재 Ref 값:", countRef.current);
    alert(`Ref 값을 ${countRef.current}로 올렸습니다. 하지만 화면은 그대로일 거예요!`);
  };

  const handleFocus = () => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.style.backgroundColor = "#fffbe6";
      console.log("🎯 DOM 접근 성공!");
    } else {
      console.error("❌ DOM이 아직 연결되지 않았습니다.");
    }
  };

  return (
    <div style="padding: 20px; border: 2px solid #333; border-radius: 10px;">
      <h2>useRef 기본 동작 테스트</h2>

      <section style="margin-bottom: 20px; padding: 10px; background: #f0f0f0;">
        <h4>1. 값 보존 테스트</h4>
        <p>현재 화면의 Ref Value: <strong>{countRef.current}</strong></p>
        <p>리렌더링 횟수: <strong>{renderCount}</strong></p>
        
        <button onClick={handleRefClick}>Ref 숫자 올리기</button>
        <button onClick={() => setRenderCount(c => c + 1)}>화면 강제 업데이트 (State)</button>
      </section>

      <section style="padding: 10px; background: #e6f7ff;">
        <h4>2. DOM 접근 테스트</h4>
        <input ref={inputRef} placeholder="여기에 포커스가 가나요?" style="padding: 5px;" />
        <button onClick={handleFocus} style="margin-left: 10px;">포커스 & 배경색 변경</button>
      </section>
    </div>
  );
}

const root = document.getElementById("root");
Didact.render(<SimpleRefTest />, root);