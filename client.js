/**
 * INNOBAND — Client Dashboard Script
 * File : client.js
 * Desc : CRUD for profiles, order flow management,
 *        theme toggle, and localStorage persistence.
 */

'use strict';

/* ============================================================
   CONSTANTS & STATE
   ============================================================ */
var STORAGE_KEYS = {
    PROFILES:  'innoband-profiles',
    USER:      'innoband-user',
    LOGGED_IN: 'innoband-loggedin',
    THEME:     'innoband-theme',
    ORDER:     'innoband-order'
};

var PRODUCTS = {
    playtime: {
        name:  'Seri Playtime',
        desc:  'Gelang INNOBAND untuk si kecil aktif',
        price: 'Rp 399K',
        priceNum: 399000
    },
    minimalist: {
        name:  'Seri Minimalist',
        desc:  'Gelang INNOBAND untuk kenyamanan ekstra',
        price: 'Rp 899K',
        priceNum: 899000
    }
};

var state = {
    selectedProfileId: null,
    selectedColor: 'Hitam',
    currentStep: 1,
    orderProduct: null
};

/* ============================================================
   INITIALIZATION
   ============================================================ */
(function init() {
    checkAuth();
    loadTheme();
    loadUserInfo();
    renderProfiles();
    checkOrderParam();
})();

/** Redirect to landing page if not logged in */
function checkAuth() {
    var loggedIn = localStorage.getItem(STORAGE_KEYS.LOGGED_IN);
    // if (loggedIn !== 'true') {
    //     window.location.href = 'index.html';
    // }
}

/** Apply saved theme */
function loadTheme() {
    var saved = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    document.body.setAttribute('data-theme', saved);
}

/** Load user info into nav */
function loadUserInfo() {
    var user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
    var nameEl = document.getElementById('navUserName');
    var avatarEl = document.getElementById('navAvatar');

    if (user.name) {
        if (nameEl) nameEl.textContent = user.name;
        if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
    }
}

/** Check URL params for order action */
function checkOrderParam() {
    var params = new URLSearchParams(window.location.search);
    var action = params.get('action');
    var product = params.get('product');

    if (action === 'order' && product && PRODUCTS[product]) {
        state.orderProduct = product;
        showOrderFlow(product);
        switchToTab('pesan');
    }
}

/* ============================================================
   THEME TOGGLE
   ============================================================ */
(function initTheme() {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;

    btn.addEventListener('click', function () {
        var current = document.body.getAttribute('data-theme');
        var next = current === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', next);
        localStorage.setItem(STORAGE_KEYS.THEME, next);
    });
})();

/* ============================================================
   LOGOUT
   ============================================================ */
(function initLogout() {
    var btn = document.getElementById('logoutBtn');
    if (!btn) return;

    btn.addEventListener('click', function () {
        if (confirm('Apakah kamu yakin ingin keluar?')) {
            localStorage.removeItem(STORAGE_KEYS.LOGGED_IN);
            localStorage.removeItem(STORAGE_KEYS.USER);
            localStorage.removeItem(STORAGE_KEYS.ORDER);
            window.location.href = 'index.html';
        }
    });
})();

/* ============================================================
   TAB NAVIGATION
   ============================================================ */
(function initTabs() {
    var tabs = document.querySelectorAll('.client-tab');

    tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            var tabName = this.getAttribute('data-tab');
            switchToTab(tabName);
        });
    });
})();

function switchToTab(tabName) {
    // Update tab buttons
    var tabs = document.querySelectorAll('.client-tab');
    tabs.forEach(function (t) { t.classList.remove('active'); });
    var activeTab = document.querySelector('.client-tab[data-tab="' + tabName + '"]');
    if (activeTab) activeTab.classList.add('active');

    // Update panels
    var panels = document.querySelectorAll('.tab-panel');
    panels.forEach(function (p) { p.classList.remove('active'); });

    if (tabName === 'datadiri') {
        document.getElementById('panelDataDiri').classList.add('active');
    } else if (tabName === 'pesan') {
        document.getElementById('panelPesan').classList.add('active');
        // Refresh profile selection if order is active
        if (state.orderProduct) {
            renderProfileSelection();
        }
    }
}

/* ============================================================
   PROFILES — CRUD
   ============================================================ */

/** Get all profiles from localStorage */
function getProfiles() {
    var data = localStorage.getItem(STORAGE_KEYS.PROFILES);
    return data ? JSON.parse(data) : [];
}

/** Save profiles array to localStorage */
function saveProfiles(profiles) {
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
}

/** Generate unique ID */
function generateId() {
    return 'prof_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

/** Render profile cards */
function renderProfiles() {
    var profiles = getProfiles();
    var grid = document.getElementById('profilesGrid');
    var emptyState = document.getElementById('emptyState');

    if (profiles.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    grid.innerHTML = profiles.map(function (p) {
        var initials = p.name ? p.name.split(' ').map(function(w){ return w.charAt(0); }).join('').substring(0, 2).toUpperCase() : '?';

        return '<div class="profile-card">' +
            '<div class="profile-card-header">' +
                '<div class="profile-card-avatar">' + initials + '</div>' +
                '<div>' +
                    '<div class="profile-card-name">' + escapeHtml(p.name) + '</div>' +
                    (p.blood ? '<div class="profile-card-badge">Gol. Darah ' + escapeHtml(p.blood) + '</div>' : '') +
                '</div>' +
            '</div>' +
            '<div class="profile-card-info">' +
                '<div class="profile-info-row">' +
                    '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' +
                    '<span class="profile-info-label">Telepon</span>' +
                    '<span class="profile-info-value">' + escapeHtml(p.phone) + '</span>' +
                '</div>' +
                (p.address ? '<div class="profile-info-row">' +
                    '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
                    '<span class="profile-info-label">Alamat</span>' +
                    '<span class="profile-info-value">' + escapeHtml(p.address) + '</span>' +
                '</div>' : '') +
                (p.allergy ? '<div class="profile-info-row">' +
                    '<svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
                    '<span class="profile-info-label">Alergi</span>' +
                    '<span class="profile-info-value">' + escapeHtml(p.allergy) + '</span>' +
                '</div>' : '') +
                '<div class="profile-info-row">' +
                    '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>' +
                    '<span class="profile-info-label">Darurat</span>' +
                    '<span class="profile-info-value">' + escapeHtml(p.emergencyName) + ' (' + escapeHtml(p.emergencyPhone) + ')</span>' +
                '</div>' +
            '</div>' +
            '<div class="profile-card-actions">' +
                '<button class="btn-secondary btn-sm" onclick="editProfile(\'' + p.id + '\')">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
                    'Edit' +
                '</button>' +
                '<button class="btn-danger btn-sm" onclick="deleteProfile(\'' + p.id + '\')">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
                    'Hapus' +
                '</button>' +
            '</div>' +
        '</div>';
    }).join('');
}

/** Open modal for adding new profile */
function openProfileModal(profileId) {
    var modal = document.getElementById('profileModal');
    var form = document.getElementById('profileForm');
    var title = document.getElementById('modalTitle');
    var saveBtn = document.getElementById('btnSaveProfile');

    form.reset();
    document.getElementById('profileId').value = '';

    if (profileId) {
        // Edit mode
        var profiles = getProfiles();
        var profile = profiles.find(function (p) { return p.id === profileId; });
        if (profile) {
            title.textContent = 'Edit Data Diri';
            saveBtn.textContent = 'Perbarui Data Diri';
            document.getElementById('profileId').value = profile.id;
            document.getElementById('profName').value = profile.name || '';
            document.getElementById('profPhone').value = profile.phone || '';
            document.getElementById('profBlood').value = profile.blood || '';
            document.getElementById('profAddress').value = profile.address || '';
            document.getElementById('profAllergy').value = profile.allergy || '';
            document.getElementById('profEmergencyName').value = profile.emergencyName || '';
            document.getElementById('profEmergencyPhone').value = profile.emergencyPhone || '';
        }
    } else {
        title.textContent = 'Tambah Data Diri';
        saveBtn.textContent = 'Simpan Data Diri';
    }

    modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Focus first input
    setTimeout(function () {
        document.getElementById('profName').focus();
    }, 100);
}

/** Close profile modal */
function closeProfileModal() {
    var modal = document.getElementById('profileModal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
}

/** Save profile (create or update) */
function saveProfile(event) {
    event.preventDefault();

    var id = document.getElementById('profileId').value;
    var profiles = getProfiles();

    var profileData = {
        name:           document.getElementById('profName').value.trim(),
        phone:          document.getElementById('profPhone').value.trim(),
        blood:          document.getElementById('profBlood').value,
        address:        document.getElementById('profAddress').value.trim(),
        allergy:        document.getElementById('profAllergy').value.trim(),
        emergencyName:  document.getElementById('profEmergencyName').value.trim(),
        emergencyPhone: document.getElementById('profEmergencyPhone').value.trim()
    };

    if (id) {
        // Update existing
        profiles = profiles.map(function (p) {
            if (p.id === id) {
                return Object.assign({}, p, profileData);
            }
            return p;
        });
        showToast('Berhasil!', 'Data diri telah diperbarui.');
    } else {
        // Create new
        profileData.id = generateId();
        profileData.createdAt = new Date().toISOString();
        profiles.push(profileData);
        showToast('Berhasil!', 'Data diri baru telah ditambahkan.');
    }

    saveProfiles(profiles);
    renderProfiles();
    closeProfileModal();

    // Refresh order flow profile selection if active
    if (state.orderProduct) {
        renderProfileSelection();
    }
}

/** Edit profile */
function editProfile(id) {
    openProfileModal(id);
}

/** Delete profile */
function deleteProfile(id) {
    if (!confirm('Apakah kamu yakin ingin menghapus data diri ini?')) return;

    var profiles = getProfiles();
    profiles = profiles.filter(function (p) { return p.id !== id; });
    saveProfiles(profiles);
    renderProfiles();
    showToast('Dihapus', 'Data diri telah dihapus.');

    // Reset selection if deleted profile was selected
    if (state.selectedProfileId === id) {
        state.selectedProfileId = null;
        updateStep1Button();
    }

    if (state.orderProduct) {
        renderProfileSelection();
    }
}

/* ============================================================
   ORDER FLOW
   ============================================================ */

/** Show order flow with selected product */
function showOrderFlow(productKey) {
    var product = PRODUCTS[productKey];
    if (!product) return;

    // Show banner & steps, hide empty state
    document.getElementById('orderBanner').style.display = 'flex';
    document.getElementById('orderSteps').style.display = 'flex';
    document.getElementById('noOrderState').style.display = 'none';

    // Set product info
    document.getElementById('orderProductName').textContent = product.name;
    document.getElementById('orderProductDesc').textContent = product.desc;
    document.getElementById('orderProductPrice').textContent = product.price;

    // Reset to step 1
    state.currentStep = 1;
    state.selectedProfileId = null;
    state.selectedColor = 'Hitam';
    showStep(1);
    renderProfileSelection();
}

/** Render profile selection cards in order step 1 */
function renderProfileSelection() {
    var profiles = getProfiles();
    var grid = document.getElementById('profileSelectGrid');
    var warning = document.getElementById('noProfilesWarning');
    var step1Next = document.getElementById('step1Next');

    if (profiles.length === 0) {
        grid.innerHTML = '';
        grid.style.display = 'none';
        warning.style.display = 'block';
        step1Next.style.display = 'none';
        return;
    }

    warning.style.display = 'none';
    grid.style.display = 'grid';
    step1Next.style.display = 'block';

    grid.innerHTML = profiles.map(function (p) {
        var isSelected = state.selectedProfileId === p.id;
        return '<div class="profile-select-card' + (isSelected ? ' selected' : '') + '" onclick="selectProfile(\'' + p.id + '\')">' +
            '<div class="profile-select-name">' + escapeHtml(p.name) + '</div>' +
            '<div class="profile-select-detail">' + escapeHtml(p.phone) + (p.blood ? ' · Gol. ' + escapeHtml(p.blood) : '') + '</div>' +
            '<div class="profile-select-detail" style="margin-top: 4px;">Darurat: ' + escapeHtml(p.emergencyName) + '</div>' +
        '</div>';
    }).join('');

    updateStep1Button();
}

/** Select a profile for the order */
function selectProfile(id) {
    state.selectedProfileId = id;
    renderProfileSelection();
}

/** Update step 1 next button state */
function updateStep1Button() {
    var btn = document.getElementById('btnNextStep1');
    if (btn) {
        btn.disabled = !state.selectedProfileId;
    }
}

/** Select color option */
function selectColor(el) {
    var options = document.querySelectorAll('.color-option');
    options.forEach(function (opt) { opt.classList.remove('selected'); });
    el.classList.add('selected');
    state.selectedColor = el.getAttribute('data-color');
}

/** Navigate between order steps */
function goToStep(stepNum) {
    if (stepNum === 2 && !state.selectedProfileId) {
        showToast('Perhatian', 'Pilih data diri terlebih dahulu.');
        return;
    }

    if (stepNum === 3) {
        populateSummary();
    }

    state.currentStep = stepNum;
    showStep(stepNum);
}

/** Show specific step, hide others */
function showStep(num) {
    for (var i = 1; i <= 3; i++) {
        var stepEl = document.getElementById('orderStep' + i);
        if (i === num) {
            stepEl.style.display = 'block';
            stepEl.classList.add('active-step');
            stepEl.classList.remove('completed-step');
        } else if (i < num) {
            stepEl.style.display = 'none';
            stepEl.classList.remove('active-step');
            stepEl.classList.add('completed-step');
        } else {
            stepEl.style.display = 'none';
            stepEl.classList.remove('active-step', 'completed-step');
        }
    }
}

/** Populate order summary */
function populateSummary() {
    var product = PRODUCTS[state.orderProduct];
    var profiles = getProfiles();
    var selectedProfile = profiles.find(function (p) { return p.id === state.selectedProfileId; });
    var customName = document.getElementById('customName').value.trim();

    document.getElementById('summaryProduct').textContent = product ? product.name : '-';
    document.getElementById('summaryProfile').textContent = selectedProfile ? selectedProfile.name : '-';
    document.getElementById('summaryColor').textContent = state.selectedColor;
    document.getElementById('summaryName').textContent = customName || '(Tidak ada)';
    document.getElementById('summaryTotal').textContent = product ? product.price : '-';
}

/** Confirm order */
function confirmOrder() {
    var product = PRODUCTS[state.orderProduct];
    var profiles = getProfiles();
    var selectedProfile = profiles.find(function (p) { return p.id === state.selectedProfileId; });
    var customName = document.getElementById('customName').value.trim();

    // Save order to localStorage
    var order = {
        id: 'order_' + Date.now(),
        product: state.orderProduct,
        productName: product ? product.name : '',
        profileId: state.selectedProfileId,
        profileName: selectedProfile ? selectedProfile.name : '',
        color: state.selectedColor,
        customName: customName,
        price: product ? product.price : '',
        createdAt: new Date().toISOString()
    };

    var orders = JSON.parse(localStorage.getItem('innoband-orders') || '[]');
    orders.push(order);
    localStorage.setItem('innoband-orders', JSON.stringify(orders));

    // Clear URL params
    localStorage.removeItem(STORAGE_KEYS.ORDER);

    // Show success
    document.getElementById('orderSuccessOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

/** Close order success */
function closeOrderSuccess() {
    document.getElementById('orderSuccessOverlay').classList.remove('open');
    document.body.style.overflow = '';

    // Reset order state
    state.orderProduct = null;
    state.selectedProfileId = null;
    state.currentStep = 1;

    // Clear URL params
    var url = window.location.pathname;
    window.history.replaceState({}, '', url);

    // Switch to data diri tab
    switchToTab('datadiri');

    // Reset order panel
    document.getElementById('orderBanner').style.display = 'none';
    document.getElementById('orderSteps').style.display = 'none';
    document.getElementById('noOrderState').style.display = 'block';
}

/* ============================================================
   TOAST NOTIFICATION
   ============================================================ */
var toastTimer = null;

function showToast(title, message) {
    var toast = document.getElementById('successToast');
    var textEl = document.getElementById('toastText');

    textEl.innerHTML = '<strong>' + escapeHtml(title) + '</strong>' + escapeHtml(message);
    toast.classList.add('show');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
        toast.classList.remove('show');
    }, 3000);
}

/* ============================================================
   UTILITIES
   ============================================================ */

/** Escape HTML entities */
function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/* Close modal on overlay click */
document.getElementById('profileModal').addEventListener('click', function (e) {
    if (e.target === this) {
        closeProfileModal();
    }
});

/* Close modal on Escape key */
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeProfileModal();
        var successOverlay = document.getElementById('orderSuccessOverlay');
        if (successOverlay.classList.contains('open')) {
            closeOrderSuccess();
        }
    }
});
