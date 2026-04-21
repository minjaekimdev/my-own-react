/** @jsx Didact.createElement */

function MemoTestApp() {
  const [count, setCount] = Didact.useState(0);
  const [other, setOther] = Didact.useState(0);

  // 1. 비싼 연산을 시뮬레이션 (의존성: count)
  const expensiveValue = Didact.useMemo(() => {
    console.log("🚀 [계산 중...] 1부터 1000까지 더하는 중 (비싼 작업)");
    let sum = 0;
    for (let i = 0; i <= 1000; i++) sum += i;
    return sum + count;
  }, [count]);

  return (
    <div style="padding: 20px; border: 1px solid #444;">
      <h2>useMemo 검증 테스트</h2>
      
      <div style="background: #f9f9f9; padding: 15px; border-radius: 5px;">
        <p>📊 의존성 있는 값(Count): <strong>{count}</strong></p>
        <p>📈 연산 결과: <strong>{expensiveValue}</strong></p>
        <p>🔄 무관한 상태(Other): <strong>{other}</strong></p>
      </div>

      <div style="margin-top: 20px;">
        <button onClick={() => setCount(c => c + 1)}>
          1. Count 증가 (연산 재실행 필요)
        </button>
        <button onClick={() => setOther(o => o + 1)} style="margin-left: 10px;">
          2. Other 증가 (연산 생략되어야 함)
        </button>
      </div>

      <p style="font-size: 14px; color: #666; margin-top: 15px;">
        * 버튼 2를 누를 때 콘솔에 <strong>"🚀 [계산 중...]"</strong>이 뜨지 않아야 합격입니다!
      </p>
    </div>
  );
}

const root = document.getElementById("root");
Didact.render(<MemoTestApp />, root);