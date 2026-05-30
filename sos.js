/**
 * INNOBAND — SOS Feature Script
 * File: sos.js
 * Desc: Handles URL parsing, fetching profile from Firebase,
 *       requesting geolocation, and sending SOS to Telegram.
 */

// Konfigurasi Bot Telegram (Gunakan token dan chat ID yang sama)
const TELEGRAM_BOT_TOKEN = '8887160716:AAGm7f_SqkmjHUt9a-qCR1dDhKjONzmI9LQ'; 
const TELEGRAM_CHAT_ID = '-1003922553114';
const NOMOR_CS_WHATSAPP = '6281234567890'; // Ganti dengan nomor asli nanti

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const profileId = urlParams.get('id');

    const loadingOverlay = document.getElementById('loadingOverlay');
    const profileCard = document.getElementById('profileCard');
    const btnReportSos = document.getElementById('btnReportSos');
    const btnCallCs = document.getElementById('btnCallCs');
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');

    // Set link WA
    btnCallCs.href = `https://wa.me/${NOMOR_CS_WHATSAPP}`;

    if (!profileId) {
        alert("ID Profil tidak valid. Mohon scan barcode dari gelang dengan benar.");
        loadingOverlay.style.display = 'none';
        return;
    }

    // Tunggu sampai firebase-db.js selesai meload fungsi global
    let attempts = 0;
    while (typeof window.dbGetProfileById !== 'function' && attempts < 20) {
        await new Promise(r => setTimeout(r, 200));
        attempts++;
    }

    if (typeof window.dbGetProfileById !== 'function') {
        alert("Gagal memuat layanan database. Silakan muat ulang halaman.");
        loadingOverlay.style.display = 'none';
        return;
    }

    // Ambil Data Profil
    let profileData = null;
    try {
        profileData = await window.dbGetProfileById(profileId);
        loadingOverlay.style.display = 'none';

        if (profileData) {
            profileCard.style.display = 'block';
            document.getElementById('userName').textContent = profileData.name || 'Anonim';
            document.getElementById('userBlood').textContent = profileData.blood || '-';
            document.getElementById('userAllergy').textContent = profileData.allergy || 'Tidak ada';
            document.getElementById('userEmergencyName').textContent = profileData.emergencyName || '-';
            document.getElementById('userEmergencyPhone').textContent = profileData.emergencyPhone || '';
            document.getElementById('userAddress').textContent = profileData.address || '-';
        } else {
            alert("Data profil tidak ditemukan. Mungkin profil sudah dihapus atau pengaturan privasi (Firestore Rules) memblokir akses.");
        }
    } catch (err) {
        loadingOverlay.style.display = 'none';
        console.error(err);
        alert("Terjadi kesalahan saat mengambil data profil: " + err.message);
    }

    // Fungsi Lapor SOS
    btnReportSos.addEventListener('click', async () => {
        if (!profileData) {
            showToast("Data profil kosong, tidak bisa mengirim laporan.", true);
            return;
        }

        btnReportSos.disabled = true;
        btnReportSos.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div> Mengirim...';

        // Minta Lokasi (Geolocation)
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => sendTelegramAlert(position.coords.latitude, position.coords.longitude, profileData),
                (error) => {
                    console.warn("Gagal mendapatkan lokasi:", error);
                    // Tetap kirim peringatan meskipun tanpa lokasi
                    sendTelegramAlert(null, null, profileData);
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            // Browser tidak support
            sendTelegramAlert(null, null, profileData);
        }
    });

    async function sendTelegramAlert(lat, lng, data) {
        let mapsLink = "Lokasi tidak diizinkan oleh perangkat penemu.";
        if (lat && lng) {
            mapsLink = `<a href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}">Lihat Lokasi Penemu di Maps</a>`;
        }

        let message = `🚨 <b>PERINGATAN DARURAT (SOS)</b> 🚨\n\n` +
                      `Gelang INNOBAND atas nama <b>${data.name}</b> telah di-scan!\n\n` +
                      `<b>Data Medis:</b>\n` +
                      `• Golongan Darah: ${data.blood || '-'}\n` +
                      `• Alergi: ${data.allergy || '-'}\n\n` +
                      `<b>Kontak Darurat Keluarga:</b>\n` +
                      `${data.emergencyName || '-'} (${data.emergencyPhone || '-'})\n\n` +
                      `📍 <b>LOKASI PENEMU:</b>\n${mapsLink}\n\n` +
                      `⚠️ <i>Harap CS segera menghubungi kontak darurat atau merespon jika ada telepon masuk!</i>`;

        try {
            let formData = new FormData();
            formData.append('chat_id', TELEGRAM_CHAT_ID);
            formData.append('text', message);
            formData.append('parse_mode', 'HTML');

            let res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                showToast("Sinyal darurat berhasil dikirim ke Admin!", false);
            } else {
                showToast("Gagal mengirim peringatan. Server Telegram error.", true);
            }
        } catch (err) {
            console.error(err);
            showToast("Gagal mengirim peringatan. Periksa koneksi internet.", true);
        }

        // Reset Button
        btnReportSos.disabled = false;
        btnReportSos.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
        </svg> Kirim Laporan Darurat`;
    }

    function showToast(msg, isError) {
        toastMsg.textContent = msg;
        if (isError) {
            toast.classList.add('error');
        } else {
            toast.classList.remove('error');
        }
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }
});
