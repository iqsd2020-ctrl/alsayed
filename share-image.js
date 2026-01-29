/* share-image.js
   توليد صورة (PNG) من بطاقة المسألة + وسم صغير، ثم تنزيل/مشاركة على أندرويد.
   تصوير HTML عبر SVG foreignObject (بدون مكتبات خارجية).
*/
(() => {
  'use strict';

  const APP_NAME = 'منهج النور';
  const APP_ICON = './icon-192.png';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  function closeAllMenus() {
    $$('.imgShareMenu.open').forEach(m => {
      m.classList.remove('open');
      m.setAttribute('aria-hidden', 'true');
    });
  }

  function toggleMenu(id) {
    const menu = $(`.imgShareMenu[data-id="${CSS.escape(id)}"]`);
    if (!menu) return;
    const open = menu.classList.contains('open');
    closeAllMenus();
    if (!open) {
      menu.classList.add('open');
      menu.setAttribute('aria-hidden', 'false');
    }
  }

  function getAllCssText() {
    let css = '';
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = sheet.cssRules;
        if (!rules) continue;
        for (const r of Array.from(rules)) css += r.cssText + '\n';
      } catch (_) {
        // تجاهل أي stylesheet غير قابل للقراءة
      }
    }
    return css;
  }

  function absolutizeCssUrls(cssText) {
    // نحول url(...) النسبية إلى مطلقة حتى لا تنكسر داخل blob: SVG
    return cssText.replace(/url\(([^)]+)\)/g, (m, raw) => {
      let u = String(raw).trim();
      // إزالة علامات الاقتباس
      if ((u.startsWith('"') && u.endsWith('"')) || (u.startsWith("'") && u.endsWith("'"))) {
        u = u.slice(1, -1);
      }
      // تجاهل data/blob/http/https و #anchors
      if (!u || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('http:') || u.startsWith('https:') || u.startsWith('#')) {
        return `url(${raw})`;
      }
      try {
        const abs = new URL(u, document.baseURI).toString();
        const q = raw.trim().startsWith("'") ? "'" : (raw.trim().startsWith('"') ? '"' : '');
        return q ? `url(${q}${abs}${q})` : `url(${abs})`;
      } catch (_) {
        return `url(${raw})`;
      }
    });
  }

  function absolutizeImgSrcs(root) {
    root.querySelectorAll('img[src]').forEach(img => {
      const src = img.getAttribute('src') || '';
      if (!src || src.startsWith('data:') || src.startsWith('blob:') || src.startsWith('http:') || src.startsWith('https:')) return;
      try {
        img.setAttribute('src', new URL(src, document.baseURI).toString());
      } catch (_) {}
    });
  }

  function waitForImages(root) {
    const imgs = Array.from(root.querySelectorAll('img'));
    if (imgs.length === 0) return Promise.resolve();
    return Promise.all(imgs.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise(res => {
        const done = () => {
          img.removeEventListener('load', done);
          img.removeEventListener('error', done);
          res();
        };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      });
    })).then(() => undefined);
  }

  let __iconDataUrl = null;
  async function getIconDataUrl() {
    if (__iconDataUrl) return __iconDataUrl;
    try {
      const abs = new URL(APP_ICON, document.baseURI).toString();
      const res = await fetch(abs, { cache: 'force-cache' });
      const blob = await res.blob();
      __iconDataUrl = await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = () => resolve('');
        r.readAsDataURL(blob);
      });
      return __iconDataUrl || '';
    } catch (_) {
      return '';
    }
  }

  async function captureElementToPng(element, { watermark=true } = {}) {
    const rect = element.getBoundingClientRect();
    const w = Math.ceil(rect.width);
    const pad = 12;

    const stage = document.createElement('div');
    stage.style.position = 'fixed';
    stage.style.left = '-100000px';
    stage.style.top = '0';
    stage.style.width = (w + pad*2) + 'px';
    stage.style.pointerEvents = 'none';
    stage.style.opacity = '0';
    stage.style.zIndex = '-1';

    const wrap = document.createElement('div');
    wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    wrap.style.width = w + 'px';
    wrap.style.padding = pad + 'px';
    wrap.style.boxSizing = 'content-box';
    wrap.style.background = 'transparent';
    wrap.style.direction = 'rtl';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'stretch';

    const clone = element.cloneNode(true);
    // منع أي قوائم/تفاعلات داخل النسخة
    clone.querySelectorAll('button, a').forEach(el => el.setAttribute('tabindex', '-1'));

    wrap.appendChild(clone);

    if (watermark) {
      const wm = document.createElement('div');
      wm.className = 'captureWatermark';
      const iconData = await getIconDataUrl();
      const iconSrc = iconData || new URL(APP_ICON, document.baseURI).toString();
      wm.innerHTML = `<img src="${iconSrc}" alt="${APP_NAME}"><span>${APP_NAME}</span>`;
      wrap.appendChild(wm);
    }

    stage.appendChild(wrap);
    document.body.appendChild(stage);

    // انتظر الخطوط/الصور
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (_) {}

    // مهم: تأكد أن أي src داخل النسخة مطلق
    absolutizeImgSrcs(stage);
    await waitForImages(stage);

    const wrapRect = wrap.getBoundingClientRect();
    const width = Math.ceil(wrapRect.width);
    const height = Math.ceil(wrapRect.height);

    // CSS مع إصلاح url(...) النسبية
    const cssText = absolutizeCssUrls(getAllCssText());
    const styleTag = `<style>${cssText}</style>`;

    const xhtml = wrap.outerHTML;

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;">
      ${styleTag}
      ${xhtml}
    </div>
  </foreignObject>
</svg>`.trim();

    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.decoding = 'async';

    const pngBlob = await new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          const scale = Math.max(2, Math.ceil((window.devicePixelRatio || 1)));
          const canvas = document.createElement('canvas');
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext('2d');
          ctx.setTransform(scale, 0, 0, scale, 0, 0);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('toBlob_failed'));
          }, 'image/png', 1);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('img_load_failed'));
      img.src = url;
    }).finally(() => {
      URL.revokeObjectURL(url);
      stage.remove();
    });

    return pngBlob;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    // المحاولة 1: download attribute
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2500);
      return true;
    } catch (_) {
      // المحاولة 2: فتح في تبويب جديد (ينجح أحياناً في PWA)
      try {
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 8000);
        return true;
      } catch (_) {
        URL.revokeObjectURL(url);
        return false;
      }
    }
  }

  async function shareBlob(blob, filename) {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: APP_NAME });
      return true;
    }
    return false;
  }

  // ===== أحداث =====
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.imgShareBtn');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-id') || '';
      if (!id) return;
      toggleMenu(id);
      return;
    }

    const actionBtn = e.target.closest('.imgShareAction');
    if (actionBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = actionBtn.getAttribute('data-id') || '';
      const action = actionBtn.getAttribute('data-action') || '';
      closeAllMenus();

      const card = $(`article.card[data-id="${CSS.escape(id)}"]`);
      if (!card) return;

      try {
        const blob = await captureElementToPng(card, { watermark: true });
        const filename = `مسألة-${id}.png`;

        if (action === 'share') {
          const ok = await shareBlob(blob, filename);
          if (!ok) {
            const dlOk = downloadBlob(blob, filename);
            if (!dlOk) throw new Error('download_failed');
          }
        } else {
          const dlOk = downloadBlob(blob, filename);
          if (!dlOk) throw new Error('download_failed');
        }
      } catch (err) {
        // رسائل أوضح حسب سبب الفشل
        try {
          const msg = (err && String(err).includes('download_failed')) ? 'تعذر التنزيل' : 'تعذر إنشاء الصورة';
          if (window.toast) window.toast(msg);
        } catch (_) {}
      }
      return;
    }

    // أي نقرة خارج القائمة تغلقها
    closeAllMenus();
  }, true);

  window.addEventListener('scroll', closeAllMenus, { passive: true });
  window.addEventListener('resize', closeAllMenus, { passive: true });
})();
