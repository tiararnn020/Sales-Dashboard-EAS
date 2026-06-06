// =============================================================================
// js/config.js
// File konfigurasi global untuk Sales Analytics Dashboard.
//
// PENTING: File ini berisi API key.
// Jangan bagikan API key ke orang lain.
// =============================================================================


// =============================================================================
// BAGIAN 1: GROQ API CONFIGURATION
// Isi GROQ_API_KEY dengan API key yang sudah kamu buat di console.groq.com
// =============================================================================
const CONFIG = {

  // API key Groq — salin dari console.groq.com → API Keys
  // Bentuk: "gsk_xxxxxxxxxxxxxxxxxxxx"
  GROQ_API_KEY: "",   // ← ISI DI SINI dengan API key-mu

  // Model AI yang digunakan dari Groq
  // llama-3.1-8b-instant = cepat dan gratis, cocok untuk insight dashboard
  GROQ_MODEL: "llama-3.1-8b-instant",

  // Maksimal token untuk respons AI
  // 1024 token = cukup untuk 1-2 paragraf insight
  GROQ_MAX_TOKENS: 1024,

  // URL dashboard Tableau Public
  // Isi setelah kamu publish workbook ke Tableau Public
  // Bentuk: "https://public.tableau.com/views/NamaWorkbook/NamaDashboard"
  TABLEAU_URL: "",    // ← ISI DI SINI setelah buat dashboard Tableau

  // Path folder data JSON
  // Tidak perlu diubah jika struktur folder sesuai panduan
  DATA_PATH: "data/",

};


// =============================================================================
// BAGIAN 2: FORMAT ANGKA
// Fungsi-fungsi helper untuk format angka agar tampil rapi di dashboard
// =============================================================================

/**
 * Format angka besar menjadi format singkat dengan simbol mata uang
 * Contoh: 5875869.98 → "$5.88M"
 * Contoh: 309172.17  → "$309.2K"
 * Contoh: 455.20     → "$455.20"
 *
 * @param {number} value - Angka yang akan diformat
 * @returns {string} Angka terformat
 */
function formatCurrency(value) {
  if (value >= 1_000_000) {
    // Jika lebih dari 1 juta, tampilkan dalam format "M" (misal: $5.88M)
    return "$" + (value / 1_000_000).toFixed(2) + "M";
  } else if (value >= 1_000) {
    // Jika lebih dari 1000, tampilkan dalam format "K" (misal: $309.2K)
    return "$" + (value / 1_000).toFixed(1) + "K";
  } else {
    // Jika di bawah 1000, tampilkan penuh dengan 2 desimal
    return "$" + value.toFixed(2);
  }
}

/**
 * Format angka sebagai persentase
 * Contoh: 22.28 → "22.28%"
 *
 * @param {number} value - Angka persen (misal: 22.28)
 * @returns {string} Persentase terformat
 */
function formatPercent(value) {
  return value.toFixed(2) + "%";
}

/**
 * Format angka bulat dengan pemisah ribuan
 * Contoh: 27274 → "27,274"
 *
 * @param {number} value - Angka bulat
 * @returns {string} Angka terformat dengan koma
 */
function formatNumber(value) {
  return value.toLocaleString("en-US");
}

/**
 * Format angka untuk sumbu chart (lebih ringkas)
 * Contoh: 1500000 → "$1.5M"
 * Contoh: 50000   → "$50K"
 *
 * @param {number} value - Angka untuk label axis
 * @returns {string} Label axis terformat
 */
function formatAxis(value) {
  if (value >= 1_000_000) {
    return "$" + (value / 1_000_000).toFixed(1) + "M";
  } else if (value >= 1_000) {
    return "$" + (value / 1_000).toFixed(0) + "K";
  }
  return "$" + value;
}
