/**
 * 생성 함수들
 */
// 가상 DOM 노드 생성
/*
<div>
  <h1>Title</h1>
  Hello
</div>

-> 변환된 createElement 호출
createElement("div", null, 
  createElement("h1", null, "Title"),
  "Hello"                             
);
*/
function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      // 자식이 객체(엘리먼트)면 그대로, 문자열이면 텍스트 엘리먼트로 변환
      children: children.map((child) =>
        typeof child === "object" ? child : createTextElement(child),
      ),
    },
  };
}

function createTextElement(text) {
  return {
    type: "TEXT_ELEMENT",
    props: {
      nodeValue: text,
      children: [],
    },
  };
}

// fiber 객체의 정보를 바탕으로 실제 DOM 노드 인스턴스를 생성한다
function createDom(fiber) {
  const dom =
    fiber.type == "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type);

  // 속성(props) 부여
  // children은 제외하고 태그 자체의 속성을 입혀준다.
  const isProperty = (key) => key !== "children";
  Object.keys(fiber.props)
    .filter(isProperty)
    .forEach((name) => {
      if (name.startsWith("on")) {
        const eventName = name.toLowerCase().substring(2);
        dom.addEventListener(eventName, fiber.props[name]);
      } else {
        dom[name] = fiber.props[name];
      }
    });

  return dom;
}

/**
 * 전역 변수들
 */
// 처리할 작업 단위가 없을 때만 null
let nextUnitOfWork = null;

// 현재 작업중인 루트 파이버를 추적한다.
// 공사가 다 끝났을 때(nextUnitOfWork 가 null이 되었을 때) 트리의 꼭대기로 돌아가 한번에 반영해야 함(Commit)
let wipRoot = null;

// 현재 시점의 실제 DOM과 일치하는 파이버 트리의 루트
let currentRoot = null;

// currentRoot에는 있었지만, wipRoot에는 사라진 파이버들을 모아두는 배열
let deletions = null;

// hook 처리를 위해 현재 작업 중인 파이버를 추적한다.
// updateFunctionComponent가 실행될 때만 최신화한다.
let wipFiber = null;
// 한 컴포넌트 내에서 호출되는 hook들을 구분하기 위한 인덱스
// fiber.alternate에서 같은 hook을 찾기 위함이다.(useState 함수 내부에서는 자신이 몇 번째인지 확인 불가)
let hookIndex = 0;

/**
 * 작업 루프 함수
 */
// workLoop를 통해 브라우저가 한가한 경우 작업을 실행한다.
function workLoop(deadline) {
  let shouldYield = false;
  // 처리해야 할 작업 단위가 존재하고, 시간이 충분할 때(프레임 잔여 시간이 1ms 이상일 때)
  // 브라우저의 상태를 보면서 일을 시킬지 말지 결정한다.
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);

    // deadline.timeRemaining(): 지금부터 화면을 그리기까지 정확히 몇 밀리초가 남았는지 알려준다.
    shouldYield = deadline.timeRemaining() < 1;
  }
  if (!nextUnitOfWork && wipRoot) {
    // 모든 처리가 완료되었고 wipRoot가 생성되었다면
    commitRoot(); // 추가 예정
  }
  requestIdleCallback(workLoop);
}
// 브라우저가 1프레임(16.6ms)동안 할 일들을 처리하고 난 뒤 시간이 남으면 workLoop을 실행하도록 처리
// workLoop 호출 시 deadline 객체를 알아서 넣어준다.
// 실제 리액트 팀에서는 저수준 API를 조합해서 만든 Scheduler 패키지를 별도로 운용하지만, 아이디어는 동일하다.
requestIdleCallback(workLoop);

/**
 * Render Phase 핵심 함수들
 */
// diffing을 실행한다.
// elements(children)에 대한 fiber를 생성하고, 이들과 wipFiber의 부모 관계를 연결한다.
// children 간의 sibling 관계도 연결한다(1 -> 2 단방향)
function reconcileChildren(wipFiber, elements) {
  let index = 0;
  // 1. 비교 대상(과거의 나)의 첫 번째 자식을 찾는다.
  // wipFiber.alternate가 있다면 그 녀석의 child가 첫 번째 oldFiber
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;

  let prevSibling = null;

  // 2. 새 설계도(elements)를 끝까지 돌거나,
  // 과거의 기록(oldFiber)이 아직 남아있을 때까지 반복문을 돈다.
  while (index < elements.length || oldFiber != null) {
    const element = elements[index];
    let newFiber = null;

    // 타입 비교 (Diffing)
    // - oldFiber가 있고, 새 element도 있고, 둘의 type이 같은가?
    const sameType = oldFiber && element && element.type == oldFiber.type;

    if (sameType) {
      // [CASE 1] 업데이트 (UPDATE)
      // - 기존 DOM 노드를 그대로 가져다 씁니다 (oldFiber.dom). -> 성능 최적화의 핵심
      // - 새로운 props만 챙겨서 파이버를 만드세요.
      // - alternate에 oldFiber를 연결한다.
      // alternate는 타입이 같은 경우에 기존 노드의 데이터를 물려받기 위함이다. 따라서 다르거나 새로 생성해야 하는 경우 null이 저장된다.
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: "UPDATE",
      };
    }

    if (element && !sameType) {
      // [CASE 2] 새로 생성 (PLACEMENT)
      // - 타입이 다르거나, 이전에 없었던 경우
      // - dom은 null로 시작(추후 commit 단계에서 만들 예정)
      // - alternate는 당연히 null
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber, // 모든 자식은 부모를 알고있다.
        alternate: null,
        effectTag: "PLACEMENT",
      };
    }

    if (oldFiber && !sameType) {
      // [CASE 3] 삭제 (DELETION)
      // - 옛날엔 있었는데 이번엔 없거나 타입이 바뀐 경우
      // - oldFiber에 'DELETION' 꼬리표를 달고, 전역 변수 deletions 배열에 push 해준다.
      // oldFiber에 DELETION이라는 꼬리표를 달아줘야 하는 이유는,
      // useEffect같은 훅을 구현할 때 클린업 같은걸 실행해줘야 하기 때문이다.
      ((oldFiber.effectTag = "DELETION"), deletions.push(oldFiber));
    }

    // 3. 다음 비교를 위해 포인터를 옮깁니다.
    if (oldFiber) {
      // oldFiber는 옆 동생(sibling)으로 이동!
      oldFiber = oldFiber.sibling;
    }

    // 4. (기존 로직과 동일)
    // 첫 번째 자식이면 wipFiber.child에, 아니면 prevSibling.sibling에 연결한다.
    // 부모는 첫 번째 자식만 기억한다.
    if (newFiber) {
      if (index === 0) {
        wipFiber.child = newFiber;
      } else {
        prevSibling.sibling = newFiber;
      }
      prevSibling = newFiber;
    }

    index++;
  }
}

function updateFunctionComponent(fiber) {
  hookIndex = 0;
  wipFiber = fiber;
  fiber.hooks = [];
  fiber.effects = [];

  reconcileChildren(fiber, [fiber.type(fiber.props)]);
}

function updateProviderComponent(fiber) {
  // 전달받은 value를 context의 value로 주입한다.
  // TODO: context가 객체 형태라면 참조값이 안바뀌어서 리렌더링이 안될텐데..? 깊은 비교?
  reconcileChildren(fiber, fiber.props.children);
}

function updateHostComponent(fiber) {
  // 1. 실제 DOM 노드를 만들어서 fiber.dom에 연결 (createDom 사용)
  // render 함수를 처음 호출한 경우에는 이미 fiber.dom에 실제 dom이 연결된 상태이다.
  // 따라서 그렇지 않은 경우에만 실제 DOM 노드를 만들어 연결해준다.
  if (!fiber.dom) {
    // createDom으로 실제 DOM 노드 만들기
    // commit 단계에서의 화면 끊김(jank)를 방지하기 위해 일단 만들어두고, 한번에 반영한다.
    // 여기서 미리 만들어두는데, 이거 만드는것도 비용이지 않을까? -> 실제 리액트에서는 다르게 동작
    fiber.dom = createDom(fiber);
  }

  const elements = fiber.props.children;
  reconcileChildren(fiber, elements);
}

// 가상 DOM 노드들을 재료로 삼아 파이버 트리를 만든다.
function performUnitOfWork(fiber) {
  if (typeof fiber.type === "function") {
    updateFunctionComponent(fiber);
  } else if (fiber.type && fiber.type.$$typeof === "react.provider") {
    updateProviderComponent(fiber);
  } else {
    // 파이버가 호스트 컴포넌트(ex. <div> 등)인 경우 실행
    updateHostComponent(fiber);
  }

  // 3. 다음 작업 단위(Next Unit of Work)를 찾아서 반환
  // 자식이 있으면 자식으로 간다
  if (fiber.child) {
    return fiber.child;
  }

  // 자식이 없으면 형제를 찾는다
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }

  return null;
}

/**
 * Commit Phase와 그 이후 핵심 함수들
 */
const hasChangeDeps = (oldDeps, newDeps) => {
  if (!oldDeps || !newDeps) return true;
  return (
    oldDeps.length !== newDeps.length ||
    newDeps.some((dep, i) => dep !== oldDeps[i])
  );
};

function runEffectsInCurrentTree(fiber) {
  if (!fiber) return;

  // 1. 자식부터 실행 (Bottom-up)
  if (fiber.child) runEffectsInCurrentTree(fiber.child);

  const effects = fiber.effects;
  const oldEffects = fiber.alternate?.effects; // ?: alternate가 없을 경우 대비(초기 렌더링)

  if (effects) {
    // 마운트 시점 -> deps가 빈 배열, 빈 배열이 아닌 경우 모두 공통 실행
    // deps가 undefined인 경우 매번 실행
    // deps가 빈 배열인 경우 실행 x
    // 이외의 경우 deps 비교 후 실행
    // cleanup이 존재하는 경우에만 클린업을 실행하도록 한다.
    // 실행하지 않는 경우 이전 클린업 함수를 그대로 유지시켜줘야 한다.

    effects.forEach((effectObj, i) => {
      const oldEffectObj = oldEffects ? oldEffects[i] : null;

      // 실행되는 경우: 마운트 시점, deps가 undefined, deps가 다를 때
      const isMount = !oldEffectObj;
      const isDepsUndefined = effectObj.deps === undefined;
      const isDepsChanged =
        oldEffectObj &&
        effectObj.deps &&
        hasChangeDeps(oldEffectObj.deps, effectObj.deps);

      // 3. 조건 중 하나라도 해당하면 실행 (단, 빈 배열[]일 때는 isDepsChanged가 false가 됨)
      if (isMount || isDepsUndefined || isDepsChanged) {
        // 보관했던 클린업을 실행한다.
        if (effectObj?.cleanup) {
          effectObj.cleanup();
        }

        // 새 이펙트 실행 및 클린업 저장
        effectObj.cleanup = effectObj.effect();
      }
    });
  }

  if (fiber.sibling) {
    runEffectsInCurrentTree(fiber.sibling);
  }
}

function runEffects() {
  // 클린업은 컴포넌트가 언마운트 될 때, deps가 바뀌어 새로운 이펙트가 실행되기 직전에 실행된다.
  // 1) currentTree를 순회하면서 이펙트를 실행한다.
  runEffectsInCurrentTree(currentRoot);

  // 2) deletions 배열에 있는 파이버들의 클린업을 실행한다.
  // 이펙트가 클린업 함수를 반환하지 않았을 경우에 대한 처리가 필요하다.
  deletions
    .filter((fiber) => fiber.effects)
    .forEach((fiber) => fiber.effects.forEach((hook) => hook.cleanup()));
}

function commitRoot() {
  // 삭제할 노드를 삭제한다.
  deletions.forEach((fiber) => commitDeletion(fiber));

  // wip트리를 타고 가며 dom을 최신화한다.
  commitWork(wipRoot.child);

  // 커밋이 다 끝나면 wipTree를 currentTree로 저장한다.
  currentRoot = wipRoot;

  // 브라우저가 화면을 그린 뒤 이펙트를 실행한다.
  // setTimeout 콜백은 태스크 큐에 들어가므로, 브라우저가 화면을 그린 이후에 실행된다.
  // TODO: 4ms의 지연이 있으므로 개선할 수 있을듯?
  setTimeout(() => runEffects(), 0);
  wipRoot = null;
}

function commitDeletion(fiber, domParent) {
  if (!domParent) {
    let parentFiber = fiber.parent;
    while (!parentFiber.dom) {
      parentFiber = parentFiber.parent;
    }
    domParent = parentFiber.dom;
  }

  // ref.current의 참조를 끊어줘야 DOM 노드가 완전히 삭제된다.
  // if (fiber.props && fiber.props.ref) {
  //   fiber.props.ref.current = null;
  // }

  // fiber의 type이 함수형 컴포넌트인 경우 fiber.dom이 존재하지 않는다.
  // 따라서 fiber.child를 각각 모두 삭제해줘야 한다.
  if (fiber.dom) {
    domParent.removeChild(fiber.dom);
  } else {
    // 함수형 컴포넌트라면
    if (fiber.child) {
      commitDeletion(fiber.child, domParent);

      let sibling = fiber.child.sibling;
      while (sibling) {
        commitDeletion(sibling, domParent);
        sibling = sibling.sibling;
      }
    }
  }
}

function commitWork(fiber) {
  if (!fiber) return;
  // 현재는 WIP 트리가 만들어진 상태
  // WIP 트리를 검사하며 노드들을 처리하고, 이를 실제 DOM 트리에 반영한다.

  // effectTag가 UPDAE인 경우
  if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
    const oldProps = fiber.alternate.props;
    const newProps = fiber.props;

    // 기존 props에 있는 속성을 새 props에만 있는 속성으로 업데이트
    for (const [key, value] of Object.entries(newProps)) {
      if (key === "children") {
        continue;
      }
      if (value != oldProps[key]) {
        // 이벤트 중복등록 해결하기
        if (key.startsWith("on")) {
          const eventType = key.toLowerCase().substring(2);

          if (oldProps[key]) {
            fiber.dom.removeEventListener(eventType, oldProps[key]);
          }
          fiber.dom.addEventListener(eventType, value);
        } else {
          fiber.dom[key] = value;
        }
      }
    }
    // 기존 props에만 있고, 새 props에는 없는 속성을 삭제
    for (const [key] of Object.entries(oldProps)) {
      if (key === "children") continue;

      if (newProps[key] === undefined) {
        fiber.dom.removeAttribute(key);
      }
    }
  }

  // effectTag가 PLACEMENT인 경우
  if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
    let parentFiber = fiber.parent;
    while (!parentFiber.dom) {
      parentFiber = parentFiber.parent;
    }
    parentFiber.dom.appendChild(fiber.dom);
    // fiber의 props에 ref가 존재한다면, 이 ref에 fiber.dom을 바인딩한다.
    if ("ref" in fiber.props) {
      fiber.props.ref.current = fiber.dom;
    }
  }

  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

/**
 * Hooks
 */
// useState 구현
// 파이버 객체 내부에 훅 정보를 순서대로 담을 배열이 있어야 한다.
// 현재 어떤 파이버가 실행 중인지 추적할 변수 (wipFiber),
// 현재 몇 번째 훅을 처리 중인지를 추적하는 변수 (hookIndex)를 활용한다.
function useState(initial) {
  // alternate가 존재하지 않는 경우(초기 렌더링)
  // hooks에는 해당 컴포넌트에서 호출된 훅들에 대한 데이터(state, queue)가 들어간다.
  const oldHook =
    wipFiber.alternate && // 초기 렌더링 시 alternate가 없을 경우 대비
    wipFiber.alternate.hooks && // 이전에 hook이 아예 없었던 경우 대비
    wipFiber.alternate.hooks[hookIndex];

  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  };

  // queue에 요소가 존재한다면 여기서 모두 처리
  const actions = oldHook ? oldHook.queue : [];
  actions.forEach(
    (action) =>
      (hook.state = typeof action === "function" ? action(hook.state) : action),
  );

  wipFiber.hooks.push(hook);
  hookIndex++;

  const setState = (action) => {
    hook.queue.push(action);

    if (action === hook.state) {
      return;
    }

    // state가 변경되었다면 wipRoot를 업데이트하여 리렌더링을 트리거한다.
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    };
    nextUnitOfWork = wipRoot;
    deletions = [];
  };

  return [hook.state, setState];
}

function useEffect(callback, deps) {
  const oldHook =
    wipFiber.alternate && // alternate가 없을 경우 대비(초기 렌더링)
    wipFiber.alternate.hooks && // 이전에 hook이 아예 없었던 경우 대비(코드 수정 등)
    wipFiber.alternate.hooks[hookIndex];

  const hook = {
    effect: callback,
    deps,
    // oldHook이 존재하는 경우 해당 클린업을 저장, 존재하지 않으면 null
    cleanup: oldHook ? oldHook.cleanup : null,
  };

  // 렌더링 시에는 콜백을 배열에 밀어넣었다가, 추후 한꺼번에 실행한다.
  wipFiber.hooks.push(hook);
  wipFiber.effects.push(hook);

  hookIndex++;
}

function useRef(initial) {
  const oldHook =
    wipFiber.alternate && // alternate가 없을 경우 대비(초기 렌더링)
    wipFiber.alternate.hooks && // 이전에 hook이 아예 없었던 경우 대비(코드 수정 등)
    wipFiber.alternate.hooks[hookIndex];

  // 리렌더링 되더라도 새로운 객체를 생성하지 않아야 하므로, oldHook이 존재한다면 이를 그대로 반환해야 한다.
  const hook = oldHook ? oldHook : { current: initial };
  wipFiber.hooks.push(hook);
  hookIndex++;

  return hook;
}

// TODO: useMemo안에서 useRef를 활용하면 좋을 것 같다.
function useMemo(callback, deps) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  // oldHook이 존재하지 않았다면 (초기 렌더링이라면) value 실행
  // oldHook이 존재했다면 deps 비교후 value 실행
  const hook = {
    value: null,
    deps: deps,
  };

  // callback이 실행되는 경우: oldHook이 존재하지 않거나, oldHook이 존재하면서 deps가 바뀐 경우
  if (!oldHook || hasChangeDeps(oldHook.deps, deps)) {
    hook.value = callback();
  } else {
    hook.value = oldHook.value;
  }

  wipFiber.hooks.push(hook);
  hookIndex++;

  return hook.value;
}

function hadDeepChangeDeps(oldDeps, newDeps) {
  // 타입이 다르다면 True
  // 타입이 같고 배열 타입이라면 -> 길이 비교, 길이 같다면 내부 재귀 비교
  // 객체 타입이라면 -> 프로퍼티 개수 비교, 개수가 같다면 프로퍼티별로 재귀 비교
  // 디폴트 False 리턴하기
}
function useDeepMemo(callback, deps) {
  const oldHook =
    wipFiber.alternate &&
    wipFiber.alternate.hooks &&
    wipFiber.alternate.hooks[hookIndex];

  // oldHook이 존재하지 않았다면 (초기 렌더링이라면) value 실행
  // oldHook이 존재했다면 deps 비교후 value 실행
  const hook = {
    value: null,
    deps: deps,
  };

  // callback이 실행되는 경우: oldHook이 존재하지 않거나, oldHook이 존재하면서 deps가 바뀐 경우
  if (!oldHook || hasChangeDeps(oldHook.deps, deps)) {
    hook.value = callback();
  } else {
    hook.value = oldHook.value;
  }

  wipFiber.hooks.push(hook);
  hookIndex++;

  return hook.value;
}

function createContext(defaultValue) {
  const context = {
    _currentValue: defaultValue,
    Provider: {
      $$typeof: "react.provider",
      _context: null,
    },
  };
  // Provider에서 곧바로 저장소(context)에 접근할 수 있어야 하기 때문에 연결해준다.
  context.Provider._context = context;
  return context;
}

function useContext(context) {
  // 현재 실행 중인 파이버에서부터 위로(parent방향) 올라가며 가장 가까운 Provider를 찾는다.
  // 해당 Provider가 내가 찾는 Context.Provider인지 확인한다.
  // 찾았다면 그 파이버가 들고 있는 props.value를 반환한다.
  // 루트까지 못 찾았다면 Context 객체 생성 시 설정한 defaultValue를 반환한다.
  let fiber = wipFiber.parent; // 부모부터 탐색 시작

  while (fiber) {
    if (fiber.type === context.Provider) {
      return fiber.props.value;
    }
    fiber = fiber.parent; // 위로 한 칸 이동
  }
  // 찾는 Provider가 없다면 default value를 리턴
  return context._currentValue;
}

// workLoop 실행을 위한 렌더 함수
function render(element, container) {
  // 1-1. 작업을 시작할 첫 번째 Fiber(div.root에 대한 파이버)를 만든다.
  // 속성은 기존과 동일하게 dom과 props(children 포함)를 가진다.
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  };
  deletions = [];
  nextUnitOfWork = wipRoot;
}

const Didact = {
  createElement,
  render,
  useState,
  useEffect,
  useRef,
  useMemo,
  createContext,
  useContext,
};

// 브라우저 환경에서 전역 변수로 할당 (Babel Standalone 대응)
// 추후 index.js 실행 시 Didact 사용을 위함
window.Didact = Didact;
