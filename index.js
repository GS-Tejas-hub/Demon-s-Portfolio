/* ============================================================
   G S TEJAS · PORTFOLIO V3
   Lenis smooth scroll, load choreography, rotating marquee,
   scroll reveals, HUD clock, custom cursor.
   ============================================================ */

(function () {
    'use strict';

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var hero = document.getElementById('home');

    /* ============ SMOOTH SCROLL (Lenis) ============ */
    var lenis = null;

    function initLenis() {
        if (reduce || typeof window.Lenis === 'undefined') return;
        lenis = new window.Lenis({
            lerp: 0.075,          // heavier momentum, buttery follow
            wheelMultiplier: 1,
            smoothWheel: true,
            syncTouch: true,
            touchMultiplier: 1.4
        });
        function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
        requestAnimationFrame(raf);
    }

    // Anchor links go through Lenis when available
    function scrollToTarget(hash) {
        var el = document.querySelector(hash);
        if (!el) return;
        if (lenis) lenis.scrollTo(el, { offset: -10 });
        else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    }

    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
            var hash = a.getAttribute('href');
            if (hash.length > 1) {
                e.preventDefault();
                closeMobileMenu();
                scrollToTarget(hash);
            }
        });
    });

    /* ============ LOAD CHOREOGRAPHY ============ */
    var preloader = document.getElementById('preloader');

    function startHero() {
        if (hero) hero.classList.add('loaded');
    }

    function runIntro() {
        if (reduce) {
            if (preloader) preloader.style.display = 'none';
            startHero();
            return;
        }
        // Preloader words play (CSS), then curtain up, then hero expands
        setTimeout(function () {
            if (preloader) preloader.classList.add('done');
            startHero();
        }, 1700);
    }

    if (document.readyState === 'complete') {
        runIntro();
    } else {
        window.addEventListener('load', runIntro);
        // Fallback so a slow font never blocks the reveal
        setTimeout(function () {
            if (hero && !hero.classList.contains('loaded')) {
                if (preloader) preloader.classList.add('done');
                startHero();
            }
        }, 3200);
    }

    initLenis();

    /* ============ CUSTOM CURSOR ============ */
    var cursorDot = document.getElementById('cursorDot');
    var cursorRing = document.getElementById('cursorRing');
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (finePointer && cursorDot && cursorRing && !reduce) {
        document.documentElement.classList.add('cursor-hidden');  // hide native cursor
        var cursorLens = document.getElementById('cursorLens');
        var MAG_COPY = ['fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','lineHeight','color','textTransform','textAlign','fontStretch'];
        var ZOOM = 1.55;
        var magTarget = null, magClone = null;
        var mx = -100, my = -100, rx = -100, ry = -100;

        document.addEventListener('mousemove', function (e) {
            mx = e.clientX; my = e.clientY;
            cursorDot.style.transform = 'translate(' + (mx - 3) + 'px,' + (my - 3) + 'px)';
        });

        // Returns the element whose ACTUAL glyph sits under (x, y), else null.
        // Uses the caret hit-test + the character's own box, so empty space
        // inside a text block (or anywhere with no text) correctly returns null.
        function textElAt(x, y) {
            var pos = document.caretRangeFromPoint ? document.caretRangeFromPoint(x, y)
                    : (document.caretPositionFromPoint ? document.caretPositionFromPoint(x, y) : null);
            if (!pos) return null;
            var node = pos.startContainer || pos.offsetNode;
            var off = (pos.startOffset != null) ? pos.startOffset : pos.offset;
            if (!node || node.nodeType !== 3) return null;          // must be a text node
            var len = node.textContent.length;
            if (!node.textContent.trim()) return null;
            // window the 1-2 characters flanking the caret so kerning gaps in
            // big headings still count, while empty space past the text does not
            var a = Math.max(0, off - 1), b = Math.min(len, off + 1);
            if (a >= b) return null;
            var range = document.createRange();
            try { range.setStart(node, a); range.setEnd(node, b); } catch (err) { return null; }
            var r = range.getBoundingClientRect();
            if (!r || r.width === 0 || r.height === 0) return null;
            if (x < r.left - 8 || x > r.right + 8 || y < r.top - 3 || y > r.bottom + 3) return null;
            var el = node.parentElement;
            if (!el || (el.closest && el.closest('#cursorRing'))) return null;
            return el;
        }

        (function ring() {
            rx += (mx - rx) * 0.28; ry += (my - ry) * 0.28;
            cursorRing.style.transform = 'translate(' + (rx - cursorRing.offsetWidth / 2) + 'px,' + (ry - cursorRing.offsetHeight / 2) + 'px)';

            var el = cursorLens ? textElAt(rx, ry) : null;
            if (el !== magTarget) {
                magTarget = el;
                cursorLens.innerHTML = '';
                magClone = null;
                if (el) {
                    magClone = el.cloneNode(true);
                    var cs = getComputedStyle(el);
                    MAG_COPY.forEach(function (p) { magClone.style[p] = cs[p]; });
                    magClone.style.width = el.offsetWidth + 'px';
                    cursorLens.appendChild(magClone);
                    cursorRing.classList.add('mag');
                } else {
                    cursorRing.classList.remove('mag');
                }
            }
            if (magTarget && magClone) {
                var rect = magTarget.getBoundingClientRect();
                var lensR = cursorRing.offsetWidth / 2;
                magClone.style.transform = 'translate(' + (lensR - (rx - rect.left) * ZOOM).toFixed(1) + 'px,' + (lensR - (ry - rect.top) * ZOOM).toFixed(1) + 'px) scale(' + ZOOM + ')';
            }
            requestAnimationFrame(ring);
        })();

        document.querySelectorAll('a, button, .anime-card, .proj-panel, .stat-box').forEach(function (el) {
            el.addEventListener('mouseenter', function () { cursorRing.classList.add('grow'); });
            el.addEventListener('mouseleave', function () { cursorRing.classList.remove('grow'); });
        });
    } else if (cursorDot && cursorRing) {
        cursorDot.style.display = 'none';
        cursorRing.style.display = 'none';
    }

    /* ============ HEADER + MOBILE MENU ============ */
    var header = document.getElementById('siteHeader');
    var navToggle = document.getElementById('navToggle');
    var mobileMenu = document.getElementById('mobileMenu');

    function onScroll(y) {
        if (header) header.classList.toggle('scrolled', y > 40);
        updateSpy(y);
    }

    if (lenis) {
        lenis.on('scroll', function (e) { onScroll(e.scroll); });
    } else {
        window.addEventListener('scroll', function () { onScroll(window.scrollY); }, { passive: true });
    }

    function closeMobileMenu() {
        if (!mobileMenu) return;
        mobileMenu.classList.remove('open');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
        if (lenis) lenis.start();
    }

    if (navToggle && mobileMenu) {
        navToggle.addEventListener('click', function () {
            var open = mobileMenu.classList.toggle('open');
            navToggle.classList.toggle('open', open);
            navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            document.body.style.overflow = open ? 'hidden' : '';
            if (lenis) { open ? lenis.stop() : lenis.start(); }
        });
    }

    /* ============ SCROLL SPY ============ */
    var navLinks = document.querySelectorAll('.nav-link');
    var spy = [];
    navLinks.forEach(function (link) {
        var s = document.getElementById(link.getAttribute('data-section'));
        if (s) spy.push({ link: link, section: s });
    });
    function updateSpy(y) {
        var pos = (y || window.scrollY) + window.innerHeight * 0.35;
        var active = null;
        spy.forEach(function (t) { if (t.section.offsetTop <= pos) active = t; });
        spy.forEach(function (t) { t.link.classList.toggle('active', t === active); });
    }
    updateSpy(0);

    /* ============ SCROLL REVEALS ============ */
    var revealEls = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window && !reduce) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) { entry.target.classList.add('visible'); io.unobserve(entry.target); }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        revealEls.forEach(function (el, i) { el.style.transitionDelay = (i % 3) * 0.08 + 's'; io.observe(el); });
    } else {
        revealEls.forEach(function (el) { el.classList.add('visible'); });
    }

    /* ============ STAT COUNTERS + LIVE GITHUB ============ */
    var statEls = document.querySelectorAll('.stat-value');

    function animateCount(el, target) {
        if (reduce) { el.textContent = target; el.dataset.animated = '1'; return; }
        var from = parseInt((el.textContent || '').replace(/\D/g, ''), 10) || 0;
        var start = null, dur = 1200;
        function tick(now) {
            if (start === null) start = now;
            var p = Math.min((now - start) / dur, 1);
            el.textContent = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(tick);
            else el.dataset.animated = '1';
        }
        requestAnimationFrame(tick);
    }

    if ('IntersectionObserver' in window && !reduce) {
        var statIO = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                animateCount(entry.target, parseInt(entry.target.getAttribute('data-count'), 10) || 0);
                statIO.unobserve(entry.target);
            });
        }, { threshold: 0.5 });
        statEls.forEach(function (el) { statIO.observe(el); });
    } else {
        statEls.forEach(function (el) { el.textContent = el.getAttribute('data-count'); el.dataset.animated = '1'; });
    }

    // Live GitHub numbers from public endpoints; falls back to data-count.
    (function liveGitHub() {
        var GH = 'GS-Tejas-hub';
        function setStat(metric, value) {
            if (typeof value !== 'number' || isNaN(value) || value <= 0) return;
            var el = document.querySelector('.stat-value[data-live="' + metric + '"]');
            if (!el) return;
            el.setAttribute('data-count', value);
            if (el.dataset.animated) animateCount(el, value);
        }
        function j(url) { return fetch(url).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); }); }

        j('https://api.github.com/users/' + GH)
            .then(function (d) { setStat('repos', d.public_repos); }).catch(function () {});
        j('https://api.github.com/search/issues?q=author:' + GH + '+type:pr&per_page=1')
            .then(function (d) { setStat('prs', d.total_count); }).catch(function () {});
        j('https://github-contributions-api.jogruber.de/v4/' + GH)
            .then(function (d) {
                var t = d.total || {};
                var s = Object.keys(t).reduce(function (a, k) { return a + (t[k] || 0); }, 0);
                setStat('contributions', s);
            }).catch(function () {});
    })();

    /* ============ HUD CLOCK (IST) ============ */
    var hudClock = document.getElementById('hudClock');
    if (hudClock) {
        var fmt = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        });
        (function tickClock() {
            hudClock.textContent = 'IST ' + fmt.format(new Date());
            setTimeout(tickClock, 1000);
        })();
    }

    /* ============ ANIME · 3D COVERFLOW ============ */
    // Draggable, auto-rotating coverflow. Cards are black & white and small at
    // the sides, growing and gaining colour as they travel through the centre.
    // Grab to spin left/right; the hovered/held card also turns colourful.
    var anime3d = document.getElementById('anime3d');
    var animeStage = document.getElementById('animeStage');
    if (anime3d && animeStage) {
        var cards = Array.prototype.slice.call(anime3d.children);
        var N = cards.length;
        var state = cards.map(function () { return { hv: 0, hover: false }; });

        var pos = 0;         // fractional centre index
        var velocity = 0;    // momentum, index units per second
        var snapTo = null;   // click-to-centre target
        var dragging = false, dragMoved = false, lastX = 0, lastT = 0;

        function wrap(o) { o = ((o % N) + N) % N; if (o > N / 2) o -= N; return o; }
        function cardW() { return cards[0] ? cards[0].offsetWidth : 240; }

        cards.forEach(function (card, i) {
            card.addEventListener('mouseenter', function () { state[i].hover = true; });
            card.addEventListener('mouseleave', function () { state[i].hover = false; });
            card.addEventListener('click', function () { if (!dragMoved) { snapTo = i; velocity = 0; } });
        });

        function render() {
            // spread cards wider so the row reaches near the screen's extreme ends
            var spacing = Math.min(cardW() * 0.72, (window.innerWidth / 2) / 3.1);
            for (var i = 0; i < N; i++) {
                var o = wrap(i - pos);
                var ao = Math.abs(o);
                var x = o * spacing;
                var z = -ao * 170;
                var ry = Math.max(-50, Math.min(50, -o * 32));
                var scale = Math.max(0.5, 1 - ao * 0.15);

                var st = state[i];
                st.hv += ((st.hover ? 1 : 0) - st.hv) * 0.18;
                var colour = Math.max(Math.max(0, 1 - ao), st.hv);   // centre or hovered
                var op = Math.max(0, Math.min(1, (3.5 - ao) / 1.2));

                var c = cards[i];
                c.style.transform = 'translate(-50%,-50%) translate3d(' + x.toFixed(1) + 'px,0,' + z.toFixed(1) + 'px) rotateY(' + ry.toFixed(1) + 'deg) scale(' + scale.toFixed(3) + ')';
                c.style.filter = 'grayscale(' + (1 - colour).toFixed(2) + ') brightness(' + (0.6 + 0.4 * colour).toFixed(2) + ')';
                c.style.opacity = op.toFixed(2);
                c.style.zIndex = String(Math.round(200 - ao * 12));
                c.style.pointerEvents = op < 0.25 ? 'none' : 'auto';
            }
        }

        var lastF = null;
        function loop(now) {
            if (lastF === null) lastF = now;
            var dt = Math.min((now - lastF) / 1000, 0.05);
            lastF = now;

            if (!dragging) {
                if (snapTo !== null) {
                    var diff = wrap(snapTo - pos);
                    pos += diff * Math.min(1, dt * 6);
                    if (Math.abs(diff) < 0.01) snapTo = null;
                } else if (Math.abs(velocity) > 0.05) {
                    pos += velocity * dt;
                    velocity *= Math.pow(0.92, dt * 60);
                } else if (!reduce) {
                    pos += 0.16 * dt;   // gentle auto-rotate: cards travel right -> left
                }
            }
            if (pos > N) pos -= N; else if (pos < 0) pos += N;
            render();
            requestAnimationFrame(loop);
        }
        render();
        requestAnimationFrame(loop);

        var startX = 0, startY = 0, axis = null;
        function down(e) {
            dragging = true; dragMoved = false; velocity = 0; snapTo = null;
            axis = e.touches ? null : 'x';   // mouse = always horizontal
            startX = lastX = e.touches ? e.touches[0].clientX : e.clientX;
            startY = e.touches ? e.touches[0].clientY : e.clientY;
            lastT = performance.now();
            animeStage.classList.add('dragging');
        }
        function move(e) {
            if (!dragging) return;
            var cx = e.touches ? e.touches[0].clientX : e.clientX;
            var cy = e.touches ? e.touches[0].clientY : e.clientY;
            if (axis === null) {
                var tdx = Math.abs(cx - startX), tdy = Math.abs(cy - startY);
                if (tdx < 7 && tdy < 7) return;               // wait for intent
                axis = tdx > tdy ? 'x' : 'y';
                if (axis === 'y') { dragging = false; animeStage.classList.remove('dragging'); return; }
            }
            var dx = cx - lastX;
            if (Math.abs(dx) > 3) dragMoved = true;
            var dIndex = -dx / (cardW() * 0.62);
            pos += dIndex;
            var nowT = performance.now(), dtt = (nowT - lastT) / 1000;
            if (dtt > 0) velocity = Math.max(-9, Math.min(9, dIndex / dtt));
            lastX = cx; lastT = nowT;
            if (e.cancelable) e.preventDefault();
        }
        function up() { if (dragging) { dragging = false; animeStage.classList.remove('dragging'); } }

        animeStage.addEventListener('mousedown', down);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
        animeStage.addEventListener('touchstart', down, { passive: true });
        animeStage.addEventListener('touchmove', move, { passive: false });
        window.addEventListener('touchend', up);
    }

    /* ============ PROJECT LAPTOP TILT ============ */
    if (finePointer && !reduce) {
        document.querySelectorAll('.proj-panel').forEach(function (panel) {
            var laptop = panel.querySelector('.laptop');
            if (!laptop) return;
            panel.addEventListener('mousemove', function (e) {
                var r = panel.getBoundingClientRect();
                var px = (e.clientX - r.left) / r.width - 0.5;
                var py = (e.clientY - r.top) / r.height - 0.5;
                laptop.style.transform = 'translateY(-8px) rotateY(' + (px * 7) + 'deg) rotateX(' + (-py * 5) + 'deg)';
            });
            panel.addEventListener('mouseleave', function () { laptop.style.transform = ''; });
        });
    }

    /* ============ FLOATING ANIME QUOTES ============ */
    // Ambient background quotes that flash in (lightning), drift, and fade,
    // alternating on the left and right gutters. Desktop only.
    var quoteField = document.getElementById('quoteField');
    if (quoteField && !reduce && window.innerWidth >= 1100) {
        var ANIME_QUOTES = [
            { t: "I'm gonna be King of the Pirates!", a: "LUFFY · ONE PIECE" },
            { t: "Power comes in response to a need, not a desire.", a: "NARUTO" },
            { t: "A lesson without pain is meaningless.", a: "FULLMETAL ALCHEMIST" },
            { t: "Being weak is nothing to be ashamed of. Staying weak is.", a: "FAIRY TAIL" },
            { t: "The world is not perfect. But it's there for us, trying its best.", a: "FMA" },
            { t: "If you don't take risks, you can't create a future.", a: "LUFFY · ONE PIECE" },
            { t: "Hard work is worthless for those that don't believe in themselves.", a: "ROCK LEE · NARUTO" },
            { t: "Fear is not evil. It tells you what your weakness is.", a: "FAIRY TAIL" },
            { t: "It's not about how you die, it's about how you live.", a: "ONE PIECE" },
            { t: "The world is cruel, but also very beautiful.", a: "MIKASA · ATTACK ON TITAN" },
            { t: "Whatever you lose, you'll find it again. But what you throw away you'll never get back.", a: "KENSHIN" }
        ];

        var lastQ = -1, sideLeft = true;
        function spawnQuote() {
            var i;
            do { i = Math.floor(Math.random() * ANIME_QUOTES.length); }
            while (i === lastQ && ANIME_QUOTES.length > 1);
            lastQ = i;
            var q = ANIME_QUOTES[i];
            var el = document.createElement('div');
            el.className = 'float-quote';
            el.innerHTML = '“' + q.t + '”<span class="fq-author">' + q.a + '</span>';
            if (sideLeft) { el.style.left = 'clamp(14px, 3.5vw, 60px)'; el.style.textAlign = 'left'; }
            else { el.style.right = 'clamp(14px, 3.5vw, 60px)'; el.style.textAlign = 'right'; }
            sideLeft = !sideLeft;
            el.style.top = (12 + Math.random() * 64) + 'vh';
            quoteField.appendChild(el);
            el.addEventListener('animationend', function () { el.remove(); });
        }
        setTimeout(function tick() {
            spawnQuote();
            setTimeout(tick, 2800 + Math.random() * 1800);
        }, 2000);
    }
})();
