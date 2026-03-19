import { readJson, writeJson } from './storage.js';

export class WallpaperRotator {
  /**
   * @param {object} options
   * @param {HTMLElement} options.layerA
   * @param {HTMLElement} options.layerB
   * @param {HTMLElement} [options.meta]
   * @param {number} options.fadeMs
   * @param {number} options.intervalSeconds
   * @param {boolean} options.rememberLast
   * @param {boolean} options.preloadNext
   * @param {Array<{type?:'image'|'video', src:string, credit?:string}>} [options.items]
   * @param {Array<{src:string, credit?:string}>} [options.images] Back-compat: old schema
   */
  constructor(options) {
    this.layerA = options.layerA;
    this.layerB = options.layerB;
    this.meta = options.meta || null;

    this.fadeMs = Math.max(0, Number(options.fadeMs) || 900);
    this.intervalMs = Math.max(1000, (Number(options.intervalSeconds) || 30) * 1000);
    this.rememberLast = Boolean(options.rememberLast);
    this.preloadNext = Boolean(options.preloadNext);
    this.items = this._normalizeItems(options);

    this._timer = null;
    this._paused = false;
    this._index = 0;
    this._frontIsA = true;

  /** @type {HTMLVideoElement|null} */
  this.video = document.getElementById('wallpaperVideo');

    /** @type {HTMLVideoElement|null} */
    this._videoA = null;
    /** @type {HTMLVideoElement|null} */
    this._videoB = null;

    this.layerA.style.opacity = '1';
    this.layerB.style.opacity = '0';
    if (this.video) this.video.classList.remove('is-on');
  }

  /**
   * Load wallpaper manifest without blocking first paint.
   * If it succeeds, it will replace current items list.
   * @param {string} url
   */
  async loadManifest(url = 'assets/wallpapers/manifest.json') {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const manifest = await res.json();
      const next = this._itemsFromManifest(manifest);
      if (next.length === 0) return false;

      this.items = next;

      // clamp remembered index
      if (this._index >= this.items.length) this._index = 0;

      // update current wallpaper immediately
      this._apply(this._index, { instant: true });
      if (!this._paused) this.play();
      return true;
    } catch {
      return false;
    }
  }

  init() {
    if (this.items.length === 0) return;

    if (this.rememberLast) {
      const saved = readJson('wallpaperIndex', 0);
      if (Number.isInteger(saved) && saved >= 0 && saved < this.items.length) {
        this._index = saved;
      }
    }

    this._apply(this._index, { instant: true });
    this.play();
  }

  get paused() {
    return this._paused;
  }

  play() {
    if (this.items.length <= 1) return;
    this._paused = false;
    this._clearTimer();
    this._timer = window.setInterval(() => this.next(), this.intervalMs);
  }

  pause() {
    this._paused = true;
    this._clearTimer();
  }

  toggle() {
    if (this._paused) this.play();
    else this.pause();
  }

  next() {
    if (this.items.length === 0) return;
    const nextIndex = (this._index + 1) % this.items.length;
    this._apply(nextIndex);
  }

  prev() {
    if (this.items.length === 0) return;
    const nextIndex = (this._index - 1 + this.items.length) % this.items.length;
    this._apply(nextIndex);
  }

  _clearTimer() {
    if (this._timer) {
      window.clearInterval(this._timer);
      this._timer = null;
    }
  }

  _apply(index, { instant = false } = {}) {
    this._index = index;
    const item = this.items[index];
    const url = item?.src;
    if (!url) return;

    if (this.rememberLast) writeJson('wallpaperIndex', index);

  const front = this._frontIsA ? this.layerA : this.layerB;
  const back = this._frontIsA ? this.layerB : this.layerA;

    back.style.transition = instant ? 'none' : `opacity ${this.fadeMs}ms ease`;
    front.style.transition = instant ? 'none' : `opacity ${this.fadeMs}ms ease`;

    // Stop any per-layer video (legacy impl) if it exists.
    this._stopVideo(this._videoA);
    this._stopVideo(this._videoB);

    // Render next item.
    if ((item?.type || 'image') === 'video') {
      // If the single video element is missing, degrade safely.
      if (!this.video) {
        // fallback: treat as image (poster if present), or just skip
        const fallbackSrc = item?.poster || item?.src;
        this._hideVideo();
        this._setLayerToImage(back, { ...item, src: fallbackSrc, type: 'image' });
        this._preloadImage(fallbackSrc, () => this._fadeSwap({ front, back, instant, item: { ...item, type: 'image', src: fallbackSrc } }));
        return;
      }

      this._showVideo(item);
      this._waitVideoCanPlay(this.video, () => {
        // When video is on, keep image layers transparent.
        front.style.opacity = '0';
        back.style.opacity = '0';
        this._updateMeta(item);

        if (this.preloadNext && this.items.length > 1) {
          const ni = (this._index + 1) % this.items.length;
          const next = this.items[ni];
          if (next?.src) this._preloadItem(next);
        }
      });
      return;
    }

    // image branch
    this._hideVideo();
    this._setLayerToImage(back, item);
    this._preloadImage(url, () => this._fadeSwap({ front, back, instant, item }));
  }

  _fadeSwap({ front, back, instant, item }) {
    // If video is currently showing, do not crossfade image layers.
    if ((item?.type || 'image') === 'video') return;

    if (instant) {
      back.style.opacity = '1';
      front.style.opacity = '0';
    } else {
      back.getBoundingClientRect();
      back.style.opacity = '1';
      front.style.opacity = '0';
    }

    this._frontIsA = !this._frontIsA;
    this._updateMeta(item);

    if (this.preloadNext && this.items.length > 1) {
      const ni = (this._index + 1) % this.items.length;
      const next = this.items[ni];
      if (next?.src) this._preloadItem(next);
    }
  }

  _updateMeta(item) {
    if (!this.meta) return;
    const credit = (item?.credit || '').trim();
    const isVideo = (item?.type || 'image') === 'video';
    const base = `${this._index + 1}/${this.items.length}`;
    const badge = isVideo ? `${base} · Video` : base;
    this.meta.textContent = credit ? `© ${credit}${isVideo ? ' · Video' : ''}` : badge;
  }

  _showVideo(item) {
    if (!this.video) return;
    // hide image layers behind video
    this.layerA.style.opacity = '0';
    this.layerB.style.opacity = '0';

    const src = item?.src;
    if (!src) return;

    // poster is optional
    if (item?.poster) this.video.poster = item.poster;
    else this.video.removeAttribute('poster');

    if (this.video.src !== new URL(src, window.location.href).href) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
      this.video.src = src;
    }

    try {
      this.video.currentTime = 0;
    } catch {
      // ignore
    }

    this.video.classList.add('is-on');
    const p = this.video.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }

  _hideVideo() {
    if (!this.video) return;
    this.video.classList.remove('is-on');
    // stop & release
    try {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
    } catch {
      // ignore
    }
  }

  _normalizeItems(options) {
    const rawItems = Array.isArray(options?.items) ? options.items : null;
    if (rawItems && rawItems.length) {
      return rawItems
        .filter((x) => x && typeof x.src === 'string' && x.src.trim())
        .map((x) => {
          const it = { type: x.type === 'video' ? 'video' : 'image', src: x.src, credit: x.credit };
          if (typeof x.poster === 'string' && x.poster.trim()) it.poster = x.poster;
          return it;
        });
    }

    // Back-compat: wallpapers.images -> items(type=image)
    const images = Array.isArray(options?.images) ? options.images : [];
    return images
      .filter((x) => x && typeof x.src === 'string' && x.src.trim())
      .map((x) => ({ type: 'image', src: x.src, credit: x.credit }));
  }

  _itemsFromManifest(manifest) {
    const out = [];
    const imgs = Array.isArray(manifest?.images) ? manifest.images : [];
    for (const src of imgs) {
      if (typeof src === 'string' && src.trim()) out.push({ type: 'image', src, credit: '' });
    }
    const vids = Array.isArray(manifest?.videos) ? manifest.videos : [];
    for (const v of vids) {
      if (!v || typeof v.src !== 'string' || !v.src.trim()) continue;
      const item = { type: 'video', src: v.src, credit: '' };
      if (typeof v.poster === 'string' && v.poster.trim()) item.poster = v.poster;
      out.push(item);
    }
    return out;
  }

  _ensureVideoForLayer(which) {
    const host = which === 'A' ? this.layerA : this.layerB;
    const existing = which === 'A' ? this._videoA : this._videoB;
    if (existing) return existing;

    const v = document.createElement('video');
    v.className = 'bgVideo';
    v.autoplay = true;
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.setAttribute('aria-hidden', 'true');
    host.appendChild(v);

    if (which === 'A') this._videoA = v;
    else this._videoB = v;
    return v;
  }

  _setLayerToImage(layer, item) {
    // hide video element if exists
    const v = layer === this.layerA ? this._videoA : this._videoB;
    if (v) v.style.display = 'none';
    layer.style.backgroundImage = `url(${item.src})`;
  }

  _setLayerToVideo(layer, item, which) {
    layer.style.backgroundImage = 'none';
    const v = this._ensureVideoForLayer(which);
    v.style.display = 'block';

    // set src freshly to encourage starting from the beginning
    if (v.src !== new URL(item.src, window.location.href).href) {
      v.pause();
      v.removeAttribute('src');
      v.load();
      v.src = item.src;
    }
    try {
      v.currentTime = 0;
    } catch {
      // ignore
    }
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }

  _stopVideo(v, { releaseSrc = false } = {}) {
    if (!v) return;
    try {
      v.pause();
    } catch {
      // ignore
    }
    if (releaseSrc) {
      try {
        v.removeAttribute('src');
        v.load();
      } catch {
        // ignore
      }
    }
  }

  _preloadImage(src, cb) {
    const img = new Image();
    img.onload = () => cb?.();
    img.onerror = () => cb?.();
    img.src = src;
  }

  _waitVideoCanPlay(v, cb) {
    if (!v) return cb?.();
    const done = () => {
      v.removeEventListener('canplay', done);
      v.removeEventListener('canplaythrough', done);
      v.removeEventListener('loadeddata', done);
      cb?.();
    };
    // If readyState already has data, don't wait.
    if (v.readyState >= 2) return cb?.();
    v.addEventListener('loadeddata', done, { once: true });
    v.addEventListener('canplay', done, { once: true });
    v.addEventListener('canplaythrough', done, { once: true });
  }

  _preloadItem(item) {
    if ((item?.type || 'image') === 'video') {
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.src = item.src;
      try {
        v.load();
      } catch {
        // ignore
      }
      return;
    }
    const img = new Image();
    img.src = item.src;
  }
}
