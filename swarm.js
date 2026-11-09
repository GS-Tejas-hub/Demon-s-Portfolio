/* ============================================================
   G S TEJAS · PORTFOLIO V3 · SWARM BUILD
   Open the page and a swarm of agents builds it in front of you:
   crosshair boxes with a live W × H readout, copy typed behind a
   caret, pen-tool lines, ruler guides, alt-drag duplicates and
   image drops. Sections further down are built when you scroll
   to them, so the swarm follows you down the page.

   Nothing is cloned. Every layer stays in the real DOM, hidden
   until an agent places it, so links, the cursor lens, the anime
   coverflow and the live GitHub stats keep working throughout.

   Esc or SKIP finishes instantly. Reduced motion, bots and
   ?swarm=0 get the classic intro (see the boot script in
   index.html). ?swarm=1 forces the build on.

   Concept inspired by Swarm by Joel Califa
   (califa.github.io/swarm-site). Engine written for this site.
   ============================================================ */

(function () {
    'use strict';

    var root = document.documentElement;
    if (!root.classList.contains('sw-on') || !window.requestAnimationFrame || !window.Promise) return;
    window.__swarmAlive = true;

    /* ============ CONFIG ============ */
    const ROSTER = [
        ['ONI', '#FF3B3B'], ['KITSUNE', '#FF9D3B'], ['RAIJIN', '#4DA3FF'], ['KAPPA', '#6EE787'],
        ['KAGE', '#A78BFA'], ['TENGU', '#F2C94C'], ['YUKI', '#5CE1E6'], ['TANUKI', '#FF6FB1']
    ];
    const SMALL = window.matchMedia('(max-width: 768px)').matches;
    const COUNT = SMALL ? 5 : 8;
    const PACE = 1.15;              // global tempo, raise to build faster

    // What gets built, top to bottom. Kinds:
    //   rect      crosshair drag with a live W × H badge, then the fill fades in
    //   text      drag a text box, then type it behind a caret
    //   pen       pen-tool anchors and a rubber band, the line draws along
    //   media     drag a frame, drop a placeholder, sweep the image in
    //   dup       select a built sibling and alt-drag a copy into place
    //   backdrop, emblem, stage, guide: one-off moves for the hero and coverflow
    // A layer waits for the nearest layer that contains it (a card waits for
    // its panel), and a duplicate waits for the first of its siblings.
    const PLAN = [
        ['#home', 'backdrop', { hide: '.hero-bg, .hero-tint, .hero-glow', prefer: 0, pri: -2 }],
        ['.hero-name', 'guide', { axis: 'x', pri: -1, desktop: true }],
        ['.hero-name', 'guide', { axis: 'y', pri: -1, desktop: true }],
        ['.brand-mark', 'text'],
        ['.brand-divider', 'pen', { path: 'v' }],
        ['.brand-sub', 'text'],
        ['.header-coords', 'text'],
        ['.nav-desktop .nav-link', 'dup', { first: 'text', then: 'text' }],
        ['.nav-toggle', 'rect'],
        ['.hero .corner', 'pen', { path: 'corner' }],
        ['.hero-kicker', 'text'],
        ['.hn-first', 'text'],
        ['.hn-last', 'text'],
        ['.hero-emblem', 'emblem'],
        ['.hero-tag', 'text'],
        ['.hero-col', 'text'],
        ['.hero-hud', 'rect'],

        ['#about .sec-head', 'text'],
        ['.statement', 'text'],
        ['.intro-frame', 'media'],
        ['.img-quote', 'text'],
        ['.about-left .body-text', 'text'],
        ['.stat-grid', 'rect'],
        ['.stat-box', 'dup'],
        ['.risk-quote', 'text'],
        ['.tools-row', 'rect'],
        ['.tool-group', 'dup'],

        ['.anime', 'rect', { frame: 'TOP PICKS' }],
        ['.anime-kicker', 'text'],
        ['.anime-title', 'text'],
        ['.anime-sub', 'text'],
        ['#animeStage', 'stage'],

        ['#experience', 'rect', { frame: 'WORK' }],
        ['#experience .sec-head', 'text'],
        ['#experience .sec-title', 'text'],
        ['.xp-list', 'pen', { path: 'top' }],
        ['.xp-row', 'dup'],

        ['#projects .mega-title', 'text'],
        ['#projects .mega-sub', 'text'],
        ['.proj-panel', 'rect'],
        ['.pp-links', 'rect'],
        ['.pp-title', 'text'],
        ['.pp-desc', 'text'],
        ['.pp-tags', 'rect'],
        ['.laptop', 'rect'],
        ['.laptop-screen > img, .shot-locked', 'media'],
        ['.archive-label', 'text'],
        ['.archive-row', 'dup'],

        ['#research', 'rect', { frame: 'RESEARCH' }],
        ['#research .sec-head', 'text'],
        ['.research-card', 'dup'],

        ['#contact .mega-title', 'text'],
        ['#contact .mega-sub', 'text'],
        ['.contact-actions .btn', 'dup'],
        ['.contact-meta-row', 'dup'],
        ['.contact-socials .social-icon', 'dup'],
        ['.contact-form', 'rect'],
        ['.contact-form .field', 'dup'],
        ['.btn-submit', 'rect'],
        ['.destiny-quote', 'text'],
        ['.destiny-by', 'text'],

        ['.site-footer', 'pen', { path: 'top' }],
        ['.footer-inner > *', 'text']
    ];

    const SECTIONS = { home: 'HERO', about: 'ABOUT', experience: 'WORK', projects: 'PROJECTS', research: 'RESEARCH', contact: 'CONTACT' };
    const STOP = new Error('swarm:stop');   // thrown through a script when its job is cancelled

    /* ============ HELPERS ============ */
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function el(tag, cls, parent, html) {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (html) n.innerHTML = html;
        if (parent) parent.appendChild(n);
        return n;
    }
    function place(n, x, y) {
        x = Math.round(x * 10) / 10; y = Math.round(y * 10) / 10;
        if (n._x === x && n._y === y) return;
        n._x = x; n._y = y;
        n.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    }
    function size(n, w, h) {
        w = Math.max(0, Math.round(w * 10) / 10); h = Math.max(0, Math.round(h * 10) / 10);
        if (n._w !== w) { n._w = w; n.style.width = w + 'px'; }
        if (n._h !== h) { n._h = h; n.style.height = h + 'px'; }
    }
    function rgba(hex, a) {
        const v = parseInt(hex.slice(1), 16);
        return 'rgba(' + (v >> 16 & 255) + ',' + (v >> 8 & 255) + ',' + (v & 255) + ',' + a + ')';
    }
    function fileName(e) {
        const img = e.tagName === 'IMG' ? e : e.querySelector('img');
        return img ? (img.getAttribute('src') || 'image').split('/').pop() : 'image';
    }
    function fmt(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

    // Pointer shapes, drawn for this site. The hotspot is the element origin.
    function cursorSVG(c) {
        const o = '#F4F1EC';
        const arrow = '<path d="M2 2 L2 17.6 L6.1 13.9 L9.1 20.4 L11.9 19.1 L8.9 12.8 L14.6 12.5 Z" fill="' + c + '" stroke="' + o + '" stroke-width="1.4" stroke-linejoin="round"/>';
        return '' +
            '<svg class="k k-arrow" width="20" height="22" viewBox="0 0 20 22" style="left:-2px;top:-2px">' + arrow + '</svg>' +
            '<svg class="k k-dup" width="26" height="26" viewBox="0 0 26 26" style="left:-2px;top:-2px">' + arrow +
                '<circle cx="19" cy="19" r="5" fill="' + o + '"/><path d="M19 16.4v5.2M16.4 19h5.2" stroke="#0b0b0d" stroke-width="1.6" stroke-linecap="round"/></svg>' +
            '<svg class="k k-cross" width="22" height="22" viewBox="-11 -11 22 22" style="left:-11px;top:-11px">' +
                '<path d="M0-9V9M-9 0H9" stroke="' + o + '" stroke-width="3.4" stroke-linecap="round"/>' +
                '<path d="M0-9V9M-9 0H9" stroke="' + c + '" stroke-width="1.5" stroke-linecap="round"/></svg>' +
            '<svg class="k k-text" width="14" height="24" viewBox="-7 -12 14 24" style="left:-7px;top:-12px">' +
                '<path d="M-4-10H4M0-10V10M-4 10H4" stroke="' + o + '" stroke-width="3.4" stroke-linecap="round"/>' +
                '<path d="M-4-10H4M0-10V10M-4 10H4" stroke="' + c + '" stroke-width="1.5" stroke-linecap="round"/></svg>' +
            '<svg class="k k-pen" width="22" height="22" viewBox="0 0 22 22" style="left:-2px;top:-20px">' +
                '<path d="M2 20 L4.6 12.9 L13.6 3.9 Q15 2.5 16.4 3.9 L18.1 5.6 Q19.5 7 18.1 8.4 L9.1 17.4 Z" fill="' + c + '" stroke="' + o + '" stroke-width="1.4" stroke-linejoin="round"/>' +
                '<circle cx="7.6" cy="14.4" r="1.3" fill="#0b0b0d"/></svg>';
    }

    // Character boxes of an element's text, relative to its border box, in
    // reading order. Each stop knows its line and how far the lines above reach.
    function measure(e) {
        const base = e.getBoundingClientRect(), out = [], rg = document.createRange();
        const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, null);
        let node, ln = -1, lineTop = 0, lineBot = 0, prevBot = 0;
        while ((node = tw.nextNode())) {
            const s = node.nodeValue;
            for (let i = 0; i < s.length;) {
                const code = s.charCodeAt(i), at = i;
                i += (code >= 0xD800 && code <= 0xDBFF && i + 1 < s.length) ? 2 : 1;
                if (code <= 32 || code === 160) continue;
                rg.setStart(node, at); rg.setEnd(node, i);
                const rs = rg.getClientRects();
                if (!rs.length) continue;
                const q = rs[rs.length - 1];
                if (!q.width && !q.height) continue;
                const top = q.top - base.top, bot = q.bottom - base.top;
                if (ln < 0 || top > lineTop + (bot - top) * 0.6) {
                    if (ln >= 0) prevBot = Math.max(prevBot, lineBot);
                    ln++; lineTop = top; lineBot = bot;
                } else if (bot > lineBot) lineBot = bot;
                out.push({ l: q.left - base.left, x: q.right - base.left, t: top, b: bot, pb: prevBot, ln: ln, c: s.charAt(i - 1) });
            }
        }
        return out;
    }

    // Typing mask: every line above the caret line, plus the caret line up to the
    // caret. Generous padding keeps glyph overhang and text stroke visible.
    function clipAt(st, k, r) {
        if (k >= st.length) return '';
        if (k <= 0) return 'polygon(0 0,0 0,0 0)';
        const s = st[k - 1], P = 600, W = r.width;
        const y = s.ln ? Math.max(s.pb, s.t) : -P;
        return 'polygon(' + -P + 'px ' + -P + 'px,' + (W + P) + 'px ' + -P + 'px,' + (W + P) + 'px ' + y + 'px,' +
            s.x + 'px ' + y + 'px,' + s.x + 'px ' + s.b + 'px,' + -P + 'px ' + s.b + 'px)';
    }

    // Pen mask: a thin band along each finished segment plus the live one.
    function penClip(pts, seg, p) {
        const T = 3;
        let d = '';
        for (let i = 0; i <= seg && i < pts.length - 1; i++) {
            const A = pts[i], B = i < seg ? pts[i + 1] : [lerp(pts[i][0], pts[i + 1][0], p), lerp(pts[i][1], pts[i + 1][1], p)];
            const x1 = (Math.min(A[0], B[0]) - T).toFixed(1), x2 = (Math.max(A[0], B[0]) + T).toFixed(1);
            const y1 = (Math.min(A[1], B[1]) - T).toFixed(1), y2 = (Math.max(A[1], B[1]) + T).toFixed(1);
            d += 'M' + x1 + ' ' + y1 + 'H' + x2 + 'V' + y2 + 'H' + x1 + 'Z';
        }
        return "path('" + (d || 'M0 0Z') + "')";
    }

    function penPath(t) {
        const kind = t.o.path, c = t.el.className;
        if (kind === 'corner') {
            return function (r) {
                const W = r.width, H = r.height, b = 1;
                if (/corner-tl/.test(c)) return [[W, b], [b, b], [b, H]];
                if (/corner-tr/.test(c)) return [[0, b], [W - b, b], [W - b, H]];
                if (/corner-bl/.test(c)) return [[b, 0], [b, H - b], [W, H - b]];
                return [[W - b, 0], [W - b, H - b], [0, H - b]];
            };
        }
        if (kind === 'v') return function (r) { return [[r.width / 2, 0], [r.width / 2, r.height]]; };
        return function (r) { return [[0, 0.5], [r.width, 0.5]]; };
    }

    function imgReady(e, ms) {
        const img = e.tagName === 'IMG' ? e : e.querySelector('img');
        if (!img || (img.complete && img.naturalWidth > 0)) return Promise.resolve();
        try { img.loading = 'eager'; } catch (_) { /* older engines */ }
        return Promise.race([
            new Promise(function (r) {
                img.addEventListener('load', r, { once: true });
                img.addEventListener('error', r, { once: true });
            }),
            delay(ms)
        ]);
    }

    function fontsSettled() {
        return document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, delay(1600)]) : Promise.resolve();
    }

    // Count the stat numbers up once an agent has placed their box.
    function countUp(scope) {
        const vals = scope.querySelectorAll ? scope.querySelectorAll('.stat-value') : [];
        Array.prototype.forEach.call(vals, function (v) {
            const t0 = performance.now();
            (function step(now) {
                const p = Math.min(1, (now - t0) / 1100);
                const goal = parseInt(v.getAttribute('data-count'), 10) || 0;
                v.textContent = Math.round(goal * easeOut(p));
                if (p < 1) requestAnimationFrame(step);
                else v.dataset.animated = '1';
            })(t0);
        });
    }

    // Last resort: whatever happened, show the finished page.
    function hardReveal() {
        root.classList.remove('sw-boot', 'sw-intro');
        document.querySelectorAll('.sw-hide').forEach(function (e) { e.classList.remove('sw-hide'); });
        document.querySelectorAll('[style*="clip-path"]').forEach(function (e) { e.style.clipPath = ''; });
        document.querySelectorAll('.sw-layer, .sw-canvas, .sw-hud').forEach(function (n) { n.remove(); });
    }

    /* ============ ONE BUILD ============ */
    function run() {
        const tasks = [], pending = [], running = [], agents = [], uis = [], ctxs = [];
        let timers = [], tweens = [];
        let vw = window.innerWidth, vh = window.innerHeight;
        let clock = 0, rush = 1, phase = 0, built = 0, total = 0, frameNo = 0, raf = 0, last = 0;
        let mx = vw / 2, my = vh / 2, hasMouse = false, sy = window.scrollY, svel = 0;
        let ox = vw / 2, oy = vh / 2;              // orbit centre
        let heroDone = false, dead = false, quiet = false, guides = [];
        let layer = null, canvas = null, hud = null, rulers = null, sys = null;
        const born = performance.now();

        /* ---- engine clock: every wait and tween runs on it, so the swarm
                can rush when it falls behind and freeze in background tabs ---- */
        function tick(dt) {
            clock += dt;
            if (tweens.length) {
                const list = tweens.slice();
                for (let i = 0; i < list.length; i++) {
                    const j = list[i], p = Math.min(1, (clock - j.t0) / j.dur);
                    j.fn(p);
                    if (p >= 1) { j.done = true; j.res(); }
                }
                tweens = tweens.filter(function (j) { return !j.done; });
            }
            if (timers.length) {
                const due = timers.filter(function (j) { return clock >= j.at; });
                if (due.length) {
                    timers = timers.filter(function (j) { return clock < j.at; });
                    due.forEach(function (j) { j.res(); });
                }
            }
        }

        /* ---- a job context: everything an agent's script awaits belongs to
                it, so cancelling a job unwinds its script immediately ---- */
        class Ctx {
            constructor(a, t) { this.a = a; this.t = t; this.dead = false; }
            wait(ms) {
                if (this.dead || dead) return Promise.reject(STOP);
                return new Promise((res, rej) => { timers.push({ at: clock + ms, res, rej, c: this }); });
            }
            tween(ms, fn) {
                if (this.dead || dead) return Promise.reject(STOP);
                return new Promise((res, rej) => { tweens.push({ t0: clock, dur: Math.max(1, ms), fn, res, rej, c: this }); });
            }
            hold(p) {
                return Promise.resolve(p).then((v) => { if (this.dead || dead) throw STOP; return v; });
            }
            kill() {
                if (this.dead) return;
                this.dead = true;
                timers = timers.filter((j) => { if (j.c === this) { j.rej(STOP); return false; } return true; });
                tweens = tweens.filter((j) => { if (j.c === this) { j.rej(STOP); return false; } return true; });
            }
            // A slightly curved flight to a point that may move (scroll) on the way.
            fly(to) {
                const a = this.a, sx = a.x, sy0 = a.y, p0 = to();
                const d = Math.hypot(p0[0] - sx, p0[1] - sy0);
                a.show();
                if (d < 3) { a.follow = to; return Promise.resolve(); }
                const bend = rnd(-0.22, 0.22) * d, st = { p: 0 };
                a.follow = function () {
                    const e = to(), k = ease(st.p), dx = e[0] - sx, dy = e[1] - sy0, L = Math.hypot(dx, dy) || 1;
                    const qx = (sx + e[0]) / 2 - dy / L * bend, qy = (sy0 + e[1]) / 2 + dx / L * bend, u = 1 - k;
                    return [u * u * sx + 2 * u * k * qx + k * k * e[0], u * u * sy0 + 2 * u * k * qy + k * k * e[1]];
                };
                return this.tween(clamp(200 + d * 0.36, 230, 800), function (p) { st.p = p; }).then(function () { a.follow = to; });
            }
            press() { this.a.down(true); ping(this.a); return this.wait(70); }
            release() { this.a.down(false); }
            click() { return this.press().then(() => { this.release(); return this.wait(50); }); }
        }

        /* ---- agents ---- */
        class Agent {
            constructor(i) {
                const spec = ROSTER[i];
                this.i = i; this.name = spec[0]; this.color = spec[1];
                this.x = vw / 2; this.y = vh / 2; this.vx = 0; this.vy = 0; this.hx = this.x; this.hy = this.y;
                this.mode = 'orbit'; this.th = i / COUNT * Math.PI * 2;
                this.w = (i % 2 ? 1 : -1) * rnd(0.0017, 0.0027);
                this.rad = SMALL ? rnd(56, 112) : rnd(110, 190);
                this.follow = null; this.task = null; this.idleAt = 0; this.vis = false; this.k = ''; this.label = null;
                this.n = el('div', 'sw-agent', layer,
                    '<span class="sw-cur">' + cursorSVG(this.color) + '</span><span class="sw-tag"><b>' + this.name + '</b><em></em></span>');
                this.n.style.setProperty('--c', this.color);
                this.em = this.n.querySelector('em');
                this.tool('arrow'); this.say('');
                place(this.n, this.x, this.y);
            }
            tool(k) { if (this.k !== k) { this.k = k; this.n.setAttribute('data-tool', k); } }
            say(s) { if (this.label !== s) { this.label = s; this.em.textContent = s; } }
            down(on) { this.n.classList.toggle('down', !!on); }
            show() { if (!this.vis) { this.vis = true; this.n.classList.add('on'); } }
            hide() { if (this.vis) { this.vis = false; this.n.classList.remove('on'); } }
        }

        /* ---- overlay pieces; each one can re-bind to a live rect every frame ---- */
        function ui(t, cls, color, html) {
            const n = el('div', cls, layer, html);
            if (color) n.style.setProperty('--c', color);
            const it = { n: n, t: t, upd: null, gone: false };
            uis.push(it);
            if (t) t.ui.push(it);
            return it;
        }
        function zap(it) {
            it.gone = true;
            it.n.remove();
            const k = uis.indexOf(it);
            if (k >= 0) uis.splice(k, 1);
        }
        function drop(it, ms) {
            if (!it || it.gone) return;
            it.gone = true;
            if (it.t) { const k = it.t.ui.indexOf(it); if (k >= 0) it.t.ui.splice(k, 1); }
            it.n.classList.add('sw-gone');
            setTimeout(function () { zap(it); }, ms == null ? 240 : ms);
        }
        function box(t, a, mods) {
            const it = ui(t, 'sw-box' + (mods ? ' ' + mods : ''), a.color, '<i></i><i></i><i></i><i></i>');
            it.n.style.setProperty('--f', rgba(a.color, 0.08));
            it.set = function (x, y, w, h) { place(it.n, x, y); size(it.n, w, h); };
            return it;
        }
        function badge(t, a) {
            const it = ui(t, 'sw-badge', a.color, '<span></span>');
            const s = it.n.firstChild;
            let txt = '';
            it.set = function (x, y, v) { place(it.n, x, y); if (v !== txt) { txt = v; s.textContent = v; } };
            return it;
        }
        function caret(t, a, w) {
            const it = ui(t, 'sw-caret', a.color);
            it.n.style.width = w + 'px';
            it.upd = function () {
                const st = t.stops;
                if (!st || !st.length) return;
                const k = Math.min(t.k, st.length);
                const s = k ? st[k - 1] : st[0], x = k ? s.x + 1 : s.l - w - 1;
                place(it.n, t.r.left + x, t.r.top + s.t);
                size(it.n, w, s.b - s.t);
            };
            return it;
        }
        function band(t, a) {
            const it = ui(t, 'sw-line', a.color);
            it.set = function (x1, y1, x2, y2) {
                const dx = x2 - x1, dy = y2 - y1;
                it.n.style.width = Math.hypot(dx, dy).toFixed(1) + 'px';
                it.n.style.transform = 'translate3d(' + x1.toFixed(1) + 'px,' + y1.toFixed(1) + 'px,0) rotate(' + Math.atan2(dy, dx).toFixed(4) + 'rad)';
            };
            return it;
        }
        function anchor(t, a, at) {
            const it = ui(t, 'sw-anchor', a.color);
            it.upd = function () { const p = at(); place(it.n, p[0], p[1]); };
            it.upd();
            return it;
        }
        function placeholder(t, label) {
            const it = ui(t, 'sw-ph', null,
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 9"/></svg><span></span>');
            it.n.lastChild.textContent = label;
            it.upd = function () { place(it.n, t.r.left, t.r.top); size(it.n, t.r.width, t.r.height); };
            it.upd();
            return it;
        }
        // Red spacing readout between the source and the copy being dragged out
        function gap(t, s, G) {
            const it = ui(t, 'sw-gap', null, '<i></i><b></b>');
            const ln = it.n.firstChild, lb = it.n.lastChild;
            const horiz = Math.abs(t.r.left - s.r.left) > Math.abs(t.r.top - s.r.top);
            it.upd = function () {
                const S = s.r, q = G();
                let x, y, len;
                if (horiz) {
                    const qr = q.left + q.width;
                    if (q.left >= S.right) { x = S.right; len = q.left - S.right; }
                    else if (qr <= S.left) { x = qr; len = S.left - qr; }
                    else len = 0;
                    y = (Math.max(S.top, q.top) + Math.min(S.bottom, q.top + q.height)) / 2;
                } else {
                    const qb = q.top + q.height;
                    if (q.top >= S.bottom) { y = S.bottom; len = q.top - S.bottom; }
                    else if (qb <= S.top) { y = qb; len = S.top - qb; }
                    else len = 0;
                    x = (Math.max(S.left, q.left) + Math.min(S.right, q.left + q.width)) / 2;
                }
                if (len < 2) { it.n.style.opacity = '0'; return; }
                it.n.style.opacity = '';
                place(it.n, x, y);
                if (horiz) { size(ln, len, 1); lb.style.left = len / 2 + 'px'; lb.style.top = '0px'; }
                else { size(ln, 1, len); lb.style.left = '0px'; lb.style.top = len / 2 + 'px'; }
                const v = String(Math.round(len));
                if (lb.textContent !== v) lb.textContent = v;
            };
            return it;
        }
        function ping(a) {
            if (!layer) return;
            const n = el('div', 'sw-ping', layer);
            n.style.setProperty('--c', a.color);
            n.style.left = a.x + 'px'; n.style.top = a.y + 'px';
            setTimeout(function () { n.remove(); }, 480);
        }

        /* ---- rulers (desktop): Figma-style chrome for the hero build ---- */
        function makeRulers() {
            const rx = el('div', 'sw-ruler sw-ruler-x', layer), ry = el('div', 'sw-ruler sw-ruler-y', layer);
            el('div', 'sw-ruler-c', layer);
            function render() {
                let hx = '', hy = '';
                for (let x = 100; x < vw; x += 100) hx += '<span style="left:' + x + 'px">' + x + '</span>';
                for (let y = 100; y < vh; y += 100) hy += '<span style="top:' + y + 'px">' + y + '</span>';
                rx.innerHTML = hx; ry.innerHTML = hy;
            }
            render();
            return { render: render };
        }

        /* ---- status pill ---- */
        function makeHud() {
            const n = el('div', 'sw-hud');
            n.setAttribute('role', 'region');
            n.setAttribute('aria-label', 'Live build');
            n.innerHTML =
                '<span class="sw-av" aria-hidden="true">' +
                ROSTER.slice(0, COUNT).map(function (r) { return '<i style="--c:' + r[1] + '">' + r[0].charAt(0) + '</i>'; }).join('') +
                '</span><span class="sw-msg"></span><span class="sw-bar" aria-hidden="true"><i></i></span>' +
                '<span class="sw-pct">0%</span><button type="button" class="sw-btn" aria-label="Skip the live build">SKIP</button>';
            const msg = n.querySelector('.sw-msg'), bar = n.querySelector('.sw-bar i'), pct = n.querySelector('.sw-pct'), btn = n.querySelector('.sw-btn');
            let sec = 'HERO', flashUntil = 0, flashHtml = '', isDone = false, quietSince = 0, shown = false, lastHtml = '';

            btn.addEventListener('click', function () { if (isDone) launch(); else skip(); });
            const ring = document.getElementById('cursorRing');
            if (ring) {
                btn.addEventListener('mouseenter', function () { ring.classList.add('grow'); });
                btn.addEventListener('mouseleave', function () { ring.classList.remove('grow'); });
            }
            function set(html) { if (html !== lastHtml) { lastHtml = html; msg.innerHTML = html; } }
            function render() {
                if (isDone) return;
                const p = total ? Math.min(100, Math.floor(built / total * 100)) : 0;
                bar.style.setProperty('--p', (p / 100).toFixed(3));
                pct.textContent = p + '%';
                if (performance.now() < flashUntil) set(flashHtml);
                else set('<b>' + COUNT + '</b><span class="wide"> AGENTS</span><s>/</s>BUILDING ' + sec);
            }
            const api = {
                n: n,
                show: function () { if (!shown) { shown = true; n.classList.add('on'); } },
                hide: function () { if (shown) { shown = false; n.classList.remove('on'); } },
                section: function (s) { sec = s; render(); },
                progress: render,
                flash: function (html, ms) { flashHtml = html; flashUntil = performance.now() + (ms || 2000); quietSince = 0; api.show(); render(); },
                tick: function () {
                    if (isDone || phase !== 1) return;
                    render();
                    const now = performance.now();
                    if (running.some(function (t) { return !t.virtual; })) { quietSince = 0; api.show(); }
                    else if (now > flashUntil) {
                        if (!quietSince) quietSince = now;
                        if (now - quietSince > 2400) api.hide();
                    }
                },
                done: function (count, secs) {
                    isDone = true;
                    n.classList.add('done');
                    set('<span class="ok">✓</span> BUILT LIVE BY <b>' + COUNT + '</b> AGENTS<span class="wide"><s>/</s>' + count + ' LAYERS<s>/</s>' + fmt(secs) + '</span>');
                    btn.textContent = 'REPLAY';
                    btn.setAttribute('aria-label', 'Replay the live build');
                    api.show();
                },
                retire: function (ms) { setTimeout(function () { api.hide(); setTimeout(function () { n.remove(); }, 700); }, ms); }
            };
            return api;
        }

        /* ============ PLAN → TASKS ============ */
        function sectionOf(e) {
            if (e.closest('.site-header')) return 'HEADER';
            if (e.closest('.site-footer')) return 'FOOTER';
            const s = e.closest('section');
            if (!s) return 'PAGE';
            return SECTIONS[s.id] || (s.classList.contains('anime') ? 'TOP PICKS' : 'PAGE');
        }
        function task(e, kind, o) {
            return {
                el: e, kind: kind, o: o, state: 0, ready: false, deps: [], master: null, group: null, src: null,
                hide: kind === 'guide' ? [] : o.hide ? Array.prototype.slice.call(e.querySelectorAll(o.hide)) : [e],
                r: null, ui: [], agent: null, ctx: null, vis: false, since: 0, k: 0, stops: null,
                section: sectionOf(e), fixed: !!e.closest('.site-header'), virtual: kind === 'guide', order: 0
            };
        }
        function collect() {
            const seen = new Set();
            PLAN.forEach(function (row) {
                const sel = row[0], kind = row[1], o = row[2] || {};
                if (o.desktop && SMALL) return;
                const els = Array.prototype.slice.call(document.querySelectorAll(sel));
                if (kind === 'dup') {
                    const groups = new Map();
                    els.forEach(function (e) {
                        if (seen.has(e)) return;
                        if (!groups.has(e.parentNode)) groups.set(e.parentNode, []);
                        groups.get(e.parentNode).push(e);
                    });
                    groups.forEach(function (g) {
                        const grp = [];
                        let master = null;
                        g.forEach(function (e, i) {
                            const t = task(e, i ? 'dup' : (o.first || 'rect'), o);
                            if (i) t.master = master; else master = t;
                            t.group = grp; grp.push(t); tasks.push(t); seen.add(e);
                        });
                    });
                    return;
                }
                els.forEach(function (e) {
                    if (kind !== 'guide') { if (seen.has(e)) return; seen.add(e); }
                    tasks.push(task(e, kind, o));
                });
            });
        }
        function wire() {
            const byEl = new Map();
            tasks.forEach(function (t, i) { t.order = i; if (!t.virtual) byEl.set(t.el, t); });
            tasks.forEach(function (t) {
                if (t.virtual) return;
                for (let p = t.el.parentElement; p && p !== document.body; p = p.parentElement) {
                    const pt = byEl.get(p);
                    if (pt) { t.deps.push(pt); break; }
                }
                if (t.master) t.deps.push(t.master);
            });
            tasks.sort(function (a, b) {
                const pa = a.o.pri || 0, pb = b.o.pri || 0;
                if (pa !== pb) return pa - pb;
                if (a.el === b.el) return a.order - b.order;
                return a.el.compareDocumentPosition(b.el) & 4 ? -1 : 1;
            });
        }
        function depsReady(t) {
            for (let i = 0; i < t.deps.length; i++) if (!t.deps[i].ready) return false;
            return true;
        }

        /* ============ JOB LIFECYCLE ============ */
        function start(a, t) {
            pending.splice(pending.indexOf(t), 1);
            running.push(t);
            t.state = 1; t.agent = a; a.task = t;
            const c = t.ctx = new Ctx(a, t);
            ctxs.push(c);
            a.mode = 'work';
            if (!t.virtual) hud.section(t.section);
            Promise.resolve()
                .then(function () { return (KIND[t.kind] || KIND.rect)(c); })
                .then(function () { finish(t); }, function (err) {
                    if (err !== STOP) { console.warn('[swarm] job failed, placing it directly', err); placeNow(t); }
                })
                .then(function () { release(a, t, c); });
        }
        function release(a, t, c) {
            const k = ctxs.indexOf(c);
            if (k >= 0) ctxs.splice(k, 1);
            if (a.task !== t) return;
            a.task = null; a.follow = null; a.down(false);
            a.hx = a.x; a.hy = a.y; a.vx = 0; a.vy = 0;
            a.mode = 'idle'; a.idleAt = clock;
            a.tool('arrow'); a.say('');
        }
        function clean(t) {
            t.hide.forEach(function (e) { e.classList.remove('sw-hide'); e.style.clipPath = ''; e.style.opacity = ''; });
            if (!t.virtual) t.el.style.clipPath = '';
            if (t.kind === 'emblem') t.el.style.transform = '';
            t.ui.slice().forEach(function (it) { drop(it, 180); });
        }
        function finish(t) {
            if (t.state >= 2) return;
            const animated = t.state === 1 && !(t.ctx && t.ctx.dead);
            t.state = 2; t.ready = true;
            let k = running.indexOf(t);
            if (k >= 0) running.splice(k, 1);
            k = pending.indexOf(t);
            if (k >= 0) pending.splice(k, 1);
            clean(t);
            if (!t.virtual) { built++; hud.progress(); }
            if (animated && !quiet && !t.virtual) countUp(t.el);
            milestones();
        }
        // Skip the choreography and put the layer where it belongs.
        function placeNow(t) {
            if (t.state >= 2) return;
            if (t.ctx) t.ctx.kill();
            finish(t);
        }

        /* ============ BUILD MOVES ============ */
        function TL(t, dx, dy) { return function () { return [t.r.left + (dx || 0), t.r.top + (dy || 0)]; }; }
        function AT(t, fx, fy) { return function () { return [t.r.left + t.r.width * fx, t.r.top + t.r.height * fy]; }; }
        function inView(x, y) { return [clamp(x, 6, vw - 6), clamp(y, 6, vh - 6)]; }

        // Crosshair drag from the top-left corner to the bottom-right one, with a
        // live W × H readout underneath. Frames taller than the screen keep the
        // cursor on screen while the selection runs past the fold.
        async function drag(c, tag) {
            const a = c.a, t = c.t, st = { p: 0 };
            a.tool('cross');
            await c.press();
            const b = box(t, a), bd = badge(t, a), pre = tag ? tag + '  ' : '';
            // a big selection gets a fainter wash, so whole sections never look tinted
            const area = t.r.width * Math.min(t.r.height, vh);
            b.n.style.setProperty('--f', rgba(a.color, area > 250000 ? 0.022 : area > 60000 ? 0.045 : 0.08));
            b.upd = function () { const r = t.r; b.set(r.left, r.top, r.width * st.p, r.height * st.p); };
            bd.upd = function () {
                const r = t.r, w = r.width * st.p, h = r.height * st.p, p = inView(r.left + w / 2, r.top + h + 8);
                bd.set(clamp(p[0], 60, vw - 60), Math.min(p[1], vh - 26), pre + Math.round(w) + ' × ' + Math.round(h));
            };
            a.follow = function () { const r = t.r; return inView(r.left + r.width * st.p, r.top + r.height * st.p); };
            const r0 = t.r, hh = Math.min(r0.height, vh), diag = Math.sqrt(r0.width * r0.width + hh * hh);
            await c.tween(clamp(190 + diag * 0.33, 260, 720), function (p) { st.p = ease(p); });
            c.release();
            b.n.classList.add('handles');
            return { b: b, bd: bd };
        }

        async function fade(c, els, ms) {
            const to = els.map(function (e) { const v = parseFloat(getComputedStyle(e).opacity); return isNaN(v) ? 1 : v; });
            els.forEach(function (e) { e.style.opacity = '0'; e.classList.remove('sw-hide'); });
            await c.tween(ms, function (p) {
                const k = easeOut(p);
                els.forEach(function (e, i) { e.style.opacity = (to[i] * k).toFixed(3); });
            });
            els.forEach(function (e) { e.style.opacity = ''; });
        }

        // Type the element's own text behind a caret. Display type goes letter
        // by letter; body copy goes in quick bursts so it never holds you up.
        async function type(c) {
            const t = c.t, e = t.el, a = c.a;
            await c.hold(fontsSettled());
            const fs = parseFloat(getComputedStyle(e).fontSize) || 16;
            t.r = e.getBoundingClientRect();
            t.stops = measure(e);
            t.k = 0;
            e.style.clipPath = clipAt(t.stops, 0, t.r);
            t.hide.forEach(function (h) { h.classList.remove('sw-hide'); });
            const n = t.stops.length;
            if (!n) { e.style.clipPath = ''; return; }
            const cw = fs > 100 ? 5 : fs > 34 ? 3 : 2;
            const car = caret(t, a, cw);
            const per = fs > 100 ? clamp(1400 / n, 120, 230) : fs > 30 ? clamp(1300 / n, 26, 90) : clamp(1250 / n, 4, 30);
            const chunk = per < 15 ? Math.ceil(15 / per) : 1;
            // t.stops can be re-measured mid-word (late font), so always read its live length
            while (t.k < t.stops.length) {
                t.k = Math.min(t.stops.length, t.k + chunk);
                e.style.clipPath = clipAt(t.stops, t.k, t.r);
                const s = t.stops[t.k - 1];
                let d = per * chunk * rnd(0.6, 1.4);
                if (s && /[.,;:!?]/.test(s.c)) d += fs > 30 ? 120 : 50;
                await c.wait(d);
            }
            e.style.clipPath = '';
            car.n.classList.add('blink');
            await c.wait(fs > 30 ? 240 : 130);
            drop(car, 120);
        }

        const KIND = {};

        KIND.rect = async function (c) {
            const a = c.a, t = c.t;
            a.say(t.o.frame ? 'framing' : 'drawing');
            await c.fly(TL(t));
            const d = await drag(c, t.o.frame);
            t.ready = true;
            if (t.o.frame) drop(d.b, 380);    // a section frame lets go as its fill lands
            await fade(c, t.hide, t.o.frame ? 380 : 260);
            await c.wait(90);
            drop(d.b); drop(d.bd);
        };

        KIND.text = async function (c) {
            const a = c.a, t = c.t, st = { p: 0 };
            a.say('typing');
            await c.fly(TL(t, -4, -3));
            a.tool('text');
            await c.press();
            const b = box(t, a, 'thin');
            b.upd = function () { const r = t.r; b.set(r.left - 4, r.top - 3, (r.width + 8) * st.p, (r.height + 6) * st.p); };
            a.follow = function () { const r = t.r; return inView(r.left - 4 + (r.width + 8) * st.p, r.top - 3 + (r.height + 6) * st.p); };
            await c.tween(clamp(150 + t.r.width * 0.22, 170, 400), function (p) { st.p = easeOut(p); });
            c.release();
            t.ready = true;
            await type(c);
            await c.wait(70);
            drop(b);
        };

        KIND.pen = async function (c) {
            const a = c.a, t = c.t, e = t.el, P = penPath(t);
            const pts = function () { return P(t.r); };
            const at = function (i) { return function () { const q = pts()[i]; return [t.r.left + q[0], t.r.top + q[1]]; }; };
            a.say('pen tool');
            await c.fly(at(0));
            a.tool('pen');
            e.style.clipPath = penClip(pts(), 0, 0);
            t.hide.forEach(function (h) { h.classList.remove('sw-hide'); });
            await c.click();
            const marks = [anchor(t, a, at(0))];
            const n = pts().length;
            for (let i = 1; i < n; i++) {
                const st = { p: 0 }, from = at(i - 1), to = at(i), seg = i - 1;
                const rb = band(t, a);
                const cur = function () { const A = from(), B = to(); return [lerp(A[0], B[0], st.p), lerp(A[1], B[1], st.p)]; };
                rb.upd = function () { const A = from(), B = cur(); rb.set(A[0], A[1], B[0], B[1]); };
                a.follow = cur;
                const A0 = pts()[i - 1], B0 = pts()[i], len = Math.hypot(B0[0] - A0[0], B0[1] - A0[1]);
                await c.tween(clamp(140 + len * 0.5, 170, 560), function (p) { st.p = ease(p); e.style.clipPath = penClip(pts(), seg, st.p); });
                drop(rb, 60);
                await c.click();
                marks.push(anchor(t, a, to));
            }
            t.ready = true;
            e.style.clipPath = '';
            await c.wait(150);
            marks.forEach(function (m) { drop(m, 200); });
        };

        KIND.media = async function (c) {
            const a = c.a, t = c.t;
            a.say('placing image');
            await c.fly(TL(t));
            await c.hold(imgReady(t.el, 1500));
            const d = await drag(c);
            t.ready = true;
            const ph = placeholder(t, fileName(t.el));
            await c.wait(260);
            const els = t.hide;
            els.forEach(function (h) { h.style.clipPath = 'inset(0 0 100% 0)'; h.classList.remove('sw-hide'); });
            await c.tween(560, function (p) {
                const v = (1 - ease(p)) * 100;
                els.forEach(function (h) { h.style.clipPath = 'inset(0 0 ' + v.toFixed(2) + '% 0)'; });
                ph.n.style.clipPath = 'inset(' + (100 - v).toFixed(2) + '% 0 0 0)';
            });
            els.forEach(function (h) { h.style.clipPath = ''; });
            drop(ph, 120); drop(d.b); drop(d.bd);
        };

        KIND.dup = async function (c) {
            const a = c.a, t = c.t;
            // copy whichever finished sibling is closest, like a person would
            let s = t.master, best = Infinity;
            (t.group || []).forEach(function (o) {
                if (o === t || !o.ready) return;
                o.r = o.el.getBoundingClientRect();
                const dd = Math.abs(o.r.top - t.r.top) + Math.abs(o.r.left - t.r.left);
                if (dd < best) { best = dd; s = o; }
            });
            t.src = s;
            if (!s.r) s.r = s.el.getBoundingClientRect();
            a.say('duplicating');
            await c.fly(AT(s, 0.5, 0.5));
            a.tool('arrow');
            await c.click();
            const sel = box(t, a, 'handles');    // owned by this job, so a cancel cleans it up
            sel.upd = function () { sel.set(s.r.left, s.r.top, s.r.width, s.r.height); };
            await c.wait(110);
            a.tool('dup');
            await c.press();
            const st = { p: 0 };
            const G = function () {
                const S = s.r, T = t.r, k = st.p;
                return { left: lerp(S.left, T.left, k), top: lerp(S.top, T.top, k), width: lerp(S.width, T.width, k), height: lerp(S.height, T.height, k) };
            };
            const g = box(t, a, 'dash');
            g.upd = function () { const q = G(); g.set(q.left, q.top, q.width, q.height); };
            const m = gap(t, s, G);
            a.follow = function () { const q = G(); return inView(q.left + q.width / 2, q.top + q.height / 2); };
            const dist = Math.hypot(t.r.left - s.r.left, t.r.top - s.r.top);
            await c.tween(clamp(200 + dist * 0.55, 240, 640), function (p) { st.p = ease(p); });
            c.release();
            drop(sel, 120); drop(m, 160);
            g.n.classList.remove('dash'); g.n.classList.add('handles');
            t.ready = true;
            if (t.o.then === 'text') { a.tool('text'); a.say('typing'); await type(c); }
            else await fade(c, t.hide, 200);
            await c.wait(70);
            drop(g);
        };

        KIND.backdrop = async function (c) {
            const a = c.a, t = c.t;
            a.say('canvas');
            await c.fly(TL(t, 2, 2));
            const d = await drag(c, 'HERO');
            t.ready = true;          // the hero's contents can start while the smoke rolls in
            drop(d.b, 420);
            // the colour grade goes down first, so the smoke fades in already graded
            const grade = t.hide.filter(function (e) { return e.classList.contains('hero-tint'); });
            grade.forEach(function (e) { e.classList.remove('sw-hide'); });
            await fade(c, t.hide.filter(function (e) { return grade.indexOf(e) < 0; }), 900);
            drop(d.b); drop(d.bd);
        };

        KIND.emblem = async function (c) {
            const a = c.a, t = c.t, e = t.el;
            a.say('oni seal');
            await c.fly(TL(t));
            const d = await drag(c);
            t.ready = true;
            const base = 'translate(-50%, var(--emb-ty, -46%))';
            e.style.opacity = '0';
            e.classList.remove('sw-hide');
            await c.tween(760, function (p) {
                const k = easeOut(p);
                e.style.opacity = Math.min(1, p * 1.7).toFixed(3);
                e.style.transform = base + ' scale(' + (0.55 + 0.45 * k).toFixed(3) + ') rotate(' + (-70 * (1 - k)).toFixed(1) + 'deg)';
            });
            e.style.opacity = ''; e.style.transform = '';
            drop(d.b); drop(d.bd);
        };

        KIND.stage = async function (c) {
            const a = c.a, t = c.t, e = t.el;
            a.say('layout');
            await c.fly(TL(t));
            const d = await drag(c, 'COVERFLOW');
            t.ready = true;
            e.style.clipPath = 'circle(0% at 50% 50%)';
            e.classList.remove('sw-hide');
            await c.tween(760, function (p) { e.style.clipPath = 'circle(' + (ease(p) * 75).toFixed(2) + '% at 50% 50%)'; });
            e.style.clipPath = '';
            drop(d.b); drop(d.bd);
        };

        // Drag a red guide out of the ruler and park it on the hero's centre line.
        KIND.guide = async function (c) {
            const a = c.a, t = c.t, X = t.o.axis === 'x';
            const target = function () { return X ? t.r.left + t.r.width / 2 : t.r.top + t.r.height / 2; };
            const y0 = clamp(t.r.top + t.r.height * 0.12, 90, vh - 90), x0 = clamp(t.r.left + t.r.width * 0.16, 90, vw - 90);
            a.say('guides');
            await c.fly(function () { return X ? [9, y0] : [x0, 9]; });
            a.tool('arrow');
            await c.press();
            const st = { p: 0 };
            const g = ui(null, 'sw-guide ' + (X ? 'v' : 'h'), null, '<b></b>');
            g.t = t;
            guides.push(g);
            const lb = g.n.firstChild;
            const pos = function () { return lerp(9, target(), st.p); };
            g.upd = function () {
                const v = pos();
                if (X) place(g.n, v, 0); else place(g.n, 0, v);
                const txt = (X ? 'X ' : 'Y ') + Math.round(X ? v : v + window.scrollY);
                if (lb.textContent !== txt) lb.textContent = txt;
            };
            a.follow = function () { return X ? [pos(), y0] : [x0, pos()]; };
            await c.tween(620, function (p) { st.p = ease(p); });
            c.release();
            t.ready = true;
            await c.wait(120);
        };

        /* ============ SCHEDULER ============ */
        function nearest(free, t) {
            const r = t.r;
            const x = t.kind === 'guide' ? (t.o.axis === 'x' ? 0 : r.left) : r.left;
            const y = t.kind === 'guide' ? (t.o.axis === 'x' ? r.top : 0) : r.top;
            let best = free[0], bd = Infinity;
            free.forEach(function (a) {
                const d = (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y) + (a.vis ? 0 : 60000);
                if (d < bd) { bd = d; best = a; }
            });
            return best;
        }

        // Which layers are on screen? A layer counts once a real slice of it shows
        // (a short bar at the very bottom edge counts too). Layers you scrolled
        // past are placed outright, so scrolling back up never shows a gap.
        function gate() {
            const atEnd = window.scrollY >= document.documentElement.scrollHeight - vh - 4;
            for (let i = pending.length - 1; i >= 0; i--) {
                const t = pending[i], r = t.r;
                if (!r) continue;
                if (t.fixed) { t.vis = true; continue; }
                if (r.bottom < -80) { placeNow(t); continue; }
                t.vis = r.bottom > 0 && (r.top < vh - Math.min(48, r.height * 0.5) || (atEnd && r.top < vh));
            }
            for (let i = running.length - 1; i >= 0; i--) {
                const t = running[i];
                if (!t.fixed && t.r && t.r.bottom < -vh * 0.5) placeNow(t);
            }
        }

        function schedule() {
            const free = agents.filter(function (a) { return !a.task; });
            const now = performance.now();
            let backlog = 0;
            for (let i = 0; i < pending.length; i++) {
                const t = pending[i];
                if (!t.vis || !depsReady(t)) { t.since = 0; continue; }
                if (!t.since) t.since = now;
                if (!free.length) {
                    backlog++;
                    if (now - t.since > 6000) { placeNow(t); i--; }   // nobody got to it in time
                    continue;
                }
                let a = null;
                const pref = t.o.prefer;
                if (pref != null && agents[pref] && free.indexOf(agents[pref]) >= 0) a = agents[pref];
                if (!a) a = nearest(free, t);
                free.splice(free.indexOf(a), 1);
                start(a, t);
                i--;
            }
            // fall behind, or scroll fast, and the whole swarm speeds up
            const want = clamp(1 + backlog * 0.2 + svel * 0.8, 1, 3.2);
            rush += (want - rush) * 0.05;
        }

        /* ============ FRAME LOOP ============ */
        function read(dt) {
            const y = window.scrollY;
            svel += (Math.abs(y - sy) / Math.max(dt, 1) - svel) * 0.15;
            sy = y;
            const need = new Set();
            running.forEach(function (t) { need.add(t); if (t.src) need.add(t.src); });
            uis.forEach(function (it) { if (it.t) need.add(it.t); });
            if (frameNo % 4 === 0) pending.forEach(function (t) { need.add(t); });
            need.forEach(function (t) { t.r = t.el.getBoundingClientRect(); });
        }

        function physics(dt) {
            const s = Math.min(dt, 40) / 16.67;
            for (let i = 0; i < agents.length; i++) {
                const a = agents[i];
                if (a.follow) continue;
                let tx, ty, k;
                if (a.mode === 'orbit') {
                    a.th += a.w * dt;
                    tx = ox + Math.cos(a.th) * a.rad; ty = oy + Math.sin(a.th) * a.rad * 0.62;
                    k = 0.06;
                } else if (a.mode === 'flock') {
                    a.th += a.w * dt * 1.6;
                    const R = 30 + (a.i % 4) * 13;
                    tx = (hasMouse ? mx : vw / 2) + Math.cos(a.th) * R;
                    ty = (hasMouse ? my : vh / 2) + Math.sin(a.th) * R;
                    k = 0.05;
                } else {
                    tx = a.hx + Math.sin(clock * 0.0012 + a.i * 1.9) * 12;
                    ty = a.hy + Math.cos(clock * 0.0015 + a.i * 2.7) * 9;
                    k = 0.02;
                    if (a.vis && !a.task && phase === 1 && clock - a.idleAt > 2400) a.hide();
                }
                for (let j = 0; j < agents.length; j++) {   // a little personal space
                    if (j === i) continue;
                    const b = agents[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
                    if (d2 < 1200 && d2 > 0.01) {
                        const d = Math.sqrt(d2), f = (1 - d / 34.6) * 0.9;
                        a.vx += dx / d * f * s; a.vy += dy / d * f * s;
                    }
                }
                a.vx = (a.vx + (tx - a.x) * k * s) * Math.pow(0.8, s);
                a.vy = (a.vy + (ty - a.y) * k * s) * Math.pow(0.8, s);
                a.x += a.vx * s; a.y += a.vy * s;
            }
        }

        function paint() {
            agents.forEach(function (a) {
                if (a.follow) { const p = a.follow(); a.x = p[0]; a.y = p[1]; }
                place(a.n, a.x, a.y);
            });
            for (let i = 0; i < uis.length; i++) { const it = uis[i]; if (it.upd && it.n.isConnected) it.upd(); }
        }

        function frame(ts) {
            if (dead) return;
            raf = requestAnimationFrame(frame);
            const dt = last ? Math.min(ts - last, 50) : 16.7;
            last = ts; frameNo++;
            try {
                read(dt);
                if (phase === 1) { gate(); schedule(); }
                tick(dt * PACE * rush);
                physics(dt);
                paint();
                if (frameNo % 8 === 0) hud.tick();
            } catch (err) { fail(err); }
        }

        /* ============ MILESTONES ============ */
        function secs() { return ((performance.now() - born) / 1000).toFixed(1); }

        function milestones() {
            if (!heroDone) {
                let all = true;
                for (let i = 0; i < tasks.length; i++) {
                    const t = tasks[i];
                    if (t.state < 2 && (t.section === 'HERO' || t.section === 'HEADER')) { all = false; break; }
                }
                if (all) heroShipped();
            }
            if (!pending.length && !running.length) complete();
        }

        function heroShipped() {
            heroDone = true;
            root.classList.remove('sw-intro');
            layer.classList.remove('rulers');
            canvas.classList.remove('on');
            guides.forEach(function (g) { drop(g, 500); });
            guides = [];
            if (quiet) return;
            hud.flash('<span class="ok">✓</span> HERO SHIPPED IN ' + secs() + 'S', 2300);
            setTimeout(function () { if (!dead && phase === 1 && !running.length) hud.flash('SCROLL <s>/</s> THE SWARM FOLLOWS ↓', 2600); }, 2300);
            // the free agents circle the seal they just built, then step back
            const em = document.querySelector('.hero-emblem'), r = em && em.getBoundingClientRect();
            if (r && r.bottom > 40 && r.top < vh - 40) {
                ox = r.left + r.width / 2; oy = r.top + r.height / 2;
                agents.forEach(function (a) {
                    if (a.task) return;
                    a.mode = 'orbit'; a.rad = rnd(r.width * 0.62, r.width * 0.95); a.show(); a.say('');
                });
                sys.wait(1500).then(function () {
                    agents.forEach(function (a) {
                        if (a.task || a.mode !== 'orbit') return;
                        a.mode = 'idle'; a.hx = a.x; a.hy = a.y; a.idleAt = clock - 1000;
                    });
                }).catch(function () {});
            }
        }

        function complete() {
            if (phase === 2) return;
            phase = 2;
            if (quiet) return;
            hud.done(total, (performance.now() - born) / 1000);
            hud.retire(6500);
            // everyone gathers on your cursor for a moment, then logs off
            agents.forEach(function (a) { a.follow = null; a.mode = 'flock'; a.show(); a.say(''); a.tool('arrow'); });
            setTimeout(function () { agents.forEach(function (a) { a.hide(); }); }, 1900);
            setTimeout(function () { if (layer) layer.classList.add('sw-fading'); }, 2300);
            setTimeout(end, 2800);
        }

        /* ============ INTRO ============ */
        function spawn() {
            ox = vw / 2; oy = vh / 2;
            agents.forEach(function (a, i) {
                a.x = ox + rnd(-4, 4); a.y = oy + rnd(-4, 4); a.vx = rnd(-3, 3); a.vy = rnd(-3, 3);
                a.mode = 'orbit';
                setTimeout(function () {
                    if (dead) return;
                    a.show(); a.n.classList.add('pop');
                    setTimeout(function () { a.n.classList.remove('pop'); }, 600);
                }, i * 50);
            });
        }

        async function intro() {
            const c = sys;
            canvas.classList.add('on');
            const term = el('div', 'sw-term', layer,
                '<div><span class="p">$</span> <span class="cmd"></span><i class="cur"></i></div><div class="out">&nbsp;</div>');
            const cmdEl = term.querySelector('.cmd'), out = term.querySelector('.out');
            const cmd = SMALL ? 'swarm build --agents ' + COUNT : 'swarm build ./gs-tejas --agents ' + COUNT;
            await c.wait(180);
            for (let i = 1; i <= cmd.length; i++) { cmdEl.textContent = cmd.slice(0, i); await c.wait(rnd(8, 24)); }
            await c.wait(150);
            term.classList.add('ran');
            out.innerHTML = '<span class="ok">✓</span> ' + total + ' layers mapped <span class="dim">·</span> ' + COUNT + ' agents online';
            await c.wait(130);
            spawn();
            await c.wait(SMALL ? 420 : 320);
            if (rulers) layer.classList.add('rulers');
            await c.wait(SMALL ? 220 : 340);
            term.classList.add('gone');
            setTimeout(function () { term.remove(); }, 500);
            phase = 1;
            hud.show();
            hud.section('HERO');
        }

        /* ============ ENDINGS ============ */
        function settleAll() {
            if (sys) sys.kill();
            ctxs.slice().forEach(function (c) { c.kill(); });
            running.slice().forEach(placeNow);
            pending.slice().forEach(placeNow);
            guides.forEach(zap);
            guides = [];
            root.classList.remove('sw-intro');
            phase = 2;
        }
        function end() {
            if (dead) return;
            dead = true;
            cancelAnimationFrame(raf);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('resize', onResize);
            if (document.fonts && document.fonts.removeEventListener) document.fonts.removeEventListener('loadingdone', remeasure);
            if (layer) layer.remove();
            if (canvas) canvas.remove();
        }
        function skip() {
            if (dead || quiet) return;
            quiet = true;
            settleAll();
            if (layer) layer.classList.add('sw-fading');
            if (canvas) canvas.classList.remove('on');
            if (hud) hud.retire(0);
            setTimeout(end, 480);
        }
        function destroy() {
            quiet = true;
            try { settleAll(); } catch (e) { hardReveal(); }
            end();
            if (hud) hud.n.remove();
        }
        function fail(err) {
            if (dead) return;
            console.warn('[swarm] stopped, showing the page as it is.', err);
            try { skip(); } catch (e) { hardReveal(); }
        }

        /* ============ LISTENERS ============ */
        function onMove(e) { mx = e.clientX; my = e.clientY; hasMouse = true; }
        function onKey(e) { if (e.key === 'Escape' && phase < 2) skip(); }
        function onResize() { vw = window.innerWidth; vh = window.innerHeight; remeasure(); if (rulers) rulers.render(); }
        // a late web font shifts the glyphs: re-map whatever is being typed
        function remeasure() {
            running.forEach(function (t) {
                if (!t.stops || t.k >= t.stops.length) return;
                t.r = t.el.getBoundingClientRect();
                t.stops = measure(t.el);
                t.k = Math.min(t.k, t.stops.length);
                t.el.style.clipPath = clipAt(t.stops, t.k, t.r);
            });
        }

        /* ============ BOOT ============ */
        try {
            // Scroll reveals settle into their final state: agents do the revealing now.
            root.classList.add('sw-notrans');
            document.querySelectorAll('.reveal').forEach(function (e) { e.classList.add('visible'); });
            void document.body.offsetWidth;
            root.classList.remove('sw-notrans');

            collect();
            wire();
            tasks.forEach(function (t) {
                t.r = t.el.getBoundingClientRect();
                // not rendered at this screen size (desktop nav on a phone, and so on)
                if (!t.virtual && t.r.width === 0 && t.r.height === 0) { t.state = 3; t.ready = true; return; }
                pending.push(t);
                if (!t.virtual) total++;
                t.hide.forEach(function (e) { e.classList.add('sw-hide'); });
            });

            canvas = el('div', 'sw-canvas');
            layer = el('div', 'sw-layer');
            layer.setAttribute('aria-hidden', 'true');
            hud = makeHud();
            document.body.insertBefore(hud.n, document.body.firstChild);
            document.body.insertBefore(layer, document.body.firstChild);
            document.body.insertBefore(canvas, document.body.firstChild);
            root.classList.remove('sw-boot');
            root.classList.add('sw-intro');

            if (!SMALL) rulers = makeRulers();
            for (let i = 0; i < COUNT; i++) agents.push(new Agent(i));
            sys = new Ctx(null, null);

            window.addEventListener('pointermove', onMove, { passive: true });
            window.addEventListener('keydown', onKey);
            window.addEventListener('resize', onResize);
            if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', remeasure);

            raf = requestAnimationFrame(frame);
            intro().catch(function (err) { if (err !== STOP) fail(err); });
        } catch (err) {
            console.warn('[swarm] could not start, showing the page as it is.', err);
            dead = true;
            hardReveal();
        }

        // ?swarmdebug exposes the scheduler state for testing
        if (/[?&]swarmdebug(=|&|$)/.test(window.location.search)) {
            const name = function (t) { return t.kind + ':' + t.el.tagName.toLowerCase() + (t.el.id ? '#' + t.el.id : '.' + String(t.el.className).split(' ')[0]); };
            window.__swarmDebug = function () {
                return {
                    phase: phase, built: built, total: total, rush: +rush.toFixed(2), heroDone: heroDone, dead: dead,
                    running: running.map(function (t) { return name(t) + '@' + (t.agent ? t.agent.name : '?'); }),
                    waiting: pending.filter(function (t) { return t.vis; }).map(function (t) { return name(t) + (depsReady(t) ? '' : ' (blocked)'); }),
                    pending: pending.length
                };
            };
        }

        return { destroy: destroy, skip: skip };
    }

    /* ============ REPLAY ============ */
    let current = null;
    function launch() {
        if (current) current.destroy();
        try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); }
        current = run();
    }

    // A footer link to watch it again. Added before the first run so the swarm builds it too.
    const foot = document.querySelector('.footer-inner');
    if (foot) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'sw-replay';
        b.textContent = 'REPLAY THE BUILD ↻';
        b.addEventListener('click', launch);
        foot.insertBefore(b, foot.querySelector('.back-top'));
    }

    try { current = run(); } catch (err) { hardReveal(); }
})();
