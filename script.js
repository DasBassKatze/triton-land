/* ============================================================
   1. Parallax + затемнение между секциями
   Скролл-контейнер — .page-body, а не window
   ============================================================ */

(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isMobile     = window.matchMedia('(max-width: 767px)').matches;
    if (reduceMotion || isMobile) return;

    var pageBody = document.querySelector('.page-body');
    if (!pageBody) return;

    var sections = Array.prototype.slice.call(
        document.querySelectorAll('[data-parallax-section]')
    );
    if (!sections.length) return;

    var layers = [];
    sections.forEach(function (section) {
        var bgs = section.querySelectorAll('[data-parallax-bg]');
        Array.prototype.forEach.call(bgs, function (bg) {
            var speed = parseFloat(bg.getAttribute('data-speed')) || 0.2;
            layers.push({
                el: bg,
                section: section,
                speed: speed,
                current: 0,
                target: 0
            });
        });
    });
    if (!layers.length) return;

    // Метрики секций относительно .page-body (offsetParent)
    var sectionMetrics = new Map();

    function measure() {
        sectionMetrics.clear();
        sections.forEach(function (section) {
            sectionMetrics.set(section, {
                top: section.offsetTop,
                height: section.offsetHeight
            });
        });
    }

    var viewportHeight = pageBody.clientHeight;
    var LERP = 0.1;
    var AMPLITUDE = 0.25;
    var needsUpdate = true;
    var isRunning = false;

    function updateTargets() {
        var scrollTop = pageBody.scrollTop;

        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            var m = sectionMetrics.get(layer.section);
            if (!m) continue;

            var sectionTop = m.top - scrollTop;
            var progress = 1 - (sectionTop + m.height) / (viewportHeight + m.height);
            if (progress < -0.5) progress = -0.5;
            if (progress > 1.5)  progress = 1.5;

            var amplitudePx = viewportHeight * AMPLITUDE;
            layer.target = (progress - 0.5) * 2 * amplitudePx * layer.speed;
        }
    }

    function isSettled() {
        for (var i = 0; i < layers.length; i++) {
            if (Math.abs(layers[i].target - layers[i].current) > 0.1) return false;
        }
        return !needsUpdate;
    }

    function tick() {
        if (needsUpdate) {
            updateTargets();
            needsUpdate = false;
        }
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            layer.current += (layer.target - layer.current) * LERP;
            var y = Math.round(layer.current * 100) / 100;
            layer.el.style.transform = 'translate3d(0, ' + y + 'px, 0)';
        }
        if (isSettled()) {
            isRunning = false;
            return;
        }
        requestAnimationFrame(tick);
    }

    function start() {
        if (isRunning) return;
        isRunning = true;
        requestAnimationFrame(tick);
    }

    // will-change — только когда секция в зоне видимости
    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                var bgs = entry.target.querySelectorAll('[data-parallax-bg]');
                Array.prototype.forEach.call(bgs, function (bg) {
                    bg.style.willChange = entry.isIntersecting ? 'transform' : 'auto';
                });
            });
        }, { root: pageBody, rootMargin: '200px 0px' });

        sections.forEach(function (s) { io.observe(s); });
    }

    // Слушаем скролл .page-body, не window
    pageBody.addEventListener('scroll', function () {
        needsUpdate = true;
        start();
    }, { passive: true });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            viewportHeight = pageBody.clientHeight;
            measure();
            needsUpdate = true;
            start();
        }, 150);
    });

    window.addEventListener('load', function () {
        viewportHeight = pageBody.clientHeight;
        measure();
        needsUpdate = true;
        start();
    });

    measure();
    needsUpdate = true;
    start();

})();


/* ============================================================
   2. Бургер-меню
   ============================================================ */

(function () {
    'use strict';

    var burger = document.getElementById('burger');
    var menu   = document.getElementById('main-menu');
    if (!burger || !menu) return;

    function setOpen(isOpen) {
        menu.classList.toggle('header__menu--open', isOpen);
        burger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        burger.setAttribute('aria-label', isOpen ? 'Закрыть меню' : 'Открыть меню');
    }

    burger.addEventListener('click', function () {
        var isOpen = menu.classList.contains('header__menu--open');
        setOpen(!isOpen);
    });

    menu.querySelectorAll('.header__menu-item').forEach(function (link) {
        link.addEventListener('click', function () {
            setOpen(false);
        });
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && menu.classList.contains('header__menu--open')) {
            setOpen(false);
            burger.focus();
        }
    });

    document.addEventListener('click', function (e) {
        if (!menu.classList.contains('header__menu--open')) return;
        if (menu.contains(e.target)) return;
        if (burger.contains(e.target)) return;
        setOpen(false);
    });

    var mq = window.matchMedia('(min-width: 768px)');
    var onChange = function (e) {
        if (e.matches) setOpen(false);
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);

})();


/* ============================================================
   3. Каскадное появление блоков при загрузке и скролле
   ============================================================ */

(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    var heroPlan = [
        { selector: '.hero__logo',       delay: 150 },
        { selector: '.hero__tagline',    delay: 300 },
        { selector: '.hero__subtitle',   delay: 400 },
        { selector: '.hero__contacts',   delay: 500 },
        { selector: '.hero__directions', delay: 650 }
    ];

    var resultPlan = [
        { selector: '.result__title',       delay: 0   },
        { selector: '.result__body',        delay: 100 },
        { selector: '.result__description', delay: 200 },
        { selector: '.result__features',    delay: 300 }
    ];

    function collect(plan) {
        var items = [];
        plan.forEach(function (step) {
            var el = document.querySelector(step.selector);
            if (el) items.push({ el: el, delay: step.delay });
        });
        return items;
    }

    // Мгновенно прячем элемент без transition, потом возвращаем
    // transition — иначе блок сначала «уезжает вниз» перед появлением
    function prepare(items) {
        items.forEach(function (item) {
            item.el.style.transition = 'none';
            item.el.classList.add('reveal-init');
        });
        void document.body.offsetHeight;   // force reflow
        items.forEach(function (item) {
            item.el.style.transition = '';
        });
    }

    function runCascade(items, baseDelay) {
        items.forEach(function (item) {
            setTimeout(function () {
                item.el.classList.add('reveal-in');
                setTimeout(function () {
                    item.el.classList.add('reveal-done');
                }, 1000);
            }, baseDelay + item.delay);
        });
    }

    // --- Hero ---
    var heroItems = collect(heroPlan);
    prepare(heroItems);

    function onReady() {
        runCascade(heroItems, 150);
    }

    if (document.readyState === 'complete') {
        requestAnimationFrame(onReady);
    } else {
        window.addEventListener('load', onReady, { once: true });
    }

    // --- Result ---
    var resultItems   = collect(resultPlan);
    var resultSection = document.querySelector('.result');
    if (!resultItems.length || !resultSection) return;

    if (!('IntersectionObserver' in window)) {
        resultItems.forEach(function (item) {
            item.el.classList.add('reveal-init', 'reveal-in');
        });
        return;
    }

    prepare(resultItems);

    var pageBody = document.querySelector('.page-body');

    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            runCascade(resultItems, 0);
            io.disconnect();
        });
    }, {
        root: pageBody || null,
        threshold: 0.3
    });

    io.observe(resultSection);

})();

/* ============================================================
   4. Футер и кнопка «В начало»
   Футер выезжает на второй секции и дальше висит всегда
   ============================================================ */

(function () {
    'use strict';

    var footer   = document.getElementById('site-footer');
    var btn      = document.getElementById('scroll-top');
    var pageBody = document.querySelector('.page-body');
    var trigger  = document.querySelector('.result'); // вторая секция

    if (!footer || !pageBody || !trigger) return;

    // Порог: верх второй секции дошёл до середины экрана
    function update() {
        var threshold = trigger.offsetTop - pageBody.clientHeight * 0.5;
        footer.classList.toggle('footer--visible', pageBody.scrollTop >= threshold);
    }

    pageBody.addEventListener('scroll', update, { passive: true });

    // На resize порог сдвигается — пересчитываем
    var resizeTimer = null;
    window.addEventListener('resize', function () {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(update, 150);
    });

    window.addEventListener('load', update);

    // Стартовая проверка — если страница открыта не с нуля
    update();

    if (!btn) return;

    // Клик — плавный скролл наверх
    btn.addEventListener('click', function () {
        var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        pageBody.scrollTo({
            top: 0,
            behavior: prefersReduced ? 'auto' : 'smooth'
        });
    });

})();


/* ============================================================
   5. Линия «Процесс работы»: прорисовывается при появлении
   ============================================================ */

(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var process  = document.querySelector('.process');
    var pageBody = document.querySelector('.page-body');

    if (reduceMotion || !process || !('IntersectionObserver' in window)) return;

    process.classList.add('process--armed');

    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            process.classList.add('process--in');
            io.disconnect();
        });
    }, {
        root: pageBody || null,
        threshold: 0.4
    });

    io.observe(process);

})();
