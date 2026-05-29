/**
 * INNOBAND — Landing Page Script
 * File : main.js
 * Desc : Scroll-reveal animation, smooth-scroll helper,
 *        mobile hamburger menu toggle, and dark/light theme switcher.
 */

'use strict';

/* ── Scroll-reveal ── */
(function initReveal() {
    var reveals  = document.querySelectorAll('.reveal');
    var observer = new IntersectionObserver(
        function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.12 }
    );

    reveals.forEach(function (el) {
        observer.observe(el);
    });
}());

/* ── Smooth-scroll helper ── */
/**
 * Smoothly scrolls the page to the element matching the given ID.
 * @param {string} id - The target element's id (without '#').
 */
function scrollToSection(id) {
    var target = document.getElementById(id);
    if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
    }
}

/* ── Mobile hamburger menu ── */
(function initHamburger() {
    var btn    = document.getElementById('navHamburger');
    var drawer = document.getElementById('navDrawer');

    if (!btn || !drawer) return;

    /** Open the mobile drawer. */
    function openDrawer() {
        btn.classList.add('open');
        drawer.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        btn.setAttribute('aria-label', 'Tutup menu');
        document.body.style.overflow = 'hidden';   /* prevent background scroll */
    }

    /** Close the mobile drawer. */
    function closeDrawer() {
        btn.classList.remove('open');
        drawer.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-label', 'Buka menu');
        document.body.style.overflow = '';
    }

    /* Expose closeDrawer globally so inline onclick in drawer can call it */
    window.closeDrawer = closeDrawer;

    /* Toggle on hamburger click */
    btn.addEventListener('click', function () {
        if (drawer.classList.contains('open')) {
            closeDrawer();
        } else {
            openDrawer();
        }
    });

    /* Close drawer when any drawer link is clicked */
    var drawerLinks = drawer.querySelectorAll('.drawer-link');
    drawerLinks.forEach(function (link) {
        link.addEventListener('click', function () {
            closeDrawer();
        });
    });
}());

/* ── Dark / Light theme toggle ── */
(function initTheme() {
    var btn  = document.getElementById('themeToggle');
    var body = document.body;

    if (!btn) return;

    /* Apply saved preference from previous visit, default to light */
    var saved = localStorage.getItem('innoband-theme') || 'light';
    body.setAttribute('data-theme', saved);

    btn.addEventListener('click', function () {
        var current = body.getAttribute('data-theme');
        var next    = current === 'dark' ? 'light' : 'dark';

        body.setAttribute('data-theme', next);
        localStorage.setItem('innoband-theme', next);

        btn.setAttribute(
            'aria-label',
            next === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'
        );
    });
}());

/* ── Auth Tabs Toggle ── */
(function initAuthTabs() {
    var tabs = document.querySelectorAll('.auth-tab');
    var forms = document.querySelectorAll('.auth-form');

    if (tabs.length === 0 || forms.length === 0) return;

    tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            // Remove active class from all tabs and forms
            tabs.forEach(function (t) { t.classList.remove('active'); });
            forms.forEach(function (f) { f.classList.remove('active'); });

            // Add active class to clicked tab
            this.classList.add('active');

            // Show corresponding form
            var targetId = 'form-' + this.getAttribute('data-target');
            var targetForm = document.getElementById(targetId);
            if (targetForm) {
                targetForm.classList.add('active');
            }
        });
    });
}());

/* ── Client Menu Handler ── */
(function initClientMenu() {
    var clientLink = document.getElementById('clientMenuLink');
    if (!clientLink) return;

    clientLink.addEventListener('click', function(e) {
        var isLoggedIn = localStorage.getItem('innoband-loggedin') === 'true';
        
        // if (!isLoggedIn) {
        //     e.preventDefault();
            
        //     var hero = document.getElementById('hero');
        //     if (hero) hero.scrollIntoView({ behavior: 'smooth' });
            
        //     if (typeof window.showAuthCard === 'function') {
        //         window.showAuthCard();
        //     }
            
        //     alert('Anda harus mendaftar atau login terlebih dahulu untuk mengakses halaman Client.');
        // }
    });
}());

/* ── Show Auth Card (Hero) ── */
window.showAuthCard = function() {
    var img = document.getElementById('heroProductImage');
    var card = document.getElementById('heroAuthCard');
    if (img) img.style.display = 'none';
    if (card) {
        card.style.display = 'block';
        setTimeout(function() {
            var emailInput = document.getElementById('login-email');
            if (emailInput) emailInput.focus();
        }, 50);
    }
};

/* ── Auth Form Handlers ── */
(function initAuth() {
    var loginForm = document.getElementById('form-login');
    var registerForm = document.getElementById('form-register');

    /* -- Login -- */
    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();

            var email    = document.getElementById('login-email').value.trim();
            var password = document.getElementById('login-password').value;

            /* Check credentials from localStorage */
            var users = JSON.parse(localStorage.getItem('innoband-users') || '[]');
            var found = users.find(function (u) {
                return u.email === email && u.password === password;
            });

            if (found) {
                localStorage.setItem('innoband-loggedin', 'true');
                localStorage.setItem('innoband-user', JSON.stringify({
                    name:  found.name,
                    email: found.email,
                    phone: found.phone,
                    type:  found.type
                }));

                /* Check if there's a pending order */
                var pendingOrder = localStorage.getItem('innoband-order');
                if (pendingOrder) {
                    window.location.href = 'client.html?action=order&product=' + pendingOrder;
                } else {
                    window.location.href = 'client.html';
                }
            } else {
                alert('Email atau password salah. Silakan coba lagi atau daftar terlebih dahulu.');
            }
        });
    }

    /* -- Register -- */
    if (registerForm) {
        registerForm.addEventListener('submit', function (e) {
            e.preventDefault();

            var name     = document.getElementById('reg-name').value.trim();
            var email    = document.getElementById('reg-email').value.trim();
            var phone    = document.getElementById('reg-phone').value.trim();
            var password = document.getElementById('reg-password').value;
            var type     = document.querySelector('input[name="account-type"]:checked').value;

            /* Check if email already exists */
            var users = JSON.parse(localStorage.getItem('innoband-users') || '[]');
            var exists = users.find(function (u) { return u.email === email; });

            if (exists) {
                alert('Email sudah terdaftar. Silakan login atau gunakan email lain.');
                return;
            }

            /* Save new user */
            users.push({
                name:     name,
                email:    email,
                phone:    phone,
                password: password,
                type:     type
            });
            localStorage.setItem('innoband-users', JSON.stringify(users));

            /* Auto-login */
            localStorage.setItem('innoband-loggedin', 'true');
            localStorage.setItem('innoband-user', JSON.stringify({
                name:  name,
                email: email,
                phone: phone,
                type:  type
            }));

            /* Check pending order */
            var pendingOrder = localStorage.getItem('innoband-order');
            if (pendingOrder) {
                window.location.href = 'client.html?action=order&product=' + pendingOrder;
            } else {
                window.location.href = 'client.html';
            }
        });
    }
}());

/* ── Order Product (called from pricing buttons) ── */
window.orderProduct = function (productKey) {
    /* Go directly to client page with product regardless of login state */
    window.location.href = 'client.html?action=order&product=' + productKey;
};

