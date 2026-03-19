let _isOpen = false;

let _prevBodyOverflow = '';

function lockBody() {
  _prevBodyOverflow = document.body.style.overflow || '';
  document.body.classList.add('is-locked');
  document.body.style.overflow = 'hidden';
}

function unlockBody() {
  document.body.classList.remove('is-locked');
  document.body.style.overflow = _prevBodyOverflow;
  _prevBodyOverflow = '';
}

export function createDrawer() {
  const overlay = document.getElementById('drawerOverlay');
  const drawer = document.getElementById('drawer');
  const titleEl = document.getElementById('drawerTitle');
  const body = document.getElementById('drawerBody');
  const closeBtn = document.getElementById('drawerClose');

  if (!overlay || !drawer || !titleEl || !body || !closeBtn) {
    throw new Error('Drawer elements not found in DOM');
  }

  const close = () => {
    if (!_isOpen) return;
    _isOpen = false;

    overlay.classList.remove('is-open');
    drawer.classList.remove('is-open');

    // allow animation to play before hiding
    window.setTimeout(() => {
      overlay.hidden = true;
      drawer.hidden = true;
      drawer.setAttribute('aria-hidden', 'true');
    }, 180);

    unlockBody();
  };

  const open = ({ title, content }) => {
    _isOpen = true;
    titleEl.textContent = title || 'Menu';
    body.innerHTML = '';
    if (content) body.appendChild(content);

    overlay.hidden = false;
    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');

    lockBody();

    // trigger transitions
    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
      drawer.classList.add('is-open');
    });

    // focus close button for accessibility
    closeBtn.focus();
  };

  overlay.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  return { open, close, get isOpen() { return _isOpen; } };
}
