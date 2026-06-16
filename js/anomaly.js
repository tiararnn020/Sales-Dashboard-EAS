// =============================================================================
// js/anomaly.js
// Deteksi anomali otomatis dari data penjualan menggunakan dua metode:
//
// METODE 1 — Z-score (per bulan):
//   Hitung rata-rata dan standar deviasi sales bulanan.
//   Titik yang lebih dari 2 standar deviasi dari rata-rata = anomali.
//   Baik untuk mendeteksi lonjakan atau penurunan ekstrem.
//
// METODE 2 — IQR (Interquartile Range, per subcategory):
//   Hitung Q1, Q3, dan IQR = Q3 - Q1.
//   Titik di luar [Q1 - 1.5×IQR, Q3 + 1.5×IQR] = outlier.
//   Baik untuk mendeteksi subcategory yang abnormal dibanding kelompoknya.
//
// OUTPUT:
//   Daftar anomali ditampilkan di panel #anomaly-list di zona Conflict.
//   Setiap item menampilkan: nama, nilai, deskripsi singkat.
//
// CATATAN ANALISIS — Jul 2004 (verifikasi dari raw CSV, bukan asumsi):
//   Tanggal mencakup penuh 1–31 Juli (bukan partial month dalam arti kalender).
//   NAMUN: jumlah order hanya 651, sementara Mei 2004 = 1.308 dan Jun 2004 = 1.298
//   (sekitar setengah volume normal). Average Order Value juga kolaps ke $8.4
//   dibanding ~$190-210 di bulan-bulan sekitarnya.
//   Kombinasi (order turun 50% + AOV turun 95%) lebih konsisten dengan kemungkinan
//   data extraction yang terpotong (misal hanya sebagian kategori/subkategori
//   ter-capture untuk bulan tersebut) ketimbang murni fenomena bisnis organik.
//   Tidak ditrim dari analisis Z-score karena tidak ada bukti pasti ini partial
//   data — namun temuan ini sebaiknya disebutkan sebagai limitasi data saat
//   presentasi, bukan diklaim sebagai "anomali bisnis murni" tanpa catatan.
// =============================================================================


// =============================================================================
// BAGIAN 1: ENTRY POINT
// =============================================================================

/**
 * Fungsi utama — dipanggil oleh initDashboard() di app.js.
 * Menjalankan kedua metode deteksi dan menampilkan hasilnya.
 *
 * @param {Array} anomalyData - Data dari data/anomaly_data.json
 */
function detectAnomalies(anomalyData) {
  if (!anomalyData?.length) {
    showNoAnomalyMessage("Data anomali tidak tersedia.");
    return;
  }

  console.log("[anomaly.js] Mulai deteksi anomali...");

  // Jalankan kedua metode deteksi
  const zscore  = detectZscoreAnomalies(anomalyData);   // Metode 1
  const iqr     = detectIQRAnomalies(anomalyData);       // Metode 2

  // Gabungkan, hilangkan duplikat, urutkan berdasarkan severity
  const combined = mergeAnomalies(zscore, iqr);

  console.log(`[anomaly.js] Ditemukan ${combined.length} anomali ✓`);

  // Render ke panel
  renderAnomalyPanel(combined);
}


// =============================================================================
// BAGIAN 2: METODE Z-SCORE
// Deteksi bulan dengan penjualan ekstrem (sangat tinggi atau sangat rendah)
// berdasarkan deviasi dari rata-rata seluruh periode.
// =============================================================================

/**
 * Mendeteksi bulan yang sales-nya menyimpang > 2 standar deviasi dari rata-rata.
 *
 * Z-score = (nilai - mean) / stddev
 * |Z| > 2 = anomali (≈ 5% data paling ekstrem)
 *
 * Catatan: TIDAK melakukan trimming bulan pertama/terakhir. Verifikasi langsung
 * terhadap raw data (lihat blok komentar di kepala file) menunjukkan Jul 2004
 * mencakup tanggal lengkap 1-31, sehingga tidak ada bukti pasti ini partial
 * month. Lihat catatan limitasi data di kepala file untuk konteks lengkap.
 *
 * @param   {Array}  data  - Data anomaly_data.json
 * @returns {Array}  Array objek anomali dari metode Z-score
 */
function detectZscoreAnomalies(data) {
  const anomalies = [];

  // Kelompokkan data per bulan (agregasi semua subcategory dalam satu bulan)
  const monthMap = {};
  data.forEach(d => {
    const key = d.month_key;
    if (!monthMap[key]) {
      monthMap[key] = { month_key: key, label: d.label, sales: 0, profit: 0 };
    }
    monthMap[key].sales  += d.sales;
    monthMap[key].profit += d.profit;
  });

  // Konversi map ke array, lalu hitung mean dan standar deviasi populasi.
  // (Satu-satunya blok deklarasi — versi sebelumnya punya duplikat blok ini
  //  yang menyebabkan "SyntaxError: Identifier 'months' has already been declared")
  const months    = Object.values(monthMap);
  const salesVals = months.map(m => m.sales);
  const mean      = salesVals.reduce((s, v) => s + v, 0) / salesVals.length;
  const variance  = salesVals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / salesVals.length;
  const stddev    = Math.sqrt(variance);

  if (stddev === 0) return [];   // tidak bisa deteksi jika semua nilai identik

  // Identifikasi anomali: |Z| > 2
  months.forEach(m => {
    const zscore = (m.sales - mean) / stddev;

    if (Math.abs(zscore) > 2) {
      const isHigh = zscore > 0;
      anomalies.push({
        id:        `zscore_${m.month_key}`,
        type:      "zscore",
        severity:  Math.abs(zscore) > 3 ? "high" : "medium",
        name:      m.label,
        metric:    "Sales Bulanan",
        value:     m.sales,
        zscore:    Math.abs(zscore).toFixed(2),
        direction: isHigh ? "spike" : "drop",
        description: isHigh
          ? `Lonjakan sales ${formatCurrency(m.sales)} (${Math.abs(zscore).toFixed(1)}σ di atas rata-rata ${formatCurrency(mean)})`
          : `Penurunan sales ${formatCurrency(m.sales)} (${Math.abs(zscore).toFixed(1)}σ di bawah rata-rata ${formatCurrency(mean)})`,
        recommendation: isHigh
          ? "Analisis faktor pendorong lonjakan ini untuk dapat direplikasi di bulan lain."
          : "Investigasi penyebab penurunan tajam — apakah ada gangguan eksternal atau keterbatasan data?",
      });
    }
  });

  return anomalies;
}


// =============================================================================
// BAGIAN 3: METODE IQR
// Deteksi subcategory dengan profit margin yang jauh di luar rentang normal.
// =============================================================================

/**
 * Mendeteksi subcategory dengan profit margin yang merupakan outlier
 * berdasarkan metode IQR (Interquartile Range).
 *
 * Outlier jika:
 *   nilai < Q1 - 1.5 × IQR   (lower fence)
 *   nilai > Q3 + 1.5 × IQR   (upper fence)
 *
 * @param   {Array}  data  - Data anomaly_data.json
 * @returns {Array}  Array objek anomali dari metode IQR
 */
function detectIQRAnomalies(data) {
  const anomalies = [];

  // Agregasi profit per subcategory (total seluruh periode)
  const subcatMap = {};
  data.forEach(d => {
    const key = d.subcategory;
    if (!subcatMap[key]) {
      subcatMap[key] = {
        subcategory: d.subcategory,
        category:    d.category,
        sales:  0,
        profit: 0,
      };
    }
    subcatMap[key].sales  += d.sales;
    subcatMap[key].profit += d.profit;
  });

  const subcats = Object.values(subcatMap);

  // Hitung margin per subcategory
  const margins = subcats.map(s => ({
    ...s,
    margin: s.sales > 0 ? (s.profit / s.sales * 100) : 0,
  }));

  // Urutkan margin untuk kalkulasi quartile
  const sortedMargins = [...margins.map(m => m.margin)].sort((a, b) => a - b);
  const n = sortedMargins.length;

  if (n < 4) return [];   // terlalu sedikit data untuk IQR yang bermakna

  // Hitung Q1, Q3, IQR
  const q1  = sortedMargins[Math.floor(n * 0.25)];
  const q3  = sortedMargins[Math.floor(n * 0.75)];
  const iqr = q3 - q1;

  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  // Identifikasi outlier
  margins.forEach(s => {
    if (s.margin < lowerFence || s.margin > upperFence) {
      const isHigh = s.margin > upperFence;
      anomalies.push({
        id:        `iqr_${s.subcategory}`,
        type:      "iqr",
        severity:  Math.abs(s.margin) > Math.abs(isHigh ? upperFence * 2 : lowerFence * 2)
                     ? "high" : "medium",
        name:      s.subcategory,
        metric:    "Profit Margin",
        value:     s.margin,
        direction: isHigh ? "outlier-high" : "outlier-low",
        description: isHigh
          ? `${s.subcategory} (${s.category}): margin ${s.margin.toFixed(1)}% jauh di atas batas atas (${upperFence.toFixed(1)}%)`
          : `${s.subcategory} (${s.category}): margin ${s.margin.toFixed(1)}% jauh di bawah batas bawah (${lowerFence.toFixed(1)}%)`,
        recommendation: isHigh
          ? `Margin luar biasa tinggi — analisis apakah pricing optimal atau ada cost yang terlewat.`
          : `Margin sangat rendah atau negatif — audit struktur biaya dan strategi pricing subcategory ini.`,
      });
    }
  });

  return anomalies;
}


// =============================================================================
// BAGIAN 4: MERGE & DEDUPLIKASI
// Gabungkan hasil dua metode, hapus duplikat, urutkan berdasarkan severity.
// =============================================================================

/**
 * Menggabungkan hasil anomali dari Z-score dan IQR.
 * Duplikat dihapus berdasarkan ID unik.
 * Hasil diurutkan: high severity dulu, lalu medium.
 *
 * @param   {Array} zscore - Anomali dari metode Z-score
 * @param   {Array} iqr    - Anomali dari metode IQR
 * @returns {Array} Array anomali gabungan yang unik dan terurut
 */
function mergeAnomalies(zscore, iqr) {
  // Gabungkan dua array
  const all = [...zscore, ...iqr];

  // Hapus duplikat berdasarkan ID
  const seen   = new Set();
  const unique = all.filter(a => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  // Urutkan: high severity dulu, lalu alphabetical berdasarkan nama
  return unique.sort((a, b) => {
    if (a.severity === "high" && b.severity !== "high") return -1;
    if (b.severity === "high" && a.severity !== "high") return  1;
    return a.name.localeCompare(b.name);
  });
}


// =============================================================================
// BAGIAN 5: RENDER KE PANEL
// Tampilkan daftar anomali di elemen #anomaly-list di HTML.
// =============================================================================

/**
 * Merender daftar anomali ke dalam panel #anomaly-list.
 * Jika tidak ada anomali, tampilkan pesan "data normal".
 *
 * @param {Array} anomalies - Array anomali yang sudah diproses dan diurutkan
 */
function renderAnomalyPanel(anomalies) {
  const listEl = document.getElementById("anomaly-list");
  if (!listEl) return;

  // Kosongkan daftar sebelumnya
  listEl.innerHTML = "";

  if (anomalies.length === 0) {
    showNoAnomalyMessage("Tidak ada anomali signifikan terdeteksi — data dalam rentang normal.");
    return;
  }

  // Render setiap anomali sebagai card item
  anomalies.forEach(a => {
    const item = document.createElement("div");
    item.className = "anomaly-item";

    // Warna aksen berdasarkan arah anomali
    const accentColor = a.direction === "spike" || a.direction === "outlier-high"
      ? "#F4D35E"    // kuning untuk nilai sangat tinggi
      : "#E57A44";   // oranye untuk nilai sangat rendah / negatif

    // Badge tipe metode
    const typeBadge = a.type === "zscore"
      ? `<span style="font-size:9px;padding:1px 6px;border-radius:8px;
           background:rgba(2,195,189,0.15);color:#02C3BD;font-weight:700;">
           Z-SCORE</span>`
      : `<span style="font-size:9px;padding:1px 6px;border-radius:8px;
           background:rgba(155,92,255,0.15);color:#9b5cff;font-weight:700;">
           IQR</span>`;

    // Ikon berdasarkan arah anomali
    const icon = a.direction === "spike"        ? "↑" :
                 a.direction === "drop"         ? "↓" :
                 a.direction === "outlier-high" ? "⬆" : "⬇";

    item.innerHTML = `
      <div class="anomaly-name" style="color:${accentColor};
           display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        <span style="font-size:1rem;">${icon}</span>
        <span>${a.name}</span>
        ${typeBadge}
        ${a.severity === "high"
          ? `<span style="font-size:9px;padding:1px 6px;border-radius:8px;
               background:rgba(229,122,68,0.2);color:#E57A44;font-weight:700;">
               HIGH</span>`
          : ""}
      </div>
      <div class="anomaly-value">${a.description}</div>
      <div class="anomaly-narasi">💡 ${a.recommendation}</div>
    `;

    listEl.appendChild(item);
  });

  // Update judul panel dengan jumlah anomali yang ditemukan
  const panelTitle = document.querySelector(".anomaly-panel .panel-title");
  if (panelTitle) {
    panelTitle.textContent = `Deteksi Anomali (${anomalies.length})`;
  }
}

/**
 * Tampilkan pesan ketika tidak ada anomali atau data tidak tersedia.
 * @param {string} message - Pesan yang akan ditampilkan
 */
function showNoAnomalyMessage(message) {
  const listEl = document.getElementById("anomaly-list");
  if (!listEl) return;
  listEl.innerHTML = `
    <div style="color:#606080;font-size:13px;padding:20px 0;text-align:center;
         font-family:'Poppins',sans-serif;">
      ✓ ${message}
    </div>`;
}