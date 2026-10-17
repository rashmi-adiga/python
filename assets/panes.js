const labels = {
  lesson: 'lessons',
  ide: 'IDE',
  editor: 'editor',
  output: 'output',
};
export function setPane(name, open) {
  const outer = name === 'lesson' || name === 'ide';
  const pane = document.querySelector(
    '[' + (outer ? 'data-pane' : 'data-subpane') + '="' + name + '"]',
  );
  const button = document.querySelector(
    '[' +
      (outer ? 'data-toggle-pane' : 'data-toggle-subpane') +
      '="' +
      name +
      '"]',
  );
  pane.classList.toggle(outer ? 'pane-collapsed' : 'subpane-collapsed', !open);
  if (outer)
    document
      .querySelector('.learning-workspace')
      .classList.toggle(name + '-collapsed', !open);
  button.setAttribute('aria-expanded', String(open));
  if (outer) {
    button.setAttribute(
      'aria-label',
      (open ? 'Hide ' : 'Open ') + labels[name],
    );
    button.querySelector('.toggle-text').textContent =
      (open ? 'Hide ' : 'Open ') + labels[name];
  } else button.textContent = (open ? 'Hide ' : 'Open ') + labels[name];
  button.title =
    (open ? 'Hide ' : 'Show ') + labels[name] + ' without losing your work';
  updateHandles();
}
function updateHandles() {
  const collapsed = document.querySelector('.workspace-pane.pane-collapsed');
  document.querySelector('[data-workspace-resizer]').hidden =
    Boolean(collapsed);
  document.querySelector('[data-output-resizer]').hidden = Boolean(
    document.querySelector('.subpane-collapsed'),
  );
}
export function revealEditor() {
  setPane('ide', true);
  setPane('editor', true);
}
export function revealOutput() {
  setPane('ide', true);
  setPane('output', true);
}
export function initializePaneControls() {
  const root = document.querySelector('.learning-workspace'),
    stack = document.querySelector('.ide-stack');
  const main = document.querySelector('[data-workspace-resizer]'),
    output = document.querySelector('[data-output-resizer]');
  const read = (key, fallback) => {
    try {
      const n = Number(localStorage.getItem(key));
      return Number.isFinite(n) && n > 0 ? n : fallback;
    } catch {
      return fallback;
    }
  };
  const save = (key, value) => {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      /* Resizing still works when storage is unavailable. */
    }
  };
  let mainSize = read('python-pathfinder-split', 52),
    outputSize = read('python-pathfinder-output', 34);
  const mainAxis = () =>
    matchMedia('(orientation: portrait)').matches ? 'y' : 'x';
  const applyMain = (value) => {
    mainSize = Math.max(22, Math.min(78, value));
    root.style.setProperty('--lesson-size', mainSize + '%');
    main.setAttribute('aria-valuenow', String(Math.round(mainSize)));
    main.setAttribute(
      'aria-valuetext',
      Math.round(mainSize) + ' percent lessons',
    );
    save('python-pathfinder-split', mainSize);
  };
  const applyOutput = (value) => {
    outputSize = Math.max(20, Math.min(75, value));
    stack.style.setProperty('--output-size', outputSize + '%');
    output.setAttribute('aria-valuenow', String(Math.round(outputSize)));
    output.setAttribute(
      'aria-valuetext',
      Math.round(outputSize) + ' percent output',
    );
    save('python-pathfinder-output', outputSize);
  };
  applyMain(mainSize);
  applyOutput(outputSize);
  separator(
    main,
    () => mainSize,
    applyMain,
    mainAxis,
    false,
    (event) => {
      const r = root.getBoundingClientRect();
      return mainAxis() === 'y'
        ? ((event.clientY - r.top) / r.height) * 100
        : ((event.clientX - r.left) / r.width) * 100;
    },
  );
  separator(
    output,
    () => outputSize,
    applyOutput,
    () => 'y',
    true,
    (event) => {
      const r = stack.getBoundingClientRect();
      return ((r.bottom - event.clientY) / r.height) * 100;
    },
  );
  const orient = () =>
    main.setAttribute(
      'aria-orientation',
      mainAxis() === 'y' ? 'horizontal' : 'vertical',
    );
  orient();
  addEventListener('resize', orient);
  for (const name of ['lesson', 'ide', 'editor', 'output']) {
    const outer = name === 'lesson' || name === 'ide';
    const button = document.querySelector(
      '[' +
        (outer ? 'data-toggle-pane' : 'data-toggle-subpane') +
        '="' +
        name +
        '"]',
    );
    setPane(name, true);
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      // Keep one useful pane open instead of collapsing the entire workspace.
      if (!open) {
        const other = {
          lesson: 'ide',
          ide: 'lesson',
          editor: 'output',
          output: 'editor',
        }[name];
        setPane(other, true);
      }
      setPane(name, open);
    });
  }
}
function separator(node, get, apply, axis, inverse, position) {
  node.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    node.setPointerCapture(event.pointerId);
    node.classList.add('dragging');
    const move = (e) => apply(position(e));
    const end = () => {
      node.classList.remove('dragging');
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', end);
      node.removeEventListener('pointercancel', end);
      node.removeEventListener('lostpointercapture', end);
    };
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
    node.addEventListener('lostpointercapture', end);
  });
  node.addEventListener('keydown', (event) => {
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      apply(
        Number(
          node.getAttribute(
            event.key === 'Home' ? 'aria-valuemin' : 'aria-valuemax',
          ),
        ),
      );
      return;
    }
    const pair =
      axis() === 'x' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    if (!pair.includes(event.key)) return;
    event.preventDefault();
    apply(
      get() +
        (event.key === pair[1] ? 1 : -1) *
          (inverse ? -1 : 1) *
          (event.shiftKey ? 10 : 2),
    );
  });
}
