function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    if (k === 'class') node.className = String(v);
    else if (k === 'text') node.textContent = String(v);
    else if (k === 'html') node.innerHTML = String(v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, String(v));
  }
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c === null || c === undefined) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function renderPhotoThumbs(root, items, { onOpen, showCaption = true } = {}) {
  if (!root) return;
  root.innerHTML = '';
  for (const p of (Array.isArray(items) ? items : [])) {
    const children = [
      el('img', { src: p.src, alt: p.caption || 'photo', loading: 'lazy' })
    ];
    if (showCaption) {
      children.push(el('div', { class: 'photoThumb__cap', text: p.caption || '' }));
    }
    const wrap = el('button', {
      class: 'photoThumb',
      type: 'button',
      'aria-label': `打开照片 ${p.caption || ''}`,
      onclick: () => onOpen && onOpen(p)
    }, children);
    root.appendChild(wrap);
  }
}

// 点赞数据存储
const PHOTO_STARS_KEY = 'photo:stars';

function getPhotoStars() {
  try {
    return JSON.parse(localStorage.getItem(PHOTO_STARS_KEY) || '{}');
  } catch {
    return {};
  }
}

function setPhotoStar(photoSrc, starred) {
  const stars = getPhotoStars();
  if (starred) {
    stars[photoSrc] = true;
  } else {
    delete stars[photoSrc];
  }
  localStorage.setItem(PHOTO_STARS_KEY, JSON.stringify(stars));
}

function isPhotoStarred(photoSrc) {
  return !!getPhotoStars()[photoSrc];
}

// 收集所有照片的辅助函数
export function collectAllPhotos(config) {
  const albums = config?.photos?.albums || [];
  const allPhotos = [];
  for (const a of (Array.isArray(albums) ? albums : [])) {
    for (const item of (a.items || [])) {
      allPhotos.push({ ...item, albumTitle: a.title || String(a.year || '') });
    }
  }
  return allPhotos;
}

// 根据照片src查找索引
export function findPhotoIndex(allPhotos, photoSrc) {
  return allPhotos.findIndex(p => p.src === photoSrc);
}

export function buildPhotosDrawerContent(config, { initialIndex = 0 } = {}) {
  // 收集所有照片
  const allPhotos = collectAllPhotos(config);
  
  // 如果没有照片，显示空状态
  if (allPhotos.length === 0) {
    return el('div', { class: 'photoGallery__empty', text: '暂无照片' });
  }
  
  let currentIndex = Math.max(0, Math.min(initialIndex, allPhotos.length - 1));
  
  const root = el('div', { class: 'photoGallery' });
  
  // 照片容器
  const photoContainer = el('div', { class: 'photoGallery__container' });
  
  // 左侧切换按钮
  const prevBtn = el('button', {
    class: 'photoGallery__nav photoGallery__nav--prev',
    type: 'button',
    'aria-label': '上一张'
  }, [el('span', { text: '‹' })]);
  
  // 右侧切换按钮
  const nextBtn = el('button', {
    class: 'photoGallery__nav photoGallery__nav--next',
    type: 'button',
    'aria-label': '下一张'
  }, [el('span', { text: '›' })]);
  
  // 图片元素
  const img = el('img', { class: 'photoGallery__img', alt: '' });
  
  // 图片信息
  const caption = el('div', { class: 'photoGallery__caption' });
  const counter = el('div', { class: 'photoGallery__counter' });
  
  // GitHub Star 风格的点赞按钮
  const starIcon = el('span', { class: 'photoGallery__starIcon' });
  const starText = el('span', { class: 'photoGallery__starText', text: 'Star' });
  const starBtn = el('button', {
    class: 'photoGallery__star',
    type: 'button',
    'aria-label': '点赞这张照片'
  }, [starIcon, starText]);
  
  const infoBar = el('div', { class: 'photoGallery__info' }, [
    el('div', { class: 'photoGallery__infoLeft' }, [caption, counter]),
    starBtn
  ]);
  
  photoContainer.appendChild(prevBtn);
  photoContainer.appendChild(img);
  photoContainer.appendChild(nextBtn);
  
  root.appendChild(photoContainer);
  root.appendChild(infoBar);
  
  // 更新点赞状态
  const updateStarBtn = () => {
    const photo = allPhotos[currentIndex];
    const starred = isPhotoStarred(photo.src);
    starBtn.classList.toggle('is-starred', starred);
    starIcon.textContent = starred ? '★' : '☆';
    starText.textContent = starred ? 'Starred' : 'Star';
  };
  
  // 更新显示
  const updateDisplay = () => {
    const photo = allPhotos[currentIndex];
    img.src = photo.src || '';
    img.alt = photo.caption || 'photo';
    caption.textContent = photo.caption || '';
    counter.textContent = `${currentIndex + 1} / ${allPhotos.length}`;
    
    // 隐藏/显示按钮
    prevBtn.style.visibility = currentIndex === 0 ? 'hidden' : 'visible';
    nextBtn.style.visibility = currentIndex === allPhotos.length - 1 ? 'hidden' : 'visible';
    
    // 更新点赞状态
    updateStarBtn();
  };
  
  // 点赞事件
  starBtn.addEventListener('click', () => {
    const photo = allPhotos[currentIndex];
    const currentlyStarred = isPhotoStarred(photo.src);
    setPhotoStar(photo.src, !currentlyStarred);
    updateStarBtn();
    
    // 添加点击动画
    starBtn.classList.add('is-animating');
    setTimeout(() => starBtn.classList.remove('is-animating'), 300);
  });
  
  // 切换事件
  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
      currentIndex--;
      updateDisplay();
    }
  });
  
  nextBtn.addEventListener('click', () => {
    if (currentIndex < allPhotos.length - 1) {
      currentIndex++;
      updateDisplay();
    }
  });
  
  // 键盘导航
  const handleKeydown = (e) => {
    if (e.key === 'ArrowLeft' && currentIndex > 0) {
      currentIndex--;
      updateDisplay();
    } else if (e.key === 'ArrowRight' && currentIndex < allPhotos.length - 1) {
      currentIndex++;
      updateDisplay();
    }
  };
  
  // 在抽屉打开时添加键盘监听
  window.addEventListener('keydown', handleKeydown);
  
  // 初始显示
  updateDisplay();
  
  return root;
}

export function ensurePhotoViewer() {
  let viewer = document.getElementById('photoViewer');
  if (viewer) return viewer;

  viewer = document.createElement('div');
  viewer.id = 'photoViewer';
  viewer.className = 'photoViewer';
  viewer.innerHTML = `
    <div class="photoViewer__overlay" aria-hidden="true"></div>
    <div class="photoViewer__content" role="dialog" aria-label="图片预览" aria-modal="true">
      <div class="photoViewer__hd">
        <div id="photoViewerTitle" class="photoViewer__title"></div>
        <button id="photoViewerClose" class="btn btn--sm" type="button" aria-label="关闭预览">✕</button>
      </div>
      <div class="photoViewer__body">
        <img id="photoViewerImg" alt="预览" />
      </div>
    </div>
  `.trim();

  document.body.appendChild(viewer);

  const overlay = viewer.querySelector('.photoViewer__overlay');
  const close = viewer.querySelector('#photoViewerClose');
  const hide = () => viewer.classList.remove('is-open');

  overlay.addEventListener('click', hide);
  close.addEventListener('click', hide);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  });

  return viewer;
}

export function openPhoto(p) {
  const viewer = ensurePhotoViewer();
  viewer.classList.add('is-open');
  const title = viewer.querySelector('#photoViewerTitle');
  const img = viewer.querySelector('#photoViewerImg');

  if (title) title.textContent = p?.caption || 'Photo';
  if (img) {
    // only load big image when opening (still same src here; user can point to larger files)
    img.src = p?.src || '';
  }
}
