// =============================================================================
// js/storyEngine.js
// Generator judul naratif otomatis berbasis data (rule-based, BUKAN AI API).
//
// MENGAPA RULE-BASED, BUKAN GROQ API (seperti aiInsight.js)?
//   1. Latency: judul ini muncul di paling atas dashboard (Zona Setup), dilihat
//      pertama kali. Kalau bergantung pada API call eksternal, ada window
//      loading yang terlihat kosong — buruk untuk first impression saat demo.
//   2. Determinism: rule-based menghasilkan output identik setiap re-run.
//      Penting untuk konsistensi take video — tidak ada variasi LLM yang
//      bisa berubah-ubah antara satu rekaman dengan rekaman ulang.
//   3. Reaktif terhadap filter: judul ini harus update setiap filter berubah
//      (lihat BAGIAN 4). Memanggil Groq API setiap filter berubah akan
//      menghasilkan banyak request berbayar untuk hal yang sebenarnya bisa
//      dihitung langsung dari data yang sudah ada di memori (DATA_*).
//
// CARA KERJA:
//   1. updateNarrative() dipanggil oleh app.js setiap data/filter berubah
//   2. Fungsi ini membaca FILTERED_CATEGORY, FILTERED_TERRITORY, ACTIVE_FILTERS
//   3. Menentukan kategori dan territory paling dominan/menonjol
//   4. Menyusun kalimat naratif menggunakan template string + data aktual
//   5. Menulis hasil ke 4 elemen DOM:
//      narrative-title, narrative-sub (Zona Setup)
//      title-category, title-territory (Zona Conflict)
//
// CAKUPAN YANG SENGAJA DIBATASI:
//   storyEngine TIDAK menyentuh title-trend, title-scatter, title-top10.
//   Ketiga chart tersebut sudah reaktif terhadap filter melalui charts.js
//   sendiri (renderTrendChart, renderScatterChart, renderTop10Chart).
//   Menambahkan storyEngine di sana berisiko duplikasi pesan atau race
//   condition antara dua sistem yang sama-sama mendengarkan event filter.
//   storyEngine juga TIDAK menyentuh anomaly-panel — itu domain anomaly.js.
//
// DEPENDENSI:
//   app.js → DATA_CATEGORY, DATA_TERRITORY, FILTERED_CATEGORY,
//            FILTERED_TERRITORY, ACTIVE_FILTERS
//   config.js → formatCurrency(), formatPercent()
// =============================================================================


// =============================================================================
// BAGIAN 1: ENTRY POINT
// =============================================================================

/**
 * Fungsi utama — dipanggil oleh app.js setiap kali data awal dimuat
 * ATAU setiap kali filter berubah (sama seperti renderAllCharts()).
 *
 * Membungkus semua sub-generator dalam try-catch agar kegagalan pada satu
 * bagian (misal data kosong akibat kombinasi filter yang tidak match)
 * tidak menghentikan render judul yang lain.
 */
function updateNarrative() {
  try {
    updateSetupNarrative();
    updateConflictNarrative();
    console.log("[storyEngine.js] Narasi berhasil diperbarui ✓");
  } catch (err) {
    console.error("[storyEngine.js] Gagal memperbarui narasi:", err);
  }
}


// =============================================================================
// BAGIAN 2: NARASI ZONA SETUP
// Judul utama (h1) dan sub-judul deskriptif di bagian paling atas dashboard.
// =============================================================================

/**
 * Memperbarui narrative-title dan narrative-sub berdasarkan data terfilter.
 *
 * Logika:
 *   - Jika TIDAK ada filter aktif → judul umum mencakup seluruh periode data
 *   - Jika ADA filter aktif → judul menyebutkan filter yang sedang diterapkan
 *     beserta angka kategori dominan dalam konteks filter tersebut
 *
 * Menggunakan FILTERED_CATEGORY (bukan DATA_CATEGORY) agar narasi selalu
 * merefleksikan data yang SEDANG ditampilkan, bukan data mentah lengkap.
 */
function updateSetupNarrative() {
  const titleEl = document.getElementById("narrative-title");
  const subEl   = document.getElementById("narrative-sub");
  if (!titleEl || !subEl) return;

  const catData = (FILTERED_CATEGORY?.length) ? FILTERED_CATEGORY : DATA_CATEGORY;
  if (!catData?.length) return;   // tidak ada data untuk dianalisis, biarkan teks lama

  // Kategori dengan sales tertinggi — headline utama narasi
  const topCategory = [...catData].sort((a, b) => b.sales - a.sales)[0];

  // Deteksi filter aktif untuk personalisasi judul
  const filterParts = [];
  if (ACTIVE_FILTERS.year     !== "all") filterParts.push(`tahun ${ACTIVE_FILTERS.year}`);
  if (ACTIVE_FILTERS.category !== "all") filterParts.push(`kategori ${ACTIVE_FILTERS.category}`);
  if (ACTIVE_FILTERS.territory !== "all") filterParts.push(`territory ${ACTIVE_FILTERS.territory}`);
  if (ACTIVE_FILTERS.segment  !== "all") filterParts.push(`segmen ${ACTIVE_FILTERS.segment}`);

  const hasFilter = filterParts.length > 0;
  const filterText = hasFilter ? filterParts.join(", ") : null;

  // ── Judul Utama (h1) ──
  if (hasFilter) {
    titleEl.textContent =
      `Performa ${filterText}: ${topCategory.category} Memimpin dengan ${formatCurrency(topCategory.sales)}`;
  } else {
    titleEl.textContent =
      `Data Penjualan 2001–2004: ${topCategory.category} Mendominasi dengan ${formatCurrency(topCategory.sales)}`;
  }

  // ── Sub-judul Deskriptif ──
  // Hitung total sales seluruh kategori dalam konteks filter untuk persentase kontribusi
  const totalSales = catData.reduce((s, d) => s + d.sales, 0);
  const sharePct   = totalSales > 0 ? (topCategory.sales / totalSales * 100) : 0;

  subEl.textContent = hasFilter
    ? `Dalam filter yang diterapkan (${filterText}), kategori ${topCategory.category} ` +
      `berkontribusi ${sharePct.toFixed(0)}% dari total sales dengan margin profit ${formatPercent(topCategory.margin)}.`
    : `Dashboard ini menyajikan analisis komprehensif data penjualan 2001–2004. ` +
      `Kategori ${topCategory.category} berkontribusi ${sharePct.toFixed(0)}% dari total sales ` +
      `dengan margin profit ${formatPercent(topCategory.margin)}.`;
}


// =============================================================================
// BAGIAN 3: NARASI ZONA CONFLICT
// Anotasi singkat di judul chart Category dan Territory — bukan rewrite total,
// hanya menambahkan highlight angka ke judul statis yang sudah ada di HTML.
// =============================================================================

/**
 * Memperbarui title-category dan title-territory dengan highlight angka
 * paling menonjol, sambil mempertahankan judul dasar yang sudah ada di HTML.
 *
 * Pendekatan "anotasi" (bukan ganti total) dipilih agar konsisten dengan
 * chart-badge di sebelahnya yang tetap menampilkan tipe chart ("Bar Chart").
 * Mengganti total judul akan membuat layout terasa tidak konsisten dengan
 * pola penamaan chart lain yang tetap statis (title-trend, dst).
 */
function updateConflictNarrative() {
  updateCategoryTitle();
  updateTerritoryTitle();
}

/**
 * Anotasi title-category: tambahkan info margin tertinggi sebagai konteks cepat.
 */
function updateCategoryTitle() {
  const el = document.getElementById("title-category");
  if (!el) return;

  const catData = (FILTERED_CATEGORY?.length) ? FILTERED_CATEGORY : DATA_CATEGORY;
  if (!catData?.length) return;

  const bestMargin = [...catData].sort((a, b) => b.margin - a.margin)[0];

  el.innerHTML =
    `Sales &amp; Profit per Kategori ` +
    `<span style="color:#02C3BD;font-weight:400;font-size:0.8em;">` +
    `— ${bestMargin.category} margin tertinggi (${formatPercent(bestMargin.margin)})</span>`;
}

/**
 * Anotasi title-territory: tambahkan info territory dengan sales tertinggi.
 */
function updateTerritoryTitle() {
  const el = document.getElementById("title-territory");
  if (!el) return;

  const terData = (FILTERED_TERRITORY?.length) ? FILTERED_TERRITORY : DATA_TERRITORY;
  if (!terData?.length) return;

  const topTerritory = [...terData].sort((a, b) => b.sales - a.sales)[0];

  el.innerHTML =
    `Profitabilitas per Territory ` +
    `<span style="color:#02C3BD;font-weight:400;font-size:0.8em;">` +
    `— ${topTerritory.territory} teratas (${formatCurrency(topTerritory.sales)})</span>`;
}