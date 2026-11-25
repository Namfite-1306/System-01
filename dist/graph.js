const layouts = new Map();
export function bindGraph(svg) {
  if (!svg) return;
  const nodes = [...svg.querySelectorAll('[data-node-id]')],
    edges = [...svg.querySelectorAll('line[data-from]')],
    id = svg.dataset.graphId;
  let view = { x: 0, y: 0, w: 840, h: 530 },
    drag = null,
    suppressUntil = 0;
  const positions = new Map(
    nodes.map((n) => [n.dataset.nodeId, { x: Number(n.dataset.x), y: Number(n.dataset.y) }]),
  );
  const original = new Map([...positions].map(([id, p]) => [id, { ...p }]));
  const stored = layouts.get(id);
  if (stored) {
    view = { ...stored.view };
    for (const [key, p] of stored.positions) if (positions.has(key)) positions.set(key, { ...p });
  }
  const update = () => {
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    for (const n of nodes) {
      const p = positions.get(n.dataset.nodeId);
      n.setAttribute('transform', `translate(${p.x},${p.y})`);
    }
    for (const line of edges) {
      const a = positions.get(line.dataset.from),
        b = positions.get(line.dataset.to);
      if (a && b)
        for (const [key, value] of Object.entries({ x1: a.x, y1: a.y, x2: b.x, y2: b.y }))
          line.setAttribute(key, value);
    }
    layouts.set(id, {
      view: { ...view },
      positions: new Map([...positions].map(([k, p]) => [k, { ...p }])),
    });
  };
  const point = (e) => {
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  };
  const zoom = (factor, anchor = { x: view.x + view.w / 2, y: view.y + view.h / 2 }) => {
    if (drag) return;
    const width = Math.max(210, Math.min(3360, view.w * factor)),
      ratio = width / view.w;
    view = {
      x: anchor.x - (anchor.x - view.x) * ratio,
      y: anchor.y - (anchor.y - view.y) * ratio,
      w: width,
      h: view.h * ratio,
    };
    update();
  };
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || drag) return;
    const node = e.target.closest('[data-node-id]');
    drag = {
      pointer: e.pointerId,
      node: node?.dataset.nodeId,
      start: point(e),
      view: { ...view },
      position: node ? { ...positions.get(node.dataset.nodeId) } : null,
      clientX: e.clientX,
      clientY: e.clientY,
      moved: false,
      capture: node || svg,
    };
    drag.capture.setPointerCapture(e.pointerId);
    svg.classList.add('dragging');
  });
  svg.addEventListener('pointermove', (e) => {
    if (!drag || drag.pointer !== e.pointerId) return;
    const p = point(e);
    if (Math.hypot(e.clientX - drag.clientX, e.clientY - drag.clientY) > 4) drag.moved = true;
    if (!drag.moved) return;
    if (drag.node)
      positions.set(drag.node, {
        x: drag.position.x + p.x - drag.start.x,
        y: drag.position.y + p.y - drag.start.y,
      });
    else {
      const matrix = svg.getScreenCTM();
      view.x = drag.view.x - (e.clientX - drag.clientX) / matrix.a;
      view.y = drag.view.y - (e.clientY - drag.clientY) / matrix.d;
    }
    update();
  });
  const finish = (e) => {
    if (!drag || drag.pointer !== e.pointerId) return;
    if (drag.moved) suppressUntil = Date.now() + 400;
    const capture = drag.capture;
    drag = null;
    svg.classList.remove('dragging');
    if (capture.hasPointerCapture(e.pointerId)) capture.releasePointerCapture(e.pointerId);
  };
  svg.addEventListener('pointerup', finish);
  svg.addEventListener('pointercancel', finish);
  svg.addEventListener('lostpointercapture', () => {
    drag = null;
    svg.classList.remove('dragging');
  });
  svg.addEventListener(
    'click',
    (e) => {
      if (Date.now() < suppressUntil) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  svg.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoom(Math.exp(Math.max(-100, Math.min(100, e.deltaY)) * 0.003), point(e));
    },
    { passive: false },
  );
  svg.addEventListener('keydown', (e) => {
    const delta = {
      ArrowLeft: [-15, 0],
      ArrowRight: [15, 0],
      ArrowUp: [0, -15],
      ArrowDown: [0, 15],
    }[e.key];
    if (delta) {
      e.preventDefault();
      const node = e.target.closest('[data-node-id]');
      if (node) {
        const p = positions.get(node.dataset.nodeId);
        positions.set(node.dataset.nodeId, { x: p.x + delta[0], y: p.y + delta[1] });
      } else {
        view.x += delta[0];
        view.y += delta[1];
      }
      update();
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoom(0.8);
    } else if (e.key === '-') {
      e.preventDefault();
      zoom(1.25);
    }
  });
  document.querySelector('#graph-zoom-in').onclick = () => zoom(0.8);
  document.querySelector('#graph-zoom-out').onclick = () => zoom(1.25);
  document.querySelector('#graph-reset').onclick = () => {
    view = { x: 0, y: 0, w: 840, h: 530 };
    for (const [key, p] of original) positions.set(key, { ...p });
    update();
  };
  update();
}
