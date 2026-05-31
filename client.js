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
    PROFILES: 'innoband-profiles',
    USER: 'innoband-user',
    LOGGED_IN: 'innoband-loggedin',
    THEME: 'innoband-theme',
    ORDER: 'innoband-order'
};

var PRODUCTS = {
    playtime: {
        name: 'Seri Playtime',
        desc: 'Gelang INNOBAND untuk si kecil aktif',
        price: 'Rp 359.000',
        priceNum: 359000
    },
    minimalist: {
        name: 'Seri Minimalist',
        desc: 'Gelang INNOBAND untuk kenyamanan ekstra',
        price: 'Rp 499.000',
        priceNum: 499000
    }
};

// TELEGRAM BOT CONFIGURATION
// Masukkan Token Bot dari @BotFather dan Chat ID kamu di sini
var TELEGRAM_BOT_TOKEN = '8887160716:AAGm7f_SqkmjHUt9a-qCR1dDhKjONzmI9LQ';
var TELEGRAM_CHAT_ID = '-1003922553114';

var state = {
    selectedProfileId: null,
    selectedColor: 'Hitam',
    currentStep: 1,
    orderProduct: null,
    paymentMethod: 'qris',
    paymentProofFile: null,
    profiles: [],
    orders: []
};

/* ============================================================
   INITIALIZATION
   ============================================================ */
(function init() {
    // Hide body to prevent flash of content before auth check completes
    document.body.style.visibility = 'hidden';
    checkAuth(function () {
        document.body.style.visibility = 'visible';
        loadTheme();
        loadUserInfo();

        // Load profiles and orders asynchronously from Firebase on startup
        loadProfilesFromDb().then(function () {
            renderProfiles();
            if (state.orderProduct) {
                renderProfileSelection();
            }
        });

        loadOrdersFromDb().then(function () {
            renderTracking();
            renderOrderHistory();
        });

        checkOrderParam();
    });
})();

function loadProfilesFromDb() {
    var user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
    if (!user.email) return Promise.resolve([]);

    // Set up real-time listener if available
    if (typeof window.dbListenProfiles === 'function') {
        window.dbListenProfiles(user.email, function (profiles) {
            state.profiles = profiles;
            if (typeof window.renderProfiles === 'function') {
                window.renderProfiles();
            } else if (typeof renderProfiles !== 'undefined') {
                renderProfiles();
            }

            // Tutup modal SOS otomatis jika peringatan diselesaikan (isAlert false)
            if (typeof _currentSosProfileId !== 'undefined' && _currentSosProfileId) {
                var p = profiles.find(function (item) { return item.id === _currentSosProfileId; });
                if (p && !p.isAlert) {
                    closeSosModal();
                }
            }
        });
    }

    if (typeof window.dbGetProfiles === 'function') {
        return window.dbGetProfiles(user.email).then(function (profiles) {
            state.profiles = profiles;
            return profiles;
        });
    }
    return Promise.resolve([]);
}

function loadOrdersFromDb() {
    var user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
    if (!user.email) return Promise.resolve([]);

    // Set up real-time listener if available
    if (typeof window.dbListenOrders === 'function') {
        window.dbListenOrders(user.email, function (orders) {
            state.orders = orders;
            if (typeof window.renderTracking === 'function') {
                window.renderTracking();
            } else if (typeof renderTracking !== 'undefined') {
                renderTracking();
            }
            if (typeof window.renderOrderHistory === 'function') {
                window.renderOrderHistory();
            } else if (typeof renderOrderHistory !== 'undefined') {
                renderOrderHistory();
            }
        });
    }

    if (typeof window.dbGetOrders === 'function') {
        return window.dbGetOrders(user.email).then(function (orders) {
            state.orders = orders;
            return orders;
        });
    }
    return Promise.resolve([]);
}

/** Redirect to landing page if not logged in, calls onAllowed() if user IS authenticated */
function checkAuth(onAllowed) {
    if (typeof window.firebaseAuth !== 'undefined') {
        window.firebaseAuth.onAuthStateChanged(function (user) {
            if (user) {
                localStorage.setItem(STORAGE_KEYS.LOGGED_IN, 'true');
                onAllowed();
            } else {
                localStorage.removeItem(STORAGE_KEYS.LOGGED_IN);
                localStorage.removeItem(STORAGE_KEYS.USER);
                localStorage.removeItem(STORAGE_KEYS.ORDER);
                window.location.href = 'index.html';
            }
        });
    } else {
        // Firebase SDK not ready yet — fall back to localStorage flag
        var loggedIn = localStorage.getItem(STORAGE_KEYS.LOGGED_IN);
        if (loggedIn !== 'true') {
            window.location.href = 'index.html';
            return;
        }

        // Wait for Firebase module to load before proceeding
        var checkInterval = setInterval(function () {
            if (typeof window.dbGetProfiles === 'function') {
                clearInterval(checkInterval);
                onAllowed();
            }
        }, 50);
    }
}

/** Apply saved theme */
function loadTheme() {
    var saved = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
    document.body.setAttribute('data-theme', saved);
}

/** Load user info into nav and setup company-specific features */
function loadUserInfo() {
    var user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
    var nameEl = document.getElementById('navUserName');
    var avatarEl = document.getElementById('navAvatar');

    if (user.name) {
        if (nameEl) nameEl.textContent = user.name;
        if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
    }

    // Show upload button and update headings for company accounts
    if (user.type === 'perusahaan') {
        var uploadBtn = document.getElementById('btnUploadCSV');
        if (uploadBtn) uploadBtn.style.display = 'flex';

        var titleEl = document.getElementById('dataDiriTitle');
        var subtitleEl = document.getElementById('dataDiriSubtitle');
        if (titleEl) titleEl.textContent = 'Data Diri';
        if (subtitleEl) subtitleEl.textContent = 'Kelola data diri yang akan disimpan di QR code gelang INNOBAND.';
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
   LOGOUT
   ============================================================ */
(function initLogout() {
    var btn = document.getElementById('logoutBtn');
    if (!btn) return;

    btn.addEventListener('click', function () {
        if (confirm('Apakah kamu yakin ingin keluar?')) {
            if (typeof window.dbLogout === 'function') {
                window.dbLogout().then(function () {
                    localStorage.removeItem(STORAGE_KEYS.LOGGED_IN);
                    localStorage.removeItem(STORAGE_KEYS.USER);
                    localStorage.removeItem(STORAGE_KEYS.ORDER);
                    window.location.href = 'index.html';
                }).catch(function (err) {
                    console.error("Logout error:", err);
                    // Fallback
                    localStorage.removeItem(STORAGE_KEYS.LOGGED_IN);
                    localStorage.removeItem(STORAGE_KEYS.USER);
                    localStorage.removeItem(STORAGE_KEYS.ORDER);
                    window.location.href = 'index.html';
                });
            } else {
                localStorage.removeItem(STORAGE_KEYS.LOGGED_IN);
                localStorage.removeItem(STORAGE_KEYS.USER);
                localStorage.removeItem(STORAGE_KEYS.ORDER);
                window.location.href = 'index.html';
            }
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
        renderProfiles();
    } else if (tabName === 'pesan') {
        document.getElementById('panelPesan').classList.add('active');
        if (state.orderProduct) {
            // Re-apply the full order flow UI (hides empty state, shows banner & steps)
            showOrderFlow(state.orderProduct);
        } else {
            renderOrderHistory();
        }
    } else if (tabName === 'lacak') {
        document.getElementById('panelLacak').classList.add('active');
        renderTracking();
    }
}

/* ============================================================
   PROFILES — CRUD
   ============================================================ */

/** Get all profiles from cached state */
function getProfiles() {
    return state.profiles;
}

/** State: which event group is currently expanded */
var expandedEventGroup = null;

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

    // Sort profiles: Alerts on top, sorted by newest alert first
    profiles.sort(function (a, b) {
        if (a.isAlert && !b.isAlert) return -1;
        if (!a.isAlert && b.isAlert) return 1;
        if (a.isAlert && b.isAlert) {
            var timeA = a.alertTime ? new Date(a.alertTime).getTime() : 0;
            var timeB = b.alertTime ? new Date(b.alertTime).getTime() : 0;
            return timeB - timeA;
        }
        return 0;
    });

    var user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
    var isCompany = user.type === 'perusahaan';

    if (isCompany) {
        renderProfilesGrouped(profiles, grid);
    } else {
        renderProfilesFlat(profiles, grid);
    }
}

/** Render profiles as grouped event cards (company accounts) */
function renderProfilesGrouped(profiles, grid) {
    // Group by eventName; use fallback key for profiles without event
    var groups = {};
    profiles.forEach(function (p) {
        var key = (p.eventName && p.eventName.trim()) ? p.eventName.trim() : '__no_event__';
        if (!groups[key]) groups[key] = { eventName: key, purpose: p.eventPurpose, members: [] };
        groups[key].members.push(p);
    });

    var groupKeys = Object.keys(groups);

    // Preserve expanded group across re-renders (if still valid)
    if (expandedEventGroup && !groups[expandedEventGroup]) expandedEventGroup = null;

    var purposeIcon = {
        'konser': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
        'olahraga': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l4.24 4.24"/><path d="M14.83 9.17l4.24-4.24"/><path d="M14.83 14.83l4.24 4.24"/><path d="M9.17 14.83l-4.24 4.24"/></svg>',
        '__no_event__': '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
    };

    var html = '';

    // If a group is expanded, show back button + that group's profiles
    if (expandedEventGroup && groups[expandedEventGroup]) {
        var group = groups[expandedEventGroup];
        var displayName = group.eventName === '__no_event__' ? 'Data Diri Umum' : group.eventName;
        var purpose = group.purpose || '__no_event__';

        html += '<div class="event-group-back" onclick="collapseEventGroup()">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>' +
            '<span>Kembali</span>' +
            '</div>' +
            '<div class="event-group-title-bar">' +
            '<div class="event-group-title-icon" data-purpose="' + purpose + '">' + (purposeIcon[purpose] || purposeIcon['__no_event__']) + '</div>' +
            '<div>' +
            '<div class="event-group-title-name">' + escapeHtml(displayName) + '</div>' +
            '<div class="event-group-title-sub">' + group.members.length + ' peserta</div>' +
            '</div>' +
            '</div>';

        html += '<div class="profiles-grid-inner">';
        group.members.forEach(function (p) {
            html += renderSingleProfileCard(p);
        });
        html += '</div>';

        grid.innerHTML = html;
        grid.className = 'profiles-grid profiles-grid-expanded';

    } else {
        // Show event group summary cards
        html = '<div class="event-groups-grid">';
        groupKeys.forEach(function (key) {
            var group = groups[key];
            var displayName = key === '__no_event__' ? 'Data Diri Umum' : key;
            var purpose = group.purpose || '__no_event__';
            var count = group.members.length;
            var initials = displayName.split(' ').map(function (w) { return w.charAt(0); }).join('').substring(0, 2).toUpperCase();

            html += '<div class="event-group-card" onclick="expandEventGroup(\'' + escapeAttr(key) + '\')">' +
                '<div class="event-group-card-top">' +
                '<div class="event-group-card-icon" data-purpose="' + purpose + '">' + (purposeIcon[purpose] || purposeIcon['__no_event__']) + '</div>' +
                '<div class="event-group-card-badge">' + count + ' Peserta</div>' +
                '</div>' +
                '<div class="event-group-card-name">' + escapeHtml(displayName) + '</div>' +
                (purpose !== '__no_event__' ? '<div class="event-group-card-type">' + (purpose === 'konser' ? 'Konser' : 'Event Olahraga') + '</div>' : '') +
                '<div class="event-group-card-footer">' +
                '<span>Lihat Peserta</span>' +
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
                '</div>' +
                '</div>';
        });
        html += '</div>';

        grid.innerHTML = html;
        grid.className = '';
    }

    // Render QR codes for visible profile cards
    setTimeout(function () {
        var allVisible = profiles.filter(function (p) {
            if (!expandedEventGroup) return false;
            var key = (p.eventName && p.eventName.trim()) ? p.eventName.trim() : '__no_event__';
            return key === expandedEventGroup;
        });
        if (allVisible.length > 0) initAllQRCodes(allVisible);
    }, 50);
}

/** Expand a specific event group */
window.expandEventGroup = function (key) {
    expandedEventGroup = key;
    renderProfiles();
    var header = document.querySelector('#panelDataDiri .section-header');
    if (header) header.style.display = 'none';
};

/** Collapse back to event groups view */
window.collapseEventGroup = function () {
    expandedEventGroup = null;
    renderProfiles();
    var header = document.querySelector('#panelDataDiri .section-header');
    if (header) header.style.display = 'flex';
};

/** Escape for use in HTML attributes */
function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

/** Render profile cards flat (non-company accounts) */
function renderProfilesFlat(profiles, grid) {
    grid.className = 'profiles-grid';
    grid.innerHTML = profiles.map(function (p) {
        return renderSingleProfileCard(p);
    }).join('');

    setTimeout(function () {
        initAllQRCodes(profiles);
    }, 50);
}

/** Render a single profile card HTML string */
function renderSingleProfileCard(p) {
    var initials = p.name ? p.name.split(' ').map(function (w) { return w.charAt(0); }).join('').substring(0, 2).toUpperCase() : '?';

    var alertClass = p.isAlert ? ' card-alert' : '';
    var alertHeaderHtml = p.isAlert ?
        '<div style="margin-bottom: 1rem;"><button class="btn-danger" style="width:100%; font-weight:bold; display:flex; align-items:center; justify-content:center; gap:0.5rem;" onclick="showSosModal(\'' + p.id + '\')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> LIHAT LAPORAN DARURAT</button></div>' : '';

    return '<div class="profile-card' + alertClass + '">' +
        alertHeaderHtml +
        '<div class="profile-card-header">' +
        '<div class="profile-card-avatar">' + initials + '</div>' +
        '<div>' +
        '<div class="profile-card-name">' + escapeHtml(p.name) + '</div>' +
        (p.blood ? '<div class="profile-card-badge">Gol. Darah ' + escapeHtml(p.blood) + '</div>' : '') +
        '</div>' +
        // Mini QR code preview in top-right corner
        '<div class="profile-qr-mini" id="qr-mini-' + p.id + '" title="QR Code - Klik untuk memperbesar" onclick="showQRModal(\'' + p.id + '\')" style="cursor:pointer;"></div>' +
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
        '<button class="btn-qr btn-sm" onclick="showQRModal(\'' + p.id + '\')">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/></svg>' +
        'QR Code' +
        '</button>' +
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
}

/** Open modal for adding new profile */
function openProfileModal(profileId) {
    var modal = document.getElementById('profileModal');
    var form = document.getElementById('profileForm');
    var title = document.getElementById('modalTitle');
    var saveBtn = document.getElementById('btnSaveProfile');
    var user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
    var isCompany = user.type === 'perusahaan';

    form.reset();
    document.getElementById('profileId').value = '';

    // Hide event details groups initially
    if (document.getElementById('groupGate')) document.getElementById('groupGate').style.display = 'none';
    if (document.getElementById('groupNumber')) document.getElementById('groupNumber').style.display = 'none';

    if (isCompany) {
        document.getElementById('companyFields').style.display = 'block';
    } else {
        document.getElementById('companyFields').style.display = 'none';
    }

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

            if (isCompany) {
                document.getElementById('profRegistrationId').value = profile.registrationId || '';
                document.getElementById('profEventPurpose').value = profile.eventPurpose || '';
                document.getElementById('profEventGate').value = profile.eventGate || '';
                document.getElementById('profEventNumber').value = profile.eventNumber || '';
                toggleEventDetails();
            }
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

/** Toggle event details based on purpose */
window.toggleEventDetails = function () {
    var purpose = document.getElementById('profEventPurpose').value;
    document.getElementById('groupGate').style.display = purpose === 'konser' ? 'flex' : 'none';
    document.getElementById('groupNumber').style.display = purpose === 'olahraga' ? 'flex' : 'none';
};

/** Close profile modal */
function closeProfileModal() {
    var modal = document.getElementById('profileModal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
}

/** Save profile (create or update in Firebase) */
function saveProfile(event) {
    event.preventDefault();

    var id = document.getElementById('profileId').value;
    var user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
    var isCompany = user.type === 'perusahaan';

    var profileData = {
        id: id || null,
        name: document.getElementById('profName').value.trim(),
        phone: document.getElementById('profPhone').value.trim(),
        blood: document.getElementById('profBlood').value,
        address: document.getElementById('profAddress').value.trim(),
        allergy: document.getElementById('profAllergy').value.trim(),
        emergencyName: document.getElementById('profEmergencyName').value.trim(),
        emergencyPhone: document.getElementById('profEmergencyPhone').value.trim()
    };

    if (isCompany) {
        profileData.registrationId = document.getElementById('profRegistrationId').value.trim();
        profileData.eventPurpose = document.getElementById('profEventPurpose').value;
        profileData.eventGate = document.getElementById('profEventGate').value.trim();
        profileData.eventNumber = document.getElementById('profEventNumber').value.trim();
    }

    if (typeof window.dbSaveProfile === 'function') {
        window.dbSaveProfile(profileData, user.email)
            .then(function () {
                showToast('Berhasil!', id ? 'Data diri telah diperbarui.' : 'Data diri baru telah ditambahkan.');
                closeProfileModal();
                loadProfilesFromDb().then(function () {
                    renderProfiles();
                    if (state.orderProduct) {
                        renderProfileSelection();
                    }
                });
            })
            .catch(function (err) {
                alert('Gagal menyimpan data diri: ' + err.message);
            });
    } else {
        alert('Layanan Database belum siap.');
    }
}

/** Edit profile */
function editProfile(id) {
    openProfileModal(id);
}

/** Delete profile from Firebase */
function deleteProfile(id) {
    if (!confirm('Apakah kamu yakin ingin menghapus data diri ini?')) return;

    if (typeof window.dbDeleteProfile === 'function') {
        window.dbDeleteProfile(id)
            .then(function () {
                showToast('Dihapus', 'Data diri telah dihapus.');

                // Reset selection if deleted profile was selected
                if (state.selectedProfileId === id) {
                    state.selectedProfileId = null;
                    updateStep1Button();
                }

                loadProfilesFromDb().then(function () {
                    renderProfiles();
                    if (state.orderProduct) {
                        renderProfileSelection();
                    }
                });
            })
            .catch(function (err) {
                alert('Gagal menghapus data diri: ' + err.message);
            });
    } else {
        alert('Layanan Database belum siap.');
    }
}

/* ============================================================
   TRACKING — Lacak Pesanan
   ============================================================ */
function renderTracking() {
    var orders = state.orders; // Read from Firebase state
    var dashboard = document.getElementById('trackingDashboard');
    var emptyState = document.getElementById('emptyTrackingState');
    var list = document.getElementById('trackingList');

    if (orders.length === 0) {
        dashboard.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    dashboard.style.display = 'block';

    // The orders from DB are already newest first
    var sortedOrders = orders.slice();

    list.innerHTML = sortedOrders.map(function (order) {
        var orderId = order.id.replace('order_', 'ORD-').toUpperCase();
        var orderDate = new Date(order.createdAt);

        // Read actual status from database
        var status = order.status || 'processing'; // default to processing for old orders

        var isPending = status === 'pending_payment';
        var isRejected = status === 'rejected';
        var isProcessing = status === 'processing';
        var isShipping = status === 'shipping';
        var isDelivered = status === 'delivered';

        var step1Completed = isProcessing || isShipping || isDelivered;
        var step1Active = isPending;

        var step2Completed = isShipping || isDelivered;
        var step2Active = isProcessing;

        var step3Completed = isDelivered;
        var step3Active = isShipping;

        var step4Completed = isDelivered;
        var step4Active = false; // Delivered is just completed

        function fTime(d) {
            return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) + ', ' +
                d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        }

        // Generate progress percentage for the line
        var progress = 0;
        if (isDelivered) progress = 100;
        else if (isShipping) progress = 66;
        else if (isProcessing) progress = 33;
        else if (isPending) progress = 0;

        // Get destination for the map
        var destination = "Jakarta";
        if (order.shipping) {
            destination = order.shipping.city || order.shipping.address || "Jakarta";
        }
        var mapUrl = `https://maps.google.com/maps?saddr=Bandung&daddr=${encodeURIComponent(destination)}&output=embed`;

        // Badge styling
        var badgeHtml = '';
        if (isRejected) {
            badgeHtml = `<div class="tracking-badge" style="background: #fee2e2; color: #ef4444; padding: 4px 10px; border-radius: 100px; font-size: 0.75rem; font-weight: 600;">Ditolak</div>`;
        } else if (isPending) {
            badgeHtml = `<div class="tracking-badge" style="background: #fef3c7; color: #f59e0b; padding: 4px 10px; border-radius: 100px; font-size: 0.75rem; font-weight: 600;">Menunggu ACC</div>`;
        } else {
            badgeHtml = `<div class="tracking-badge" style="background: var(--green-dim); color: var(--green); padding: 4px 10px; border-radius: 100px; font-size: 0.75rem; font-weight: 600;">${isDelivered ? 'Selesai' : 'Diproses'}</div>`;
        }

        var timelineHtml = '';
        if (isRejected) {
            timelineHtml = `
            <div class="timeline-container">
                <div class="timeline-step completed" style="color: #ef4444;">
                    <div class="timeline-icon" style="background: #fee2e2; border-color: #ef4444; color: #ef4444;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </div>
                    <div class="timeline-content">
                        <h4 style="color: #ef4444;">Pesanan Ditolak</h4>
                        <p>Pembayaran tidak valid atau tidak sesuai. Silakan buat pesanan ulang.</p>
                        <div class="timeline-time">${fTime(orderDate)}</div>
                    </div>
                </div>
            </div>`;
        } else {
            timelineHtml = `
            <div class="timeline-container">
                <div class="timeline-line">
                    <div class="timeline-line-progress" style="height: ${progress}%;"></div>
                </div>
                
                <!-- Step 1: Menunggu Pembayaran -->
                <div class="timeline-step ${step1Completed ? 'completed' : (step1Active ? 'active' : '')}">
                    <div class="timeline-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <div class="timeline-content">
                        <h4>Menunggu Konfirmasi Pembayaran</h4>
                        <p>Admin sedang mengecek bukti pembayaran Anda.</p>
                        <div class="timeline-time">${fTime(orderDate)}</div>
                    </div>
                </div>
                
                <!-- Step 2: Dikemas -->
                <div class="timeline-step ${step2Completed ? 'completed' : (step2Active ? 'active' : '')}">
                    <div class="timeline-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                    </div>
                    <div class="timeline-content">
                        <h4>Dikemas</h4>
                        <p>Gelang INNOBAND Anda sedang diukir dan dikemas.</p>
                    </div>
                </div>
                
                <!-- Step 3: Dalam Perjalanan -->
                <div class="timeline-step ${step3Completed ? 'completed' : (step3Active ? 'active' : '')}">
                    <div class="timeline-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                    </div>
                    <div class="timeline-content">
                        <h4>Dalam Perjalanan</h4>
                        <p>Paket telah diserahkan ke kurir logistik.</p>
                    </div>
                </div>

                <!-- Step 4: Paket Sudah Sampai -->
                <div class="timeline-step ${step4Completed ? 'completed' : (step4Active ? 'active' : '')}">
                    <div class="timeline-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    </div>
                    <div class="timeline-content">
                        <h4>Paket Sudah Sampai</h4>
                        <p>Pesanan telah tiba di alamat tujuan.</p>
                    </div>
                </div>
            </div>`;
        }

        return `
        <div class="tracking-card">
            <div class="tracking-map-container">
                <iframe src="${mapUrl}" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
            </div>
            
            <div class="tracking-details">
                <div class="tracking-info">
                    <div class="tracking-header">
                        <div>
                            <div class="tracking-id">${orderId}</div>
                            <div class="tracking-product">${order.productName}</div>
                        </div>
                        ${badgeHtml}
                    </div>
                    
                    <div class="tracking-meta">
                        <div class="tracking-meta-row">
                            <span style="color: var(--gray-text);">Penerima:</span>
                            <span style="font-weight: 600;">${order.shipping && order.shipping.recipient ? order.shipping.recipient : order.profileName}</span>
                        </div>
                        <div class="tracking-meta-row">
                            <span style="color: var(--gray-text);">Warna:</span>
                            <span style="font-weight: 600;">${order.color}</span>
                        </div>
                        <div class="tracking-meta-row">
                            <span style="color: var(--gray-text);">Grafik Nama:</span>
                            <span style="font-weight: 600;">${order.customName || '-'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="tracking-timeline">
                    ${timelineHtml}
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function renderOrderHistory() {
    var orders = state.orders; // Read from Firebase state
    var noOrderState = document.getElementById('noOrderState');
    var orderListState = document.getElementById('orderListState');
    var ordersGrid = document.getElementById('ordersGrid');
    var orderBanner = document.getElementById('orderBanner');
    var orderSteps = document.getElementById('orderSteps');

    if (!noOrderState || !orderListState || !ordersGrid) return;

    // Only update display styles if we are NOT currently in the order flow
    var inOrderFlow = state.orderProduct !== null;

    if (!inOrderFlow) {
        // Ensure order flow is hidden when showing history
        if (orderBanner) orderBanner.style.display = 'none';
        if (orderSteps) orderSteps.style.display = 'none';

        if (orders.length === 0) {
            noOrderState.style.display = 'block';
            orderListState.style.display = 'none';
        } else {
            noOrderState.style.display = 'none';
            orderListState.style.display = 'block';
        }
    }

    // Always render the grid HTML regardless of visibility
    if (orders.length > 0) {

        // Reverse to show newest first
        var sortedOrders = orders.slice();

        ordersGrid.innerHTML = sortedOrders.map(function (order) {
            var orderId = order.id.replace('order_', 'ORD-').toUpperCase();
            var date = new Date(order.createdAt).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric'
            });

            return '<div class="profile-card" style="display: flex; flex-direction: column;">' +
                '<div class="profile-card-header">' +
                '<div class="profile-card-avatar" style="background: var(--primary); color: white;">' +
                '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="3" ry="3"></rect><path d="M16 7V5a4 4 0 0 0-8 0v2"></path></svg>' +
                '</div>' +
                '<div>' +
                '<div class="profile-card-name">' + escapeHtml(order.productName) + '</div>' +
                '<div class="profile-card-badge">' + orderId + '</div>' +
                '</div>' +
                '</div>' +
                '<div class="profile-card-info" style="flex-grow: 1;">' +
                '<div class="profile-info-row">' +
                '<span class="profile-info-label" style="width: 80px;">Tanggal</span>' +
                '<span class="profile-info-value">' + date + '</span>' +
                '</div>' +
                '<div class="profile-info-row">' +
                '<span class="profile-info-label" style="width: 80px;">Penerima</span>' +
                '<span class="profile-info-value">' + escapeHtml(order.profileName) + '</span>' +
                '</div>' +
                '<div class="profile-info-row">' +
                '<span class="profile-info-label" style="width: 80px;">Warna</span>' +
                '<span class="profile-info-value">' + escapeHtml(order.color) + '</span>' +
                '</div>' +
                '<div class="profile-info-row">' +
                '<span class="profile-info-label" style="width: 80px;">Total</span>' +
                '<span class="profile-info-value" style="font-weight: 600; color: var(--primary);">' + escapeHtml(order.price) + '</span>' +
                '</div>' +
                '</div>' +
                '<div class="profile-card-actions" style="margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 1rem;">' +
                '<button class="btn-secondary btn-sm" style="width: 100%; justify-content: center;" onclick="switchToTab(\'lacak\')">Lacak Pesanan</button>' +
                '</div>' +
                '</div>';
        }).join('');
    }
}

/* ============================================================
   ORDER FLOW
   ============================================================ */

/** Show order flow with selected product */
function showOrderFlow(productKey) {
    var product = PRODUCTS[productKey];
    if (!product) return;

    // Show banner & steps, hide empty state and order history
    document.getElementById('orderBanner').style.display = 'flex';
    document.getElementById('orderSteps').style.display = 'flex';
    document.getElementById('noOrderState').style.display = 'none';

    var orderListState = document.getElementById('orderListState');
    if (orderListState) orderListState.style.display = 'none';

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

    var user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
    var isCompany = user.type === 'perusahaan';

    var html = '';

    if (isCompany && profiles.length > 1) {
        var isSelectedAll = state.selectedProfileId === 'ALL';
        html += '<div class="profile-select-card' + (isSelectedAll ? ' selected' : '') + '" onclick="selectProfile(\'ALL\')" style="border: 2px solid var(--primary); background: rgba(44, 255, 110, 0.05);">' +
            '<div class="profile-select-name"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: text-bottom;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg> Pesan Untuk Semua Data (' + profiles.length + ' profil)</div>' +
            '<div class="profile-select-detail">Buat pesanan untuk seluruh pengguna sekaligus (warna akan sama untuk semua).</div>' +
            '</div>';
    }

    html += profiles.map(function (p) {
        var isSelected = state.selectedProfileId === p.id;
        return '<div class="profile-select-card' + (isSelected ? ' selected' : '') + '" onclick="selectProfile(\'' + p.id + '\')">' +
            '<div class="profile-select-name">' + escapeHtml(p.name) + '</div>' +
            '<div class="profile-select-detail">' + escapeHtml(p.phone) + (p.blood ? ' <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-top: -2px;"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"></path></svg> Gol. ' + escapeHtml(p.blood) : '') + '</div>' +
            '<div class="profile-select-detail" style="margin-top: 4px;">Darurat: ' + escapeHtml(p.emergencyName) + '</div>' +
            '</div>';
    }).join('');

    grid.innerHTML = html;

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

    // Validate shipping form before proceeding to summary (Step 4)
    if (stepNum === 4) {
        var recipient = document.getElementById('shipRecipient').value.trim();
        var phone = document.getElementById('shipPhone').value.trim();
        var address = document.getElementById('shipAddress').value.trim();
        var city = document.getElementById('shipCity').value.trim();
        if (!recipient || !phone || !address || !city) {
            showToast('Perhatian', 'Lengkapi nama penerima, telepon, alamat, dan kota terlebih dahulu.');
            return;
        }
        populateSummary();
    }

    state.currentStep = stepNum;
    showStep(stepNum);
}

/** Show specific step, hide others */
function showStep(num) {
    for (var i = 1; i <= 4; i++) {
        var stepEl = document.getElementById('orderStep' + i);
        if (!stepEl) continue;
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

    if (num === 2) {
        var customNameGroup = document.getElementById('customNameGroup');
        if (customNameGroup) {
            customNameGroup.style.display = state.selectedProfileId === 'ALL' ? 'none' : 'flex';
        }
    }
}

/** Payment Modal Functions */
window.openPaymentModal = function () {
    initPaymentStep();
    var modal = document.getElementById('modalPayment');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(function () { modal.classList.add('show'); }, 10);
    }
};

window.closePaymentModal = function () {
    var modal = document.getElementById('modalPayment');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(function () { modal.style.display = 'none'; }, 300);
    }
};

/** Populate order summary (Step 5) */
function populateSummary() {
    var product = PRODUCTS[state.orderProduct];
    var profiles = getProfiles();

    var profileText = '';
    var customNameText = '';
    var totalText = '-';

    if (state.selectedProfileId === 'ALL') {
        profileText = 'Semua Pengguna (' + profiles.length + ' profil)';
        customNameText = '(Tidak tersedia untuk pesanan massal)';
        if (product) {
            var rawPrice = product.priceNum;
            var total = rawPrice * profiles.length;
            totalText = 'Rp ' + total.toLocaleString('id-ID');
        }
    } else {
        var selectedProfile = profiles.find(function (p) { return p.id === state.selectedProfileId; });
        profileText = selectedProfile ? selectedProfile.name : '-';
        customNameText = document.getElementById('customName').value.trim() || '(Tidak ada)';
        totalText = product ? product.price : '-';
    }

    var recipient = document.getElementById('shipRecipient').value.trim();
    var phone = document.getElementById('shipPhone').value.trim();
    var address = document.getElementById('shipAddress').value.trim();
    var city = document.getElementById('shipCity').value.trim();
    var postal = document.getElementById('shipPostal').value.trim();
    var addressFull = address + (city ? ', ' + city : '') + (postal ? ' ' + postal : '');

    document.getElementById('summaryProduct').textContent = product ? product.name : '-';
    document.getElementById('summaryProfile').textContent = profileText;
    document.getElementById('summaryColor').textContent = state.selectedColor;
    document.getElementById('summaryName').textContent = customNameText;
    document.getElementById('summaryRecipient').textContent = recipient + ' (' + phone + ')';
    document.getElementById('summaryAddress').textContent = addressFull;
    document.getElementById('summaryTotal').textContent = totalText;
}

/** Initialize Payment Step (Step 4) */
function initPaymentStep() {
    // Update Total Amount
    var product = PRODUCTS[state.orderProduct];
    var profiles = getProfiles();
    if (product) {
        var totalText = '-';
        if (state.selectedProfileId === 'ALL') {
            var rawPrice = product.priceNum;
            var total = rawPrice * profiles.length;
            totalText = 'Rp ' + total.toLocaleString('id-ID');
        } else {
            totalText = product.price;
        }
        document.getElementById('paymentTotalAmount').textContent = totalText;
        document.getElementById('vaTotal').textContent = totalText;
    }

    // Generate QRIS if not generated yet
    var qrisBox = document.getElementById('qrisCodeBox');
    if (qrisBox && qrisBox.innerHTML === '') {
        if (typeof QRCode !== 'undefined') {
            new QRCode(qrisBox, {
                text: "00020101021126570011ID.CO.QRIS.WWW01189360091531234567890214INNOBAND INDO0303UMI51440014ID.CO.QRIS.WWW0215ID12345678901230303UMI52045499530336054061500005802ID5918INNOBAND INDONESIA6007JAKARTA61051234562070703A016304A1B2", // Dummy QRIS string
                width: 220,
                height: 220,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
        }
    }
}

/** Switch Payment Method Tabs */
window.switchPayTab = function (method) {
    state.paymentMethod = method;

    // Update Tabs
    document.getElementById('tabQRIS').classList.toggle('active', method === 'qris');
    document.getElementById('tabVA').classList.toggle('active', method === 'va');

    // Update Panels
    document.getElementById('panelQRIS').style.display = method === 'qris' ? 'block' : 'none';
    document.getElementById('panelVA').style.display = method === 'va' ? 'block' : 'none';
};

/** Copy Virtual Account Number */
window.copyVA = function () {
    var vaNumber = document.getElementById('vaNumber').textContent;
    navigator.clipboard.writeText(vaNumber).then(function () {
        showToast('Berhasil', 'Nomor Virtual Account disalin ke clipboard');
    });
};

/** Handle Proof Upload */
window.handleProofUpload = function (event) {
    var file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        showToast('Error', 'Ukuran file maksimal 5MB');
        return;
    }

    state.paymentProofFile = file;

    var reader = new FileReader();
    reader.onload = function (e) {
        var content = document.getElementById('proofUploadContent');
        var preview = document.getElementById('proofPreview');
        var filename = document.getElementById('proofFilename');

        if (file.type.startsWith('image/')) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            content.style.display = 'none';
        } else {
            preview.style.display = 'none';
            content.style.display = 'flex';
            content.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--green);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg><p style="margin-top:0.5rem;font-weight:600;">File PDF Dipilih</p>';
        }

        filename.textContent = file.name;
        filename.style.display = 'block';
        document.getElementById('proofUploadZone').classList.add('has-file');
    };
    reader.readAsDataURL(file);
};

/** Confirm order with Firebase */
async function confirmOrder() {
    if (!state.paymentProofFile) {
        showToast('Perhatian', 'Upload bukti pembayaran terlebih dahulu.');
        return;
    }

    var product = PRODUCTS[state.orderProduct];
    var profiles = getProfiles();
    var user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
    var customName = document.getElementById('customName').value.trim();

    // Shipping Data
    var shippingData = {
        recipient: document.getElementById('shipRecipient').value.trim(),
        phone: document.getElementById('shipPhone').value.trim(),
        address: document.getElementById('shipAddress').value.trim(),
        city: document.getElementById('shipCity').value.trim(),
        postal: document.getElementById('shipPostal').value.trim(),
        note: document.getElementById('shipNote').value.trim()
    };

    if (typeof window.dbSaveOrder !== 'function') {
        alert('Layanan Database belum siap.');
        return;
    }

    var btn = document.querySelector('.order-confirm-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }

    try {
        var savedOrderId = null;
        if (state.selectedProfileId === 'ALL') {
            // Bulk order creation - Single order entry
            var rawPrice = product ? product.priceNum : 0;
            var total = rawPrice * profiles.length;
            var totalFormatted = 'Rp ' + total.toLocaleString('id-ID');

            var order = {
                product: state.orderProduct,
                productName: product ? product.name : '',
                profileId: 'BULK',
                profileName: 'Pesanan Massal (' + profiles.length + ' data)',
                color: state.selectedColor,
                customName: '-', // Blank for mass order
                price: totalFormatted,
                isBulk: true,
                quantity: profiles.length,
                shipping: shippingData,
                paymentMethod: state.paymentMethod,
                paymentProof: state.paymentProofFile ? state.paymentProofFile.name : null
            };
            savedOrderId = await window.dbSaveOrder(order, user.email);
        } else {
            // Single order creation
            var selectedProfile = profiles.find(function (p) { return p.id === state.selectedProfileId; });
            var order = {
                product: state.orderProduct,
                productName: product ? product.name : '',
                profileId: state.selectedProfileId,
                profileName: selectedProfile ? selectedProfile.name : '',
                color: state.selectedColor,
                customName: customName,
                price: product ? product.price : '',
                shipping: shippingData,
                paymentMethod: state.paymentMethod,
                paymentProof: state.paymentProofFile ? state.paymentProofFile.name : null
            };
            savedOrderId = await window.dbSaveOrder(order, user.email);
        }

        // --- KIRIM NOTIFIKASI KE TELEGRAM ---
        if (TELEGRAM_BOT_TOKEN && TELEGRAM_BOT_TOKEN !== 'ISI_BOT_TOKEN_DI_SINI') {
            try {
                var formData = new FormData();
                formData.append('chat_id', TELEGRAM_CHAT_ID);

                var qty = state.selectedProfileId === 'ALL' ? profiles.length : 1;
                var caption = "🔔 <b>PESANAN BARU (MENUNGGU ACC)</b>\n" +
                    "━━━━━━━━━━━━━━━━━━━━\n" +
                    "<b>ID Pesanan:</b> <code>" + savedOrderId + "</code>\n" +
                    "<b>Pemesan:</b> " + (user.name || '-') + "\n" +
                    "<b>Email:</b> " + (user.email || 'Guest') + "\n" +
                    "<b>No. HP:</b> " + (user.phone || '-') + "\n\n" +
                    "📦 <b>Rincian Produk:</b>\n" +
                    "• Jumlah Pesanan: " + qty + " pcs\n" +
                    "• Nama Produk: " + order.productName + "\n" +
                    "• Warna: " + order.color + "\n" +
                    "• Custom Nama: " + (order.customName || '-') + "\n" +
                    "• Total Tagihan: <b>" + order.price + "</b>\n\n" +
                    "🚚 <b>Data Pengiriman:</b>\n" +
                    "• Penerima: " + shippingData.recipient + "\n" +
                    "• No. Telp: " + shippingData.phone + "\n" +
                    "• Kota: " + shippingData.city + "\n" +
                    "• Alamat Lengkap:\n" + shippingData.address + "\n\n" +
                    "⚠️ <i>Silakan cek gambar bukti transfer di atas sebelum menekan ACC.</i>";

                var inlineKeyboard = {
                    inline_keyboard: [[
                        { text: "✅ ACC", callback_data: "acc_" + savedOrderId },
                        { text: "❌ Tolak", callback_data: "rej_" + savedOrderId }
                    ]]
                };

                formData.append('reply_markup', JSON.stringify(inlineKeyboard));

                if (state.paymentProofFile) {
                    formData.append('caption', caption);
                    formData.append('parse_mode', 'HTML');
                    formData.append('photo', state.paymentProofFile);
                    await fetch('https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendPhoto', {
                        method: 'POST',
                        body: formData
                    });
                } else {
                    formData.append('text', caption);
                    formData.append('parse_mode', 'HTML');
                    await fetch('https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage', {
                        method: 'POST',
                        body: formData
                    });
                }
            } catch (err) {
                console.error("Gagal mengirim ke Telegram:", err);
            }
        }

        // Clear URL params
        localStorage.removeItem(STORAGE_KEYS.ORDER);

        // Show real-time order status popup
        closePaymentModal();
        openOrderStatus(order, savedOrderId);

        // Reload orders in background
        loadOrdersFromDb().then(function () {
            renderTracking();
            renderOrderHistory();
        });
    } catch (err) {
        alert('Gagal membuat pesanan: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Konfirmasi Pesanan';
        }
    }
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

    // Switch to pesanan saya tab
    switchToTab('pesan');

    // Reset order panel
    document.getElementById('orderBanner').style.display = 'none';
    document.getElementById('orderSteps').style.display = 'none';
    renderOrderHistory();
}

/* ============================================================
   QR CODE GENERATION
   ============================================================ */

var _currentQRProfile = null; // profile shown in QR modal

/**
 * Build the text content that will be encoded in the QR code.
 * Format is human-readable so any phone scanner can display it.
 */
function buildQRContent(profile) {
    // Generate URL dynamically based on current domain
    var baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    var sosUrl = baseUrl + 'sos.html?id=' + profile.id;
    return sosUrl;
}

/** Generate mini QR codes for all rendered profile cards */
function initAllQRCodes(profiles) {
    if (typeof QRCode === 'undefined') return; // library not yet loaded
    profiles.forEach(function (p) {
        var container = document.getElementById('qr-mini-' + p.id);
        if (!container || container.querySelector('canvas,img')) return; // already generated
        try {
            new QRCode(container, {
                text: buildQRContent(p),
                width: 72,
                height: 72,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
        } catch (e) {
            console.warn('QR generation failed for', p.id, e);
        }
    });
}

var _currentSosProfileId = null;

/** Show the SOS Alert Details Modal */
window.showSosModal = function (profileId) {
    var profile = state.profiles.find(function (p) { return p.id === profileId; });
    if (!profile) return;

    _currentSosProfileId = profileId;

    // Format timestamp
    var alertTimeStr = "-";
    if (profile.alertTime) {
        var d;
        // Check if it's a Firestore Timestamp with toDate function
        if (typeof profile.alertTime.toDate === 'function') {
            d = profile.alertTime.toDate();
        } else {
            d = new Date(profile.alertTime);
        }
        if (!isNaN(d)) {
            alertTimeStr = d.toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
        }
    }
    document.getElementById('sosAlertTime').textContent = alertTimeStr;

    // Set Maps link and Iframe
    var mapsLinkBtn = document.getElementById('sosAlertMaps');
    var mapContainer = document.getElementById('sosMapContainer');

    if (profile.alertMapsLink) {
        mapsLinkBtn.href = profile.alertMapsLink;
        mapsLinkBtn.style.display = 'inline-flex';

        // Coba ekstrak koordinat (lat,lng) dari link maps
        var match = profile.alertMapsLink.match(/query=([^&]+)/);
        if (match && match[1]) {
            var coords = match[1];
            mapContainer.innerHTML = '<iframe width="100%" height="100%" frameborder="0" style="border:0" src="https://maps.google.com/maps?q=' + coords + '&hl=id&z=15&output=embed" allowfullscreen></iframe>';
            mapContainer.style.display = 'block';
        } else {
            mapContainer.innerHTML = '';
            mapContainer.style.display = 'none';
        }
    } else {
        mapsLinkBtn.style.display = 'none';
        mapContainer.innerHTML = '';
        mapContainer.style.display = 'none';
    }

    document.getElementById('modalSos').style.display = 'flex';
};

window.closeSosModal = function () {
    document.getElementById('modalSos').style.display = 'none';
    _currentSosProfileId = null;
};

window.resolveSosAlert = async function () {
    if (!_currentSosProfileId) return;

    // Nonaktifkan sementara
    document.body.style.cursor = 'wait';
    try {
        var profile = state.profiles.find(function (p) { return p.id === _currentSosProfileId; });
        if (profile) {
            profile.isAlert = false;
            // update in Firebase
            var user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
            await window.dbSaveProfile(profile, user.email);

            closeSosModal();
            renderProfiles();
            showToast("Peringatan telah diselesaikan.");
        }
    } catch (err) {
        console.error(err);
        showToast("Gagal menyelesaikan peringatan.", true);
    }
    document.body.style.cursor = 'default';
};

/** Show the full-size QR code modal for a profile */
window.showQRModal = function (profileId) {
    var profile = state.profiles.find(function (p) { return p.id === profileId; });
    if (!profile) return;

    _currentQRProfile = profile;

    // Update modal header
    var initials = profile.name ? profile.name.split(' ').map(function (w) { return w.charAt(0); }).join('').substring(0, 2).toUpperCase() : '?';
    document.getElementById('qrModalAvatar').textContent = initials;
    document.getElementById('qrModalName').textContent = profile.name || '-';
    document.getElementById('qrModalSub').textContent = profile.blood ? 'Gol. Darah ' + profile.blood + ' · QR Code Gelang INNOBAND' : 'QR Code Gelang INNOBAND';

    // Render info summary
    var info = document.getElementById('qrModalInfo');
    info.innerHTML =
        '<div class="qr-info-row"><span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; margin-top:-2px;"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> Telepon</span><span>' + escapeHtml(profile.phone) + '</span></div>' +
        (profile.allergy ? '<div class="qr-info-row"><span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; margin-top:-2px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> Alergi</span><span>' + escapeHtml(profile.allergy) + '</span></div>' : '') +
        '<div class="qr-info-row"><span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; margin-top:-2px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Darurat</span><span>' + escapeHtml(profile.emergencyName) + ' — ' + escapeHtml(profile.emergencyPhone) + '</span></div>';

    // Clear previous QR and generate new one at full size
    var canvas = document.getElementById('qrModalCanvas');
    canvas.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
        new QRCode(canvas, {
            text: buildQRContent(profile),
            width: 240,
            height: 240,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });
    }

    document.getElementById('qrModal').classList.add('open');
    document.body.style.overflow = 'hidden';
};

/** Close QR modal */
window.closeQRModal = function () {
    document.getElementById('qrModal').classList.remove('open');
    document.body.style.overflow = '';
    _currentQRProfile = null;
};

/** Download the QR code shown in the modal as a PNG */
window.downloadCurrentQR = function () {
    if (!_currentQRProfile) return;
    var canvas = document.querySelector('#qrModalCanvas canvas');
    if (!canvas) {
        var img = document.querySelector('#qrModalCanvas img');
        if (!img) return;
        // Convert img src to canvas
        var tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = 240;
        tmpCanvas.height = 240;
        var ctx = tmpCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 240, 240);
        downloadCanvas(tmpCanvas);
        return;
    }
    downloadCanvas(canvas);
};

function downloadCanvas(canvas) {
    var link = document.createElement('a');
    var safeName = (_currentQRProfile.name || 'profile').replace(/\s+/g, '_').toLowerCase();
    link.download = 'innoband_qr_' + safeName + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
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

document.getElementById('qrModal').addEventListener('click', function (e) {
    if (e.target === this) {
        closeQRModal();
    }
});

/* Close modal on Escape key */
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeProfileModal();
        closeUploadModal();
        closeQRModal();
        var successOverlay = document.getElementById('orderSuccessOverlay');
        if (successOverlay.classList.contains('open')) {
            closeOrderSuccess();
        }
    }
});

/* ============================================================
   BULK UPLOAD (Company Accounts)
   ============================================================ */

var uploadedRows = []; // holds parsed & validated rows

/** Open the upload modal */
window.openUploadModal = function () {
    clearUpload();
    document.getElementById('uploadModal').classList.add('open');
    document.body.style.overflow = 'hidden';
};

/** Close the upload modal */
window.closeUploadModal = function () {
    document.getElementById('uploadModal').classList.remove('open');
    document.body.style.overflow = '';
    clearUpload();
};

/** Reset upload state */
window.clearUpload = function () {
    uploadedRows = [];
    document.getElementById('uploadFileInput').value = '';
    document.getElementById('uploadFileInfo').style.display = 'none';
    document.getElementById('uploadPreviewContainer').style.display = 'none';
    document.getElementById('uploadErrors').style.display = 'none';
    document.getElementById('uploadErrors').innerHTML = '';
    document.getElementById('uploadPreviewBody').innerHTML = '';
    document.getElementById('btnSaveUpload').disabled = true;
};

/** Download a blank CSV template */
window.downloadCSVTemplate = function () {
    var user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
    var isCompany = user.type === 'perusahaan';

    var header = 'nama_lengkap,no_telepon,golongan_darah,alamat,alergi,kontak_darurat_nama,kontak_darurat_telepon';
    var example = 'Budi Santoso,08123456789,A,Jl. Merdeka No.1 Jakarta,Tidak ada,Siti Santoso,08198765432';

    if (isCompany) {
        header += ',id_registrasi,keperluan,nomor_gate,no_punggung';
        example += ',TKT-123,konser,Gate 1,';
    }

    var csvContent = header + '\n' + example + '\n';
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'TamplateAktifasiINNOBAND.csv';
    link.click();
};

/** Drag-and-drop handlers */
window.handleDragOver = function (e) {
    e.preventDefault();
    document.getElementById('uploadDropzone').classList.add('drag-over');
};
window.handleDragLeave = function () {
    document.getElementById('uploadDropzone').classList.remove('drag-over');
};
window.handleDrop = function (e) {
    e.preventDefault();
    document.getElementById('uploadDropzone').classList.remove('drag-over');
    var files = e.dataTransfer.files;
    if (files.length > 0) processFile(files[0]);
};
window.handleFileSelect = function (e) {
    if (e.target.files.length > 0) processFile(e.target.files[0]);
};

/** Process selected file (CSV or Excel) */
function processFile(file) {
    var ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
        showUploadError('Format file tidak didukung. Gunakan .csv, .xlsx, atau .xls');
        return;
    }

    var reader = new FileReader();

    if (ext === 'csv') {
        reader.onload = function (e) {
            var rows = parseCSV(e.target.result);
            validateAndPreview(rows, file.name);
        };
        reader.readAsText(file);
    } else {
        // Excel — uses SheetJS (loaded via CDN)
        reader.onload = function (e) {
            try {
                var data = new Uint8Array(e.target.result);
                var workbook = XLSX.read(data, { type: 'array' });
                var sheet = workbook.Sheets[workbook.SheetNames[0]];
                var json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                // Normalise headers
                var rows = json.map(function (row) {
                    return normaliseRow(row);
                });
                validateAndPreview(rows, file.name);
            } catch (err) {
                showUploadError('Gagal membaca file Excel: ' + err.message);
            }
        };
        reader.readAsArrayBuffer(file);
    }
}

/** Parse CSV text into array of objects */
function parseCSV(text) {
    var lines = text.replace(/\r/g, '').split('\n').filter(function (l) { return l.trim() !== ''; });
    if (lines.length < 2) return [];

    var headers = lines[0].split(',').map(function (h) { return h.trim().toLowerCase().replace(/\s+/g, '_'); });
    return lines.slice(1).map(function (line) {
        var values = parseCSVLine(line);
        var obj = {};
        headers.forEach(function (h, i) { obj[h] = (values[i] || '').trim(); });
        return normaliseRow(obj);
    });
}

/** Safely split a CSV line respecting quoted fields */
function parseCSVLine(line) {
    var result = [];
    var current = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
        var c = line[i];
        if (c === '"') {
            inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += c;
        }
    }
    result.push(current);
    return result;
}

/** Normalise various column name spellings into our standard keys */
function normaliseRow(row) {
    function pick(obj, keys) {
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i].toLowerCase().replace(/\s+/g, '_');
            if (obj[k] !== undefined && obj[k] !== '') return String(obj[k]);
            // Also try original casing
            var origKeys = Object.keys(obj);
            for (var j = 0; j < origKeys.length; j++) {
                if (origKeys[j].toLowerCase().replace(/\s+/g, '_') === k) return String(obj[origKeys[j]]);
            }
        }
        return '';
    }
    return {
        name: pick(row, ['nama_lengkap', 'nama', 'name', 'full_name']),
        phone: pick(row, ['no_telepon', 'telepon', 'no_hp', 'phone', 'hp']),
        blood: pick(row, ['golongan_darah', 'gol_darah', 'blood', 'blood_type']),
        address: pick(row, ['alamat', 'address']),
        allergy: pick(row, ['alergi', 'kondisi_medis', 'allergy']),
        emergencyName: pick(row, ['kontak_darurat_nama', 'nama_darurat', 'emergency_name']),
        emergencyPhone: pick(row, ['kontak_darurat_telepon', 'telp_darurat', 'emergency_phone', 'emergency_tel']),
        registrationId: pick(row, ['id_registrasi', 'registration_id', 'id_regis', 'id_peserta']),
        eventPurpose: pick(row, ['keperluan', 'event_purpose', 'purpose', 'tujuan', 'jenis_event']),
        eventGate: pick(row, ['nomor_gate', 'gate', 'event_gate']),
        eventNumber: pick(row, ['no_punggung', 'no_peserta', 'nomor_peserta', 'event_number'])
    };
}

/** Validate parsed rows and show preview table */
function validateAndPreview(rows, fileName) {
    if (rows.length === 0) {
        showUploadError('File kosong atau tidak dapat dibaca. Pastikan menggunakan template yang benar.');
        return;
    }
    if (rows.length > 500) {
        showUploadError('Maks. 500 baris per upload. File ini memiliki ' + rows.length + ' baris.');
        return;
    }

    var valid = [];
    var errors = [];

    rows.forEach(function (row, idx) {
        var rowNum = idx + 2; // +2 because row 1 = header
        var rowErrors = [];
        if (!row.name) rowErrors.push('Nama wajib diisi');
        if (!row.phone) rowErrors.push('No. Telepon wajib diisi');
        if (!row.emergencyName) rowErrors.push('Kontak Darurat wajib diisi');
        if (!row.emergencyPhone) rowErrors.push('Telepon Darurat wajib diisi');

        if (rowErrors.length > 0) {
            errors.push('Baris ' + rowNum + ' (' + (row.name || 'tanpa nama') + '): ' + rowErrors.join(', '));
            row._valid = false;
        } else {
            row._valid = true;
            valid.push(row);
        }
    });

    // Show file info
    document.getElementById('uploadFileInfo').style.display = 'flex';
    document.getElementById('uploadFileName').textContent = fileName;
    document.getElementById('uploadRowCount').textContent = rows.length + ' baris ditemukan';

    // Render preview
    var tbody = document.getElementById('uploadPreviewBody');
    tbody.innerHTML = rows.map(function (row) {
        var statusBadge = row._valid
            ? '<span class="upload-badge upload-badge-ok"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; margin-top:-1px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Valid</span>'
            : '<span class="upload-badge upload-badge-err"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; margin-top:-1px;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Error</span>';
        return '<tr class="' + (row._valid ? '' : 'upload-row-err') + '">' +
            '<td>' + escapeHtml(row.name) + '</td>' +
            '<td>' + escapeHtml(row.phone) + '</td>' +
            '<td>' + escapeHtml(row.blood) + '</td>' +
            '<td>' + escapeHtml(row.address) + '</td>' +
            '<td>' + escapeHtml(row.allergy) + '</td>' +
            '<td>' + escapeHtml(row.emergencyName) + '</td>' +
            '<td>' + escapeHtml(row.emergencyPhone) + '</td>' +
            '<td>' + statusBadge + '</td>' +
            '</tr>';
    }).join('');

    document.getElementById('uploadPreviewContainer').style.display = 'block';
    document.getElementById('uploadPreviewCount').textContent = valid.length + ' valid, ' + (rows.length - valid.length) + ' error';

    // Show errors
    var errEl = document.getElementById('uploadErrors');
    if (errors.length > 0) {
        errEl.innerHTML = '<strong>⚠ Baris berikut memiliki masalah dan akan dilewati:</strong><ul>' +
            errors.map(function (e) { return '<li>' + escapeHtml(e) + '</li>'; }).join('') + '</ul>';
        errEl.style.display = 'block';
    } else {
        errEl.style.display = 'none';
    }

    uploadedRows = valid;
    document.getElementById('btnSaveUpload').disabled = valid.length === 0;
}

function showUploadError(msg) {
    clearUpload();
    var errEl = document.getElementById('uploadErrors');
    errEl.innerHTML = '<strong><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; margin-top:-2px;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> ' + escapeHtml(msg) + '</strong>';
    errEl.style.display = 'block';
}

/** Save all valid rows to Firestore */
window.saveBulkProfiles = async function () {
    if (uploadedRows.length === 0) return;

    var user = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
    if (!user.email) { alert('Sesi habis. Silakan login ulang.'); return; }

    var btn = document.getElementById('btnSaveUpload');
    btn.disabled = true;
    btn.textContent = 'Menyimpan... (0/' + uploadedRows.length + ')';

    var saved = 0;
    var failed = 0;

    for (var i = 0; i < uploadedRows.length; i++) {
        try {
            await window.dbSaveProfile(uploadedRows[i], user.email);
            saved++;
            btn.textContent = 'Menyimpan... (' + saved + '/' + uploadedRows.length + ')';
        } catch (err) {
            console.error('Failed to save row', i, err);
            failed++;
        }
    }

    closeUploadModal();

    // Reload profiles
    loadProfilesFromDb().then(function () {
        renderProfiles();
        showToast(saved + ' data berhasil disimpan' + (failed > 0 ? ', ' + failed + ' gagal.' : '.'));
    });
};


/** Open and track real-time order status popup */
window.openOrderStatus = function (order, orderId) {
    var modal = document.getElementById("modalOrderStatus");
    if (!modal) return;

    // Set initial data
    document.getElementById("statusOrderId").textContent = orderId;

    var dateObj = new Date();
    var options = { hour: "2-digit", minute: "2-digit", year: "numeric", month: "long", day: "numeric" };
    document.getElementById("statusOrderTime").textContent = dateObj.toLocaleDateString("id-ID", options);

    document.getElementById("statusOrderMethod").textContent = order.paymentMethod === "qris" ? "QRIS" : "Bank Transfer";
    document.getElementById("statusOrderAmount").textContent = order.price;
    document.getElementById("statusOrderProduct").textContent = order.productName;
    document.getElementById("statusOrderQty").textContent = "x" + (order.quantity || 1);
    document.getElementById("statusOrderPrice").textContent = order.price;
    document.getElementById("statusOrderTotal").textContent = order.price;

    modal.style.display = "flex";

    // Setup listener
    if (typeof window.dbListenOrder === "function") {
        window.dbListenOrder(orderId, function (updatedOrder) {
            var badge = document.getElementById("statusOrderBadge");
            var title = document.getElementById("statusTitle");
            var iconSvg = document.getElementById("statusIcon");

            if (updatedOrder.status === "approved" || updatedOrder.status === "processing") {
                badge.className = "badge-success";
                badge.textContent = "Berhasil";
                title.textContent = "Pembayaran Berhasil Dikonfirmasi";
                iconSvg.innerHTML = `<rect x="8" y="14" width="42" height="46" rx="4" fill="none" stroke="#3A3AB8" stroke-width="2.5"/><rect x="14" y="20" width="42" height="46" rx="4" fill="white" stroke="#3A3AB8" stroke-width="2.5"/><line x1="22" y1="34" x2="46" y2="34" stroke="#3A3AB8" stroke-width="2" stroke-linecap="round"/><line x1="22" y1="41" x2="38" y2="41" stroke="#3A3AB8" stroke-width="2" stroke-linecap="round"/><circle cx="50" cy="50" r="12" fill="#5ECC6F"/><polyline points="44,50 49,55 57,45" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
            } else if (updatedOrder.status === "rejected") {
                badge.className = "badge-rejected";
                badge.textContent = "Ditolak";
                title.textContent = "Pembayaran Ditolak Admin";
                iconSvg.innerHTML = `<circle cx="35" cy="35" r="30" fill="none" stroke="#E74C3C" stroke-width="2.5"/><line x1="25" y1="25" x2="45" y2="45" stroke="#E74C3C" stroke-width="3" stroke-linecap="round"/><line x1="45" y1="25" x2="25" y2="45" stroke="#E74C3C" stroke-width="3" stroke-linecap="round"/>`;
            } else {
                badge.className = "badge-pending";
                badge.textContent = "Menunggu";
                title.textContent = "Menunggu Konfirmasi Pembayaran oleh Admin";
                iconSvg.innerHTML = `<rect x="8" y="14" width="42" height="46" rx="4" fill="none" stroke="#F5A623" stroke-width="2.5"/><rect x="14" y="20" width="42" height="46" rx="4" fill="white" stroke="#F5A623" stroke-width="2.5"/><line x1="22" y1="34" x2="46" y2="34" stroke="#F5A623" stroke-width="2" stroke-linecap="round"/><line x1="22" y1="41" x2="38" y2="41" stroke="#F5A623" stroke-width="2" stroke-linecap="round"/><circle cx="50" cy="50" r="12" fill="#F5A623"/><circle cx="50" cy="50" r="2" fill="white"/><circle cx="45" cy="50" r="2" fill="white"/><circle cx="55" cy="50" r="2" fill="white"/>`;
            }
        });
    }
};

window.closeOrderStatus = function () {
    var modal = document.getElementById("modalOrderStatus");
    if (modal) modal.style.display = "none";

    // Close payment modal if it was open
    var payModal = document.getElementById("modalPayment");
    if (payModal) payModal.style.display = "none";

    // Reset order state
    state.orderProduct = null;
    state.selectedProfileId = null;
    state.currentStep = 1;
    var url = window.location.pathname;
    window.history.replaceState({}, "", url);

    showStep(1);

    // Redirect user to tracking tab to see their new order
    if (typeof switchToTab === 'function') {
        switchToTab('lacak');
    }
};

/* User Profile Logic for Client Dashboard */
document.addEventListener('DOMContentLoaded', function () {
    var navProfile = document.querySelector('.client-nav-user');
    var profileModal = document.getElementById('userProfileModal');
    var profileForm = document.getElementById('userProfileForm');
    var closeBtn = document.getElementById('closeUserProfile');
    var delBtn = document.getElementById('btnDeleteAccount');

    if (navProfile && profileModal) {
        navProfile.addEventListener('click', function (e) {
            e.preventDefault();
            var userStr = localStorage.getItem('innoband-user');
            if (userStr) {
                var user = JSON.parse(userStr);
                document.getElementById('profileEmail').value = user.email || '';
                document.getElementById('profileNameModal').value = user.name || '';
                document.getElementById('profilePhone').value = user.phone || '';
                profileModal.style.display = 'flex';
            }
        });
    }

    if (closeBtn && profileModal) {
        closeBtn.addEventListener('click', function (e) {
            e.preventDefault();
            profileModal.style.display = 'none';
        });
    }

    if (profileForm) {
        profileForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var email = document.getElementById('profileEmail').value;
            var name = document.getElementById('profileNameModal').value;
            var phone = document.getElementById('profilePhone').value;

            if (typeof window.dbUpdateUser === 'function') {
                window.dbUpdateUser(email, name, phone).then(function () {
                    var userStr = localStorage.getItem('innoband-user');
                    if (userStr) {
                        var user = JSON.parse(userStr);
                        user.name = name;
                        user.phone = phone;
                        localStorage.setItem('innoband-user', JSON.stringify(user));

                        // Update UI Name in Navbar
                        var navUserName = document.getElementById('navUserName');
                        if (navUserName) navUserName.textContent = name;
                        var navAvatar = document.getElementById('navAvatar');
                        if (navAvatar) navAvatar.textContent = name.charAt(0).toUpperCase();
                    }
                    profileModal.style.display = 'none';
                    if (typeof showToast === 'function') {
                        showToast('Profil berhasil diperbarui!', 'success');
                    } else { alert('Profil berhasil diperbarui!'); }
                }).catch(function (err) {
                    alert('Gagal memperbarui profil: ' + err.message);
                });
            }
        });
    }

    if (delBtn) {
        delBtn.addEventListener('click', function (e) {
            e.preventDefault();
            if (confirm('Apakah Anda yakin ingin menghapus akun? Semua data diri Anda akan hilang secara permanen.')) {
                var email = document.getElementById('profileEmail').value;
                if (typeof window.dbDeleteAccount === 'function') {
                    window.dbDeleteAccount(email).then(function () {
                        localStorage.removeItem('innoband-loggedin');
                        localStorage.removeItem('innoband-user');
                        window.location.href = 'index.html';
                    }).catch(function (err) {
                        alert('Gagal menghapus akun: ' + err.message + '. Anda mungkin perlu logout dan login kembali untuk melakukan aksi ini.');
                    });
                }
            }
        });
    }
});

