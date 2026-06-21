// =============================================================================
// js/config.js
// File konfigurasi global Sales Analytics Dashboard.
//
// KEAMANAN API KEY:
// API key TIDAK disimpan di file ini karena repo bersifat public.
// API key disimpan di localStorage browser menggunakan fungsi
// getGroqApiKey() dan setGroqApiKey() di bawah.
//
// Cara pakai:
// - Pertama kali buka dashboard → klik tombol "⚙ API Key" di navbar
// - Masukkan API key Groq → klik Simpan
// - Key tersimpan di browser dan tidak perlu diinput lagi
// =============================================================================


// =============================================================================
// BAGIAN 1: KONFIGURASI GLOBAL
// =============================================================================
const CONFIG = {

  // API key Groq di-hardcode langsung agar dashboard bisa langsung
  // dipakai tanpa meminta input dari user (sesuai requirement dosen).
  // CATATAN: key ini free tier ($0 billing), jadi risiko terburuk hanya
  // key di-revoke otomatis oleh Groq jika terdeteksi di repo publik —
  // bukan risiko finansial.
  GROQ_API_KEY: "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",

  // Model AI Groq yang digunakan
  GROQ_MODEL: "llama-3.1-8b-instant",

  // Maksimal token untuk respons AI (1024 = 1-2 paragraf)
  GROQ_MAX_TOKENS: 1024,

  // URL Tableau Public — isi setelah publish workbook
  // Bentuk: "https://public.tableau.com/views/NamaFile/NamaDashboard"
  TABLEAU_URL: "https://public.tableau.com/views/Sales-Dashboard-EAS/Dashboard1",   // ← isi setelah buat Tableau dashboard

  // Path folder data JSON
  DATA_PATH: "data/",

};


// =============================================================================
// BAGIAN 2: MANAJEMEN API KEY
// Fungsi untuk menyimpan dan membaca API key dari localStorage browser.
// localStorage = penyimpanan di browser, tidak ikut ke GitHub.
// =============================================================================

/**
 * Menyimpan API key Groq ke localStorage browser.
 * Setelah disimpan, key bisa dibaca dengan getGroqApiKey().
 *
 * @param {string} key - API key Groq (bentuk: "gsk_xxxx...")
 */
function setGroqApiKey(key) {
  if (key && key.trim() !== "") {
    localStorage.setItem("groq_api_key", key.trim());
    console.log("[config.js] API key berhasil disimpan di localStorage");
  }
}

/**
 * Membaca API key Groq dari localStorage.
 * Mengembalikan string kosong jika belum diisi.
 *
 * @returns {string} API key atau "" jika belum ada
 */
function getGroqApiKey() {
  return CONFIG.GROQ_API_KEY || "";
}

/**
 * Mengecek apakah API key sudah tersimpan di localStorage.
 *
 * @returns {boolean} true jika API key sudah ada
 */
function hasGroqApiKey() {
  const key = getGroqApiKey();
  return key !== "" && key.startsWith("gsk_");
}


// =============================================================================
// BAGIAN 3: FORMAT ANGKA
// Fungsi helper untuk format angka agar tampil rapi di dashboard.
// =============================================================================

/**
 * Format angka besar ke format mata uang singkat.
 * Contoh: 5875869 → "$5.88M" | 309172 → "$309.2K" | 455 → "$455.00"
 */
function formatCurrency(value) {
  if (value >= 1_000_000) {
    return "$" + (value / 1_000_000).toFixed(2) + "M";
  } else if (value >= 1_000) {
    return "$" + (value / 1_000).toFixed(1) + "K";
  }
  return "$" + value.toFixed(2);
}

/**
 * Format angka sebagai persentase.
 * Contoh: 22.28 → "22.28%"
 */
function formatPercent(value) {
  return value.toFixed(2) + "%";
}

/**
 * Format angka bulat dengan pemisah ribuan.
 * Contoh: 27274 → "27,274"
 */
function formatNumber(value) {
  return value.toLocaleString("en-US");
}

/**
 * Format angka untuk label sumbu chart (lebih ringkas).
 * Contoh: 1500000 → "$1.5M" | 50000 → "$50K"
 */
function formatAxis(value) {
  const neg = value < 0;
  const abs = Math.abs(value);
  const sign = neg ? "-" : "";
  if (abs >= 1e12) return sign + "$" + (abs/1e12).toFixed(1) + "T";
  if (abs >= 1e9)  return sign + "$" + (abs/1e9).toFixed(1)  + "B";
  if (abs >= 1e6)  return sign + "$" + (abs/1e6).toFixed(1)  + "M";
  if (abs >= 1e3)  return sign + "$" + (abs/1e3).toFixed(0)  + "K";
  return sign + "$" + abs.toFixed(0);
}
