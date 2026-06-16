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
// → renderKPI() + initTabs() + initFilters() + chart + anomali + narasi
// =============================================================================


// =============================================================================
// BAGIAN 1: VARIABEL GLOBAL DATA
// Semua data JSON disimpan di sini setelah berhasil di-load.
// Modul lain (charts.js, anomaly.js, storyEngine.js, dll) akses variabel ini.
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
let DATA_DETAIL     = null;   // isi dari data/detail_data.json

// Data yang sudah difilter — dipakai oleh charts.js DAN storyEngine.js
// agar keduanya selalu merefleksikan filter yang sama secara konsisten.
let FILTERED_CATEGORY  = null;
let FILTERED_TERRITORY = null;


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
    const [kpi, category, subcategory, territory, trend, scatter, top10, filters, anomaly, detail] =
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
        fetchJSON(CONFIG.DATA_PATH + "detail_data.json"),
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
    DATA_DETAIL      = detail;

    // Inisialisasi data terfilter = data penuh (belum ada filter aktif saat load awal)
    FILTERED_CATEGORY  = DATA_CATEGORY;
    FILTERED_TERRITORY = DATA_TERRITORY;

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
 * Urutan: KPI → Filter → Anomali → AI Buttons → Chart → Narasi
 *
 * Urutan ini sengaja: narasi (storyEngine) dipanggil PALING TERAKHIR
 * karena updateNarrative() membaca FILTERED_CATEGORY/FILTERED_TERRITORY
 * yang sudah pasti final di titik ini (tidak ada modifikasi async lain
 * yang masih berjalan terhadap kedua variabel tersebut).
 */
function initDashboard() {
  console.log("[app.js] Inisialisasi dashboard...");

  // 1. Render KPI cards dengan angka real dari DATA_KPI
  renderKPI();

  // 2. Inisialisasi dropdown filter dari DATA_FILTERS
  initFilters(DATA_FILTERS);

  // 3. Deteksi anomali (anomaly.js — Hari 7)
  if (typeof detectAnomalies === "function") {
    detectAnomalies(DATA_ANOMALY);
  }

  // 4. AI Buttons (aiInsight.js — Hari 6)
  if (typeof initAIButtons === "function") {
    initAIButtons();
  }

  // 5. Render semua chart (charts.js — Hari 3-4)
  if (typeof renderAllCharts === "function") {
    renderAllCharts();
  }

  // 6. Generate judul naratif otomatis (storyEngine.js — Hari 8)
  // Dipanggil tanpa parameter — updateNarrative() membaca FILTERED_CATEGORY
  // dan FILTERED_TERRITORY langsung dari variabel global. Ini penting karena
  // fungsi yang sama juga dipanggil ulang dari onFiltersChanged() setiap
  // filter berubah, dan kedua titik panggil harus konsisten menggunakan
  // source data yang sama (bukan DATA_KPI/DATA_CATEGORY mentah yang tidak
  // merefleksikan filter aktif).
  if (typeof updateNarrative === "function") {
    updateNarrative();
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
  setElementText("kpi-sales",  formatCurrency(kpi.total_sales));
  setElementText("kpi-period", kpi.date_start + " – " + kpi.date_end);

  // ── KPI 2: Total Profit ──
  setElementText("kpi-profit", formatCurrency(kpi.total_profit));

  // ── KPI 3: Profit Margin ──
  setElementText("kpi-margin", formatPercent(kpi.profit_margin));

  // ── KPI 4: Total Qty Sold ──
  setElementText("kpi-qty",    formatNumber(kpi.total_qty));
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
  const tabButtons = document.querySelectorAll(".tab-btn");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = btn.getAttribute("data-tab");

      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".tab-content").forEach((content) => {
        content.classList.remove("active");
      });

      const targetContent = document.getElementById("tab-" + tabName);
      if (targetContent) {
        targetContent.classList.add("active");
      }

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

  if (CONFIG.TABLEAU_URL && CONFIG.TABLEAU_URL.trim() !== "") {
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
    console.warn("[app.js] TABLEAU_URL belum diisi di config.js");
  }
}


// =============================================================================
// BAGIAN 7: CALLBACK SAAT FILTER BERUBAH
// Dipanggil oleh filters.js setiap kali user mengubah salah satu dropdown
// filter (tahun/kategori/territory/segment). Menghitung ulang KPI dan
// agregasi kategori/territory dari DATA_DETAIL, lalu memicu re-render
// chart dan narasi agar semuanya konsisten dengan filter aktif.
// =============================================================================

/**
 * Menerapkan ACTIVE_FILTERS ke DATA_DETAIL (data transaksi level detail).
 * @returns {Array} Baris data yang lolos semua kriteria filter aktif
 */
function applyFiltersToDetail() {
  if (!DATA_DETAIL) return [];
  return DATA_DETAIL.filter(d => {
    if (ACTIVE_FILTERS.year      !== "all" && String(d.year) !== ACTIVE_FILTERS.year)      return false;
    if (ACTIVE_FILTERS.category  !== "all" && d.category     !== ACTIVE_FILTERS.category)  return false;
    if (ACTIVE_FILTERS.territory !== "all" && d.territory    !== ACTIVE_FILTERS.territory) return false;
    if (ACTIVE_FILTERS.segment   !== "all" && d.segment      !== ACTIVE_FILTERS.segment)   return false;
    return true;
  });
}

/**
 * Menghitung ulang KPI ringkasan dari data yang sudah difilter.
 * @param   {Array} filtered - Hasil dari applyFiltersToDetail()
 * @returns {Object} { total_sales, total_profit, profit_margin, total_qty, total_orders }
 */
function computeFilteredKPI(filtered) {
  if (!filtered.length) return { total_sales:0, total_profit:0, profit_margin:0, total_qty:0, total_orders:0 };
  const sales  = filtered.reduce((s,d) => s + d.sales,  0);
  const profit = filtered.reduce((s,d) => s + d.profit, 0);
  const qty    = filtered.reduce((s,d) => s + d.qty,    0);
  const orders = filtered.reduce((s,d) => s + d.orders, 0);
  return {
    total_sales:   Math.round(sales   * 100) / 100,
    total_profit:  Math.round(profit  * 100) / 100,
    profit_margin: sales > 0 ? Math.round(profit / sales * 10000) / 100 : 0,
    total_qty:     qty,
    total_orders:  orders,
  };
}

/**
 * Mengagregasi data terfilter per kategori (untuk chart category + storyEngine).
 * @param   {Array} filtered - Hasil dari applyFiltersToDetail()
 * @returns {Array} Array { category, sales, profit, margin, qty, orders }, diurutkan by sales desc
 */
function computeFilteredCategory(filtered) {
  const map = {};
  filtered.forEach(d => {
    if (!map[d.category]) map[d.category] = { category:d.category, sales:0, profit:0, qty:0, orders:0 };
    map[d.category].sales   += d.sales;
    map[d.category].profit  += d.profit;
    map[d.category].qty     += d.qty;
    map[d.category].orders  += d.orders;
  });
  return Object.values(map).map(d => ({
    ...d,
    sales:  Math.round(d.sales  * 100) / 100,
    profit: Math.round(d.profit * 100) / 100,
    margin: d.sales > 0 ? Math.round(d.profit / d.sales * 10000) / 100 : 0,
  })).sort((a,b) => b.sales - a.sales);
}

/**
 * Mengagregasi data terfilter per territory (untuk chart territory + storyEngine).
 * @param   {Array} filtered - Hasil dari applyFiltersToDetail()
 * @returns {Array} Array { territory, sales, profit, margin, qty, orders, customers }, diurutkan by sales desc
 */
function computeFilteredTerritory(filtered) {
  const map = {};
  filtered.forEach(d => {
    if (!map[d.territory]) map[d.territory] = { territory:d.territory, sales:0, profit:0, qty:0, orders:0, customers:0 };
    map[d.territory].sales   += d.sales;
    map[d.territory].profit  += d.profit;
    map[d.territory].qty     += d.qty;
    map[d.territory].orders  += d.orders;
  });
  return Object.values(map).map(d => ({
    ...d,
    sales:  Math.round(d.sales  * 100) / 100,
    profit: Math.round(d.profit * 100) / 100,
    margin: d.sales > 0 ? Math.round(d.profit / d.sales * 10000) / 100 : 0,
  })).sort((a,b) => b.sales - a.sales);
}

/**
 * Menampilkan badge "Filter aktif: ..." di bawah narrative-sub.
 * Badge dihapus dan dibuat ulang setiap panggilan agar tidak menumpuk
 * saat filter diubah berkali-kali.
 */
function updateFilterIndicator() {
  const active = Object.entries(ACTIVE_FILTERS)
    .filter(([,v]) => v !== "all")
    .map(([k,v]) => `${k}: ${v}`);
  document.querySelectorAll(".filter-indicator").forEach(el => el.remove());
  if (active.length === 0) return;
  const badge = document.createElement("div");
  badge.className = "filter-indicator";
  badge.style.cssText =
    "display:inline-flex;align-items:center;gap:8px;padding:4px 12px;" +
    "background:rgba(2,195,189,0.1);border:1px solid rgba(2,195,189,0.3);" +
    "border-radius:20px;font-size:11px;color:#02C3BD;margin-top:8px;" +
    "font-family:'Poppins',sans-serif;flex-wrap:wrap;";
  badge.innerHTML = `<span>⊙ Filter aktif:</span>` +
    active.map(a => `<span style="background:rgba(2,195,189,0.15);padding:2px 8px;border-radius:10px;">${a}</span>`).join("") +
    `<button onclick="document.getElementById('btn-reset-filter').click()" ` +
    `style="background:none;border:none;color:#E57A44;cursor:pointer;font-size:11px;padding:0;">✕ Reset</button>`;
  const setupZone = document.querySelector(".zone-setup .narrative-sub");
  if (setupZone) setupZone.after(badge);
}

/**
 * Dipanggil oleh filters.js setiap kali ACTIVE_FILTERS berubah.
 *
 * Urutan operasi:
 *   1. Terapkan filter ke DATA_DETAIL → hitung ulang KPI, category, territory
 *   2. Update teks KPI cards
 *   3. Update FILTERED_CATEGORY/FILTERED_TERRITORY (dibaca oleh charts.js
 *      dan storyEngine.js)
 *   4. Re-render semua chart dengan data baru
 *   5. Re-generate narasi (storyEngine.js) dengan data baru
 *   6. Tampilkan badge indikator filter aktif
 *
 * updateNarrative() dipanggil SETELAH FILTERED_CATEGORY/FILTERED_TERRITORY
 * diperbarui (langkah 3) — urutan ini wajib, karena storyEngine.js membaca
 * kedua variabel tersebut secara langsung, bukan menerima parameter.
 */
function onFiltersChanged() {
  console.log("[app.js] Filter berubah:", ACTIVE_FILTERS);
  if (!DATA_DETAIL) return;

  const filtered    = applyFiltersToDetail();
  const filteredKPI = computeFilteredKPI(filtered);

  setElementText("kpi-sales",  formatCurrency(filteredKPI.total_sales));
  setElementText("kpi-profit", formatCurrency(filteredKPI.total_profit));
  setElementText("kpi-margin", formatPercent(filteredKPI.profit_margin));
  setElementText("kpi-qty",    formatNumber(filteredKPI.total_qty));
  setElementText("kpi-orders", formatNumber(filteredKPI.total_orders) + " orders");

  FILTERED_CATEGORY  = filtered.length ? computeFilteredCategory(filtered)  : DATA_CATEGORY;
  FILTERED_TERRITORY = filtered.length ? computeFilteredTerritory(filtered) : DATA_TERRITORY;

  if (typeof renderAllCharts === "function") renderAllCharts();

  // Re-generate narasi otomatis (storyEngine.js — Hari 8) agar judul dan
  // anotasi chart-title selalu merefleksikan filter yang baru diterapkan.
  if (typeof updateNarrative === "function") updateNarrative();

  updateFilterIndicator();
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
  const titleEl = document.getElementById("narrative-title");
  if (titleEl) {
    titleEl.textContent = "⚠ Gagal memuat data dashboard";
    titleEl.style.color = "#E57A44";
  }

  console.error("[app.js] Detail error:", message);
  console.error("[app.js] Pastikan:");
  console.error("  1. File CSV sudah di-copy ke folder project");
  console.error("  2. Script prepare_data.py sudah dijalankan");
  console.error("  3. Folder data/ berisi semua file JSON yang dibutuhkan");
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

  function openModal() {
    overlay.classList.add("show");
    status.textContent = "";
    status.className   = "modal-status";
    if (hasGroqApiKey()) inputKey.value = getGroqApiKey();
    else inputKey.value = "";
    inputKey.focus();
  }

  function closeModal() {
    overlay.classList.remove("show");
    status.textContent = "";
    status.className   = "modal-status";
  }

  if (btnOpen)   btnOpen.addEventListener("click", openModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);

  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

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

      setGroqApiKey(key);

      status.textContent = "✓ API key berhasil disimpan!";
      status.className   = "modal-status success";
      setTimeout(closeModal, 1500);
    });
  }

  if (inputKey) {
    inputKey.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btnSave.click();
    });
  }

  if (!hasGroqApiKey()) {
    console.log("[app.js] API key belum ada → tampilkan modal");
    openModal();
  } else {
    console.log("[app.js] API key sudah tersimpan ✓");
  }
}