// =============================================================================
// js/app.js
// File orkestrator utama Sales Analytics Dashboard.
//
// Tugas file ini:
// 1. Load semua file JSON dari folder data/
// 2. Simpan data ke variabel global
// 3. Isi KPI cards dengan angka real
// 4. Inisialisasi tab switching (AI Dashboard ↔ Tableau)
// 5. Inisialisasi filter dropdown
// 6. Menjadi titik koordinasi semua modul lain
//
// URUTAN EKSEKUSI:
// Halaman load → DOMContentLoaded → loadAllData() → initDashboard()
// → renderKPI() + initTabs() + initFilters() + (chart di hari berikutnya)
// =============================================================================


// =============================================================================
// BAGIAN 1: VARIABEL GLOBAL DATA
// Semua data JSON disimpan di sini setelah berhasil di-load.
// Modul lain (charts.js, anomaly.js, dll) bisa akses variabel ini.
// =============================================================================

let DATA_KPI        = null;   // isi dari data/kpi.json
let DATA_CATEGORY   = null;   // isi dari data/by_category.json
let DATA_SUBCATEGORY= null;   // isi dari data/by_subcategory.json
let DATA_TERRITORY  = null;   // isi dari data/by_territory.json
let DATA_TREND      = null;   // isi dari data/trend_monthly.json
let DATA_SCATTER    = null;   // isi dari data/scatter.json
let DATA_TOP10      = null;   // isi dari data/top10.json
let DATA_FILTERS    = null;   // isi dari data/filters.json
let DATA_ANOMALY    = null;   // isi dari data/anomaly_data.json


// =============================================================================
// BAGIAN 2: ENTRY POINT
// Kode ini berjalan pertama kali saat halaman selesai dimuat.
// "DOMContentLoaded" = semua elemen HTML sudah siap, tapi gambar belum tentu.
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("[app.js] Halaman siap. Mulai load data...");

  // Inisialisasi tab switching
  initTabs();

  // Inisialisasi modal API key (cek & tampilkan jika belum ada key)
  initApiKeyModal();

  // Mulai load semua data JSON secara paralel
  loadAllData();
});


// =============================================================================
// BAGIAN 3: LOAD SEMUA DATA JSON
// Menggunakan Promise.all agar semua file JSON di-fetch secara bersamaan
// (lebih cepat dari fetch satu per satu secara berurutan)
// =============================================================================

/**
 * Fetch semua file JSON dari folder data/ secara paralel.
 * Setelah semua selesai, panggil initDashboard() untuk render.
 */
async function loadAllData() {
  try {
    console.log("[app.js] Fetching semua file JSON...");

    // Promise.all menjalankan semua fetch secara BERSAMAAN
    // Hasilnya: array berisi semua data dalam urutan yang sama
    const [kpi, category, subcategory, territory, trend, scatter, top10, filters, anomaly] =
      await Promise.all([
        fetchJSON(CONFIG.DATA_PATH + "kpi.json"),
        fetchJSON(CONFIG.DATA_PATH + "by_category.json"),
        fetchJSON(CONFIG.DATA_PATH + "by_subcategory.json"),
        fetchJSON(CONFIG.DATA_PATH + "by_territory.json"),
        fetchJSON(CONFIG.DATA_PATH + "trend_monthly.json"),
        fetchJSON(CONFIG.DATA_PATH + "scatter.json"),
        fetchJSON(CONFIG.DATA_PATH + "top10.json"),
        fetchJSON(CONFIG.DATA_PATH + "filters.json"),
        fetchJSON(CONFIG.DATA_PATH + "anomaly_data.json"),
      ]);

    // Simpan semua data ke variabel global
    DATA_KPI         = kpi;
    DATA_CATEGORY    = category;
    DATA_SUBCATEGORY = subcategory;
    DATA_TERRITORY   = territory;
    DATA_TREND       = trend;
    DATA_SCATTER     = scatter;
    DATA_TOP10       = top10;
    DATA_FILTERS     = filters;
    DATA_ANOMALY     = anomaly;

    console.log("[app.js] Semua data berhasil di-load ✓");
    console.log(`  KPI: total sales = ${DATA_KPI.total_sales}`);
    console.log(`  Category: ${DATA_CATEGORY.length} item`);
    console.log(`  Territory: ${DATA_TERRITORY.length} item`);
    console.log(`  Trend: ${DATA_TREND.length} bulan`);

    // Setelah data siap, render semua komponen dashboard
    initDashboard();

  } catch (error) {
    // Jika ada file yang gagal di-load, tampilkan pesan error
    console.error("[app.js] GAGAL load data:", error);
    showLoadError(error.message);
  }
}

/**
 * Helper function untuk fetch satu file JSON.
 * Melempar error jika response bukan OK (misal: file tidak ditemukan).
 *
 * @param {string} url - URL file JSON yang akan di-fetch
 * @returns {Promise<Object>} Data JSON yang sudah di-parse
 */
async function fetchJSON(url) {
  const response = await fetch(url);

  // Jika file tidak ditemukan atau ada error HTTP
  if (!response.ok) {
    throw new Error(`Gagal load ${url} (HTTP ${response.status})`);
  }

  return response.json();   // parse JSON dan return datanya
}


// =============================================================================
// BAGIAN 4: INISIALISASI DASHBOARD
// Dipanggil setelah semua data berhasil di-load.
// Memanggil semua fungsi render secara berurutan.
// =============================================================================

/**
 * Menginisialisasi semua komponen dashboard setelah data siap.
 * Urutan: KPI → Filter → Anomali → Chart (diimplementasi hari berikutnya)
 */
function initDashboard() {
  console.log("[app.js] Inisialisasi dashboard...");

  // 1. Render KPI cards dengan angka real dari DATA_KPI
  renderKPI();

  // 2. Inisialisasi dropdown filter dari DATA_FILTERS
  initFilters(DATA_FILTERS);

  // 3. Deteksi anomali (anomaly.js — akan diimplementasi Hari 7)
  if (typeof detectAnomalies === "function") {
    detectAnomalies(DATA_ANOMALY);
  }

  // 4. Render semua chart (charts.js — akan diimplementasi Hari 4)
  if (typeof renderAllCharts === "function") {
    renderAllCharts();
  }

  // 5. Generate judul naratif AI (storyEngine.js — Hari 8)
  if (typeof generateNarrativeTitle === "function") {
    generateNarrativeTitle(DATA_KPI, DATA_CATEGORY, DATA_TERRITORY);
  }

  console.log("[app.js] Dashboard siap ✓");
}


// =============================================================================
// BAGIAN 5: RENDER KPI CARDS
// Mengisi nilai angka di 4 KPI card menggunakan data dari kpi.json
// =============================================================================

/**
 * Mengisi nilai di semua 4 KPI card.
 * Menggunakan fungsi format dari config.js (formatCurrency, formatPercent, dll)
 */
function renderKPI() {
  console.log("[app.js] Render KPI cards...");

  // Ambil data dari variabel global DATA_KPI
  const kpi = DATA_KPI;

  // ── KPI 1: Total Sales ──
  // Tampilkan angka total penjualan dalam format "$X.XXM"
  setElementText("kpi-sales",  formatCurrency(kpi.total_sales));

  // Tampilkan periode data di sub-teks card Total Sales
  setElementText("kpi-period", kpi.date_start + " – " + kpi.date_end);

  // ── KPI 2: Total Profit ──
  setElementText("kpi-profit", formatCurrency(kpi.total_profit));

  // ── KPI 3: Profit Margin ──
  setElementText("kpi-margin", formatPercent(kpi.profit_margin));

  // ── KPI 4: Total Qty Sold ──
  setElementText("kpi-qty",    formatNumber(kpi.total_qty));

  // Tampilkan total orders di sub-teks card Total Qty
  setElementText("kpi-orders", formatNumber(kpi.total_orders) + " orders");

  console.log("[app.js] KPI cards selesai dirender ✓");
}


// =============================================================================
// BAGIAN 6: TAB SWITCHING
// Mengelola perpindahan antara tab "AI Dashboard" dan tab "Tableau"
// =============================================================================

/**
 * Menginisialisasi sistem tab switching.
 * Saat tombol tab diklik:
 * - Tombol aktif ditandai dengan class "active"
 * - Konten tab yang dipilih ditampilkan
 * - Konten tab lain disembunyikan
 */
function initTabs() {
  // Ambil semua tombol tab (elemen dengan class "tab-btn")
  const tabButtons = document.querySelectorAll(".tab-btn");

  // Pasang event listener ke setiap tombol tab
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Ambil nama tab dari atribut data-tab di HTML
      // Contoh: <button data-tab="dashboard"> → tabName = "dashboard"
      const tabName = btn.getAttribute("data-tab");

      // Hapus class "active" dari semua tombol tab
      tabButtons.forEach((b) => b.classList.remove("active"));

      // Tambahkan class "active" ke tombol yang diklik
      btn.classList.add("active");

      // Sembunyikan semua konten tab
      document.querySelectorAll(".tab-content").forEach((content) => {
        content.classList.remove("active");
      });

      // Tampilkan konten tab yang sesuai
      // ID konten tab = "tab-" + nama tab
      // Contoh: tabName = "dashboard" → tampilkan #tab-dashboard
      const targetContent = document.getElementById("tab-" + tabName);
      if (targetContent) {
        targetContent.classList.add("active");
      }

      // Khusus tab Tableau: load iframe jika belum ada
      if (tabName === "tableau") {
        loadTableauEmbed();
      }

      console.log(`[app.js] Tab aktif: ${tabName}`);
    });
  });

  console.log("[app.js] Tab switching siap ✓");
}

/**
 * Load embed Tableau Public ke dalam tab Tableau.
 * Menggunakan URL dari CONFIG.TABLEAU_URL di config.js.
 * Jika URL belum diisi, tampilkan placeholder.
 */
function loadTableauEmbed() {
  const wrapper = document.getElementById("tableau-frame-wrapper");
  if (!wrapper) return;

  // Jika URL Tableau sudah diisi di config.js
  if (CONFIG.TABLEAU_URL && CONFIG.TABLEAU_URL.trim() !== "") {
    // Buat iframe untuk embed Tableau
    wrapper.innerHTML = `
      <iframe
        src="${CONFIG.TABLEAU_URL}"
        width="100%"
        height="700"
        frameborder="0"
        allowfullscreen
        title="Tableau Dashboard">
      </iframe>
    `;
    console.log("[app.js] Tableau embed dimuat ✓");
  } else {
    // Jika URL belum diisi, tetap tampilkan placeholder
    console.warn("[app.js] TABLEAU_URL belum diisi di config.js");
  }
}


// =============================================================================
// BAGIAN 7: CALLBACK SAAT FILTER BERUBAH
// Fungsi ini dipanggil oleh filters.js setiap kali user mengubah filter.
// Saat ini hanya log ke console — chart re-render akan ditambah Hari 4-5.
// =============================================================================

/**
 * Dipanggil oleh filters.js setiap kali ada perubahan filter.
 * Fungsi ini akan diisi dengan re-render chart di Hari 4 dan 5.
 */
function onFiltersChanged() {
  console.log("[app.js] Filter berubah:", ACTIVE_FILTERS);

  // Re-render chart berdasarkan filter baru (akan diimplementasi Hari 4-5)
  if (typeof renderAllCharts === "function") {
    renderAllCharts();
  }
}


// =============================================================================
// BAGIAN 8: HELPER FUNCTIONS
// Fungsi pembantu yang digunakan di berbagai tempat
// =============================================================================

/**
 * Mengisi teks sebuah elemen HTML berdasarkan ID-nya.
 * Lebih aman dari document.getElementById().textContent
 * karena dilengkapi pengecekan null.
 *
 * @param {string} elementId - ID elemen HTML
 * @param {string} text      - Teks yang akan dimasukkan
 */
function setElementText(elementId, text) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = text;
  } else {
    // Jika elemen tidak ditemukan, catat warning tapi jangan error
    console.warn(`[app.js] Elemen #${elementId} tidak ditemukan`);
  }
}

/**
 * Menampilkan pesan error di halaman jika data gagal di-load.
 * Biasanya terjadi saat file JSON tidak ada atau path salah.
 *
 * @param {string} message - Pesan error yang akan ditampilkan
 */
function showLoadError(message) {
  // Cari elemen judul naratif untuk tampilkan error
  const titleEl = document.getElementById("narrative-title");
  if (titleEl) {
    titleEl.textContent = "⚠ Gagal memuat data dashboard";
    titleEl.style.color = "#E57A44";  // warna oranye untuk error
  }

  // Tampilkan detail error di console
  console.error("[app.js] Detail error:", message);
  console.error("[app.js] Pastikan:");
  console.error("  1. File CSV sudah di-copy ke folder project");
  console.error("  2. Script prepare_data.py sudah dijalankan");
  console.error("  3. Folder data/ berisi 9 file JSON");
  console.error("  4. Dashboard dibuka melalui server (bukan file://)");
  console.error("     → Gunakan Live Server di VS Code");
}


// =============================================================================
// BAGIAN 9: MODAL API KEY
// =============================================================================

function initApiKeyModal() {
  const overlay   = document.getElementById("modal-overlay");
  const btnOpen   = document.getElementById("btn-settings");
  const btnSave   = document.getElementById("btn-save-key");
  const btnCancel = document.getElementById("btn-cancel-modal");
  const inputKey  = document.getElementById("input-api-key");
  const status    = document.getElementById("modal-status");

  // Buka modal — tambah class .show ke overlay
  function openModal() {
    overlay.classList.add("show");
    status.textContent = "";
    status.className   = "modal-status";
    // Tampilkan key yang sudah tersimpan jika ada
    if (hasGroqApiKey()) inputKey.value = getGroqApiKey();
    else inputKey.value = "";
    inputKey.focus();
  }

  // Tutup modal — hapus class .show dari overlay
  function closeModal() {
    overlay.classList.remove("show");
    status.textContent = "";
    status.className   = "modal-status";
  }

  // Tombol ⚙ API Key di navbar → buka modal
  if (btnOpen)   btnOpen.addEventListener("click", openModal);

  // Tombol Tutup → tutup modal
  if (btnCancel) btnCancel.addEventListener("click", closeModal);

  // Klik area gelap di luar kotak modal → tutup modal
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // Tekan Escape → tutup modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // Tombol Simpan → validasi + simpan ke localStorage
  if (btnSave) {
    btnSave.addEventListener("click", () => {
      const key = inputKey.value.trim();

      if (!key) {
        status.textContent = "⚠ API key tidak boleh kosong";
        status.className   = "modal-status error";
        return;
      }
      if (!key.startsWith("gsk_")) {
        status.textContent = "⚠ Format tidak valid. Harus dimulai 'gsk_'";
        status.className   = "modal-status error";
        return;
      }

      // Simpan ke localStorage
      setGroqApiKey(key);

      // Tampilkan sukses lalu tutup otomatis 1.5 detik
      status.textContent = "✓ API key berhasil disimpan!";
      status.className   = "modal-status success";
      setTimeout(closeModal, 1500);
    });
  }

  // Enter di input → trigger Simpan
  if (inputKey) {
    inputKey.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btnSave.click();
    });
  }

  // Buka modal otomatis hanya jika API key belum tersimpan
  if (!hasGroqApiKey()) {
    console.log("[app.js] API key belum ada → tampilkan modal");
    openModal();
  } else {
    console.log("[app.js] API key sudah tersimpan ✓");
  }
}
