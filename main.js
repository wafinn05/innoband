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

        if (!isLoggedIn) {
            e.preventDefault();

            // Scroll hero into view
            var hero = document.getElementById('hero');
            if (hero) hero.scrollIntoView({ behavior: 'smooth' });

            // Open auth card
            if (typeof window.showAuthCard === 'function') {
                setTimeout(function() { window.showAuthCard(); }, 400);
            }

            // Show toast notification
            showAuthToast();
        }
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

/* ── Toast Notification ── */
function showAuthToast() {
    var toast = document.getElementById('toastNotif');
    if (!toast) return;
    toast.classList.add('show');
    // Auto-dismiss after 5 seconds
    setTimeout(function() {
        toast.classList.remove('show');
    }, 5000);
}

/* ── Detect redirect from protected page ── */
(function checkAuthRedirect() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'required') {
        // Clean up the URL without reloading
        var cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        // Show toast
        showAuthToast();

        // Scroll to hero and open the login card
        var hero = document.getElementById('hero');
        if (hero) hero.scrollIntoView({ behavior: 'smooth' });

        setTimeout(function() {
            if (typeof window.showAuthCard === 'function') {
                window.showAuthCard();
            }
        }, 400);
    }
}());

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

            if (typeof window.dbLogin === 'function') {
                window.dbLogin(email, password)
                    .then(function (userData) {
                        localStorage.setItem('innoband-loggedin', 'true');
                        localStorage.setItem('innoband-user', JSON.stringify(userData));

                        /* Check if there's a pending order */
                        var pendingOrder = localStorage.getItem('innoband-order');
                        if (pendingOrder) {
                            window.location.href = 'client.html?action=order&product=' + pendingOrder;
                        } else {
                            window.location.href = 'client.html';
                        }
                    })
                    .catch(function (error) {
                        alert('Login Gagal: ' + error.message);
                    });
            } else {
                alert('Firebase Service belum siap. Silakan coba sesaat lagi.');
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

            if (typeof window.dbRegister === 'function') {
                window.dbRegister(email, password, name, phone, type)
                    .then(function (userData) {
                        localStorage.setItem('innoband-loggedin', 'true');
                        localStorage.setItem('innoband-user', JSON.stringify(userData));

                        /* Check pending order */
                        var pendingOrder = localStorage.getItem('innoband-order');
                        if (pendingOrder) {
                            window.location.href = 'client.html?action=order&product=' + pendingOrder;
                        } else {
                            window.location.href = 'client.html';
                        }
                    })
                    .catch(function (error) {
                        alert('Pendaftaran Gagal: ' + error.message);
                    });
            } else {
                alert('Firebase Service belum siap. Silakan coba sesaat lagi.');
            }
        });
    }
}());

/* ── Order Product (called from pricing buttons) ── */
window.orderProduct = function (productKey) {
    /* Go directly to client page with product regardless of login state */
    window.location.href = 'client.html?action=order&product=' + productKey;
};

/* User Profile Logic */
document.addEventListener('DOMContentLoaded', function() {
    var navProfile = document.querySelector('.nav-profile');
    var profileModal = document.getElementById('userProfileModal');
    var profileForm = document.getElementById('userProfileFormIdx');
    var closeBtn = document.getElementById('closeUserProfileIdx');
    var delBtn = document.getElementById('btnDeleteAccountIdx');

    if (navProfile) {
        navProfile.addEventListener('click', function(e) {
            e.preventDefault();
            if (localStorage.getItem('innoband-loggedin') === 'true') {
                var userStr = localStorage.getItem('innoband-user');
                if (userStr) {
                    var user = JSON.parse(userStr);
                    var elEmail = document.getElementById('profileEmailIdx');
                    var elName = document.getElementById('profileNameIdx');
                    var elPhone = document.getElementById('profilePhoneIdx');
                    if(elEmail) elEmail.value = user.email || '';
                    if(elName) elName.value = user.name || '';
                    if(elPhone) elPhone.value = user.phone || '';
                    
                    if(profileModal) profileModal.style.display = 'flex';
                }
            } else {
                if (typeof window.showAuthCard === 'function') {
                    window.showAuthCard();
                }
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if(profileModal) profileModal.style.display = 'none';
        });
    }

    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            var email = document.getElementById('profileEmailIdx').value;
            var name = document.getElementById('profileNameIdx').value;
            var phone = document.getElementById('profilePhoneIdx').value;
            
            if (typeof window.dbUpdateUser === 'function') {
                window.dbUpdateUser(email, name, phone).then(function() {
                    var userStr = localStorage.getItem('innoband-user');
                    if (userStr) {
                        var user = JSON.parse(userStr);
                        user.name = name;
                        user.phone = phone;
                        localStorage.setItem('innoband-user', JSON.stringify(user));
                    }
                    if(profileModal) profileModal.style.display = 'none';
                    if (typeof showToast === 'function') {
                        showToast('Profil berhasil diperbarui!');
                    } else { alert('Profil berhasil diperbarui!'); }
                }).catch(function(err) {
                    alert('Gagal memperbarui profil: ' + err.message);
                });
            }
        });
    }

    if (delBtn) {
        delBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('Apakah Anda yakin ingin menghapus akun? Semua data diri Anda akan hilang secara permanen.')) {
                var email = document.getElementById('profileEmailIdx').value;
                if (typeof window.dbDeleteAccount === 'function') {
                    window.dbDeleteAccount(email).then(function() {
                        localStorage.removeItem('innoband-loggedin');
                        localStorage.removeItem('innoband-user');
                        window.location.reload();
                    }).catch(function(err) {
                        alert('Gagal menghapus akun: ' + err.message + '. Anda mungkin perlu logout dan login kembali untuk melakukan aksi ini.');
                    });
                }
            }
        });
    }
});
