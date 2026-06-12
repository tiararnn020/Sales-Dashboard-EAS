// =============================================================================
// js/charts.js — Sales Analytics Dashboard  [v3]
// =============================================================================
//
// FUNGSI FILE INI:
//   Merender semua visualisasi D3.js pada tab AI Dashboard.
//   Setiap chart di-clear dan dibangun ulang dari nol setiap kali dipanggil —
//   tidak ada state tersisa dari render sebelumnya.
//
// DEPENDENSI (harus dimuat di <script> SEBELUM file ini):
//   ├─ D3.js v7    — via CDN di index.html
//   ├─ app.js      — mengisi DATA_* dan ACTIVE_FILTERS, memanggil renderAllCharts()
//   └─ config.js   — formatCurrency(), formatAxis(), formatPercent(), formatNumber()
//
// CHART YANG TERSEDIA:
//   1. renderCategoryChart()   → Grouped Bar   : Sales & Profit per Kategori
//   2. renderTerritoryChart()  → Horizontal Bar : Profitabilitas per Territory
//   3. renderTrendChart()      → Line Chart     : Tren Sales & Profit Bulanan
//   4. renderScatterChart()    → Bubble Chart   : Sales vs Profit per Subcategori
//   5. renderTop10Chart()      → Horizontal Bar : Top 9 Subcategori by Profit
//
// RESPONSIVITAS:
//   Di bawah renderAllCharts(), terdapat IIFE yang memasang window resize listener
//   dengan debounce 250ms. Setiap kali jendela di-resize (split window, rotasi
//   mobile, DevTools panel), semua chart otomatis di-render ulang dengan lebar baru.
//
// CHANGELOG:
//   [v2] renderScatterChart: radius max dikurangi 32→18, legend tanpa background
//   [v3] renderScatterChart: radius max dikurangi lagi 20→14 untuk mengurangi
//        overlap visual 3 bubble di area low-sales (Tires/Bottles/Caps)
//   [v3] renderTop10Chart  : fix label untuk profit negatif mendekati nol —
//        sebelumnya label jatuh di x negatif (luar chart), menimpa sumbu Y
//   [v3] renderAllCharts   : ditambah IIFE resize listener untuk responsivitas
// =============================================================================


// =============================================================================
// BAGIAN 1: PALET WARNA
// =============================================================================

/**
 * Warna fungsional lintas semua chart.
 * @constant {Object}
 * @property {string} sales    - Biru   : revenue/penjualan
 * @property {string} profit   - Teal   : profit/keuntungan
 * @property {string} negative - Oranye : nilai negatif/rugi/anomali
 * @property {string} line1    - Teal   : garis utama line chart (Sales)
 * @property {string} line2    - Kuning : garis sekunder line chart (Profit)
 * @property {string} grid     - Putih sangat transparan : gridline subtle
 * @property {string} axis     - Abu-abu : garis domain dan tick mark
 * @property {string} text     - Abu-abu terang : semua label teks chart
 */
const CHART_COLORS = {
  sales:    "#007CBE",
  profit:   "#02C3BD",
  negative: "#E57A44",
  line1:    "#02C3BD",
  line2:    "#F4D35E",
  grid:     "rgba(255,255,255,0.05)",
  axis:     "#606080",
  text:     "#a0a0c0",
};

/**
 * Warna tetap per kategori produk. Konsisten di scatter, legend, dan bar chart.
 * @constant {Object.<string, string>}
 */
const CATEGORY_COLORS = {
  "Bikes":       "#007CBE",
  "Accessories": "#02C3BD",
  "Clothing":    "#8ED870",
};


// =============================================================================
// BAGIAN 2: SISTEM TOOLTIP (Singleton)
// =============================================================================
// Satu elemen <div> tooltip dipakai bersama seluruh chart.
// Singleton menghindari penumpukan DOM dan masalah z-index stacking.

/** Referensi elemen DOM tooltip. Null sebelum initTooltip() dipanggil. */
let chartTooltip = null;

/**
 * Membuat elemen tooltip global jika belum ada (idempoten — aman dipanggil ulang).
 * position:fixed agar tooltip selalu terlihat di viewport tanpa terpengaruh scroll.
 */
function initTooltip() {
  if (chartTooltip) return;
  chartTooltip = document.createElement("div");
  chartTooltip.style.cssText = `
    position:fixed; background:rgba(8,8,26,0.97); color:#dde8ff;
    border:1px solid rgba(2,195,189,0.4); border-radius:10px;
    padding:10px 14px; font-family:'Poppins',sans-serif; font-size:12px;
    line-height:1.75; pointer-events:none; opacity:0;
    transition:opacity .15s; z-index:9999; max-width:230px;
    backdrop-filter:blur(8px);
  `;
  document.body.appendChild(chartTooltip);
}

/**
 * Menampilkan tooltip dengan konten HTML di posisi kursor.
 * @param {MouseEvent} e    - Event mouse dari D3 listener
 * @param {string}     html - Konten HTML; boleh mengandung <strong>, <span>, <br>
 */
function showTooltip(e, html) {
  if (!chartTooltip) initTooltip();
  chartTooltip.innerHTML = html;
  chartTooltip.style.opacity = "1";
  moveTooltip(e);
}

/**
 * Memperbarui posisi tooltip mengikuti kursor.
 * Offset +14px kanan / -10px atas agar tidak menutupi elemen yang di-hover.
 * @param {MouseEvent} e - Event mouse dari D3 listener
 */
function moveTooltip(e) {
  if (!chartTooltip) return;
  chartTooltip.style.left = (e.clientX + 14) + "px";
  chartTooltip.style.top  = (e.clientY - 10) + "px";
}

/**
 * Menyembunyikan tooltip via opacity 0. Elemen tetap di DOM untuk performa
 * (menghindari create/destroy berulang). Transition CSS berjalan halus.
 */
function hideTooltip() {
  if (chartTooltip) chartTooltip.style.opacity = "0";
}


// =============================================================================
// BAGIAN 3: FUNGSI HELPER SVG
// =============================================================================

/**
 * Menghapus seluruh konten SVG di dalam container chart.
 * innerHTML = "" lebih cepat dari D3 .remove() pada banyak elemen.
 * @param {string} id - ID elemen container (tanpa "#")
 */
function clearChart(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = "";
}

/**
 * Membaca lebar container chart secara dinamis saat render.
 * Menjamin chart responsif — lebar dihitung ulang tiap render (termasuk setelah resize).
 * @param   {string} id      - ID elemen container (tanpa "#")
 * @returns {number} Lebar container dalam pixel. Fallback 500px jika tidak ditemukan.
 */
function getW(id) {
  const el = document.getElementById(id);
  return el ? (el.clientWidth || 500) : 500;
}

/**
 * Menambahkan gridline horizontal ke dalam chart.
 * Teknik: tickSize(-width) → tick memanjang ke kanan sebesar width px,
 * menghasilkan garis horizontal yang melintasi seluruh area plotting.
 * tickFormat("") → hanya garis, tanpa label angka.
 *
 * @param {d3.Selection}   svg    - Elemen <g> utama (BUKAN elemen <svg>)
 * @param {d3.ScaleLinear} yScale - Scale vertikal yang sudah dikonfigurasi
 * @param {number}         width  - Lebar plotting area dalam pixel
 */
function addGrid(svg, yScale, width) {
  svg.append("g").attr("class", "grid")
    .call(d3.axisLeft(yScale).ticks(5).tickSize(-width).tickFormat(""))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll(".tick line")
      .attr("stroke", CHART_COLORS.grid)
      .attr("stroke-dasharray", "3,3"));
}

/**
 * Mendefinisikan linearGradient di dalam <defs> SVG.
 *
 * ⚠️ PENTING: Harus dipanggil ulang setiap render karena clearChart() menghapus
 * seluruh SVG termasuk <defs>. Gradient yang tidak didefinisikan ulang akan
 * menghasilkan fill kosong/hitam.
 *
 * @param   {d3.Selection} defs      - Elemen <defs> SVG chart aktif
 * @param   {string}       id        - ID unik gradient (scope per SVG)
 * @param   {string}       c1        - Warna awal/terang (hex/rgb/named)
 * @param   {string}       c2        - Warna akhir/gelap (hex/rgb/named)
 * @param   {string}       [dir="v"] - "v" = vertikal atas→bawah, "h" = horizontal kiri→kanan
 * @returns {string}  "url(#<id>)" — siap dipakai sebagai nilai fill/stroke
 */
function defGrad(defs, id, c1, c2, dir = "v") {
  const g = defs.append("linearGradient").attr("id", id)
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", dir === "h" ? "100%" : "0%")
    .attr("y2", dir === "v" ? "100%" : "0%");
  g.append("stop").attr("offset", "0%")
    .attr("stop-color", c1).attr("stop-opacity", "1");
  g.append("stop").attr("offset", "100%")
    .attr("stop-color", c2).attr("stop-opacity", "0.9");
  return `url(#${id})`;
}


// =============================================================================
// BAGIAN 4: ENTRY POINT & RESIZE LISTENER
// =============================================================================

/**
 * Merender semua chart secara berurutan.
 * Dipanggil oleh app.js dalam tiga situasi:
 *   1. Data selesai dimuat pertama kali
 *   2. Filter berubah (tahun/kategori/territory)
 *   3. Window di-resize (via IIFE resize listener di bawah)
 */
function renderAllCharts() {
  initTooltip();
  renderCategoryChart();
  renderTerritoryChart();
  renderTrendChart();
  renderScatterChart();
  renderTop10Chart();
}

// ── Debounced Resize Listener ────────────────────────────────────────────────
// IIFE (Immediately Invoked Function Expression) agar variabel timer
// tidak mencemari scope global.
//
// Cara kerja debounce:
//   1. Setiap event "resize" masuk → clearTimeout() + set timer baru 250ms
//   2. Selama resize berlanjut → timer terus di-reset (tidak ada render)
//   3. Setelah resize berhenti 250ms → renderAllCharts() dipanggil SEKALI
//
// Guard: cek DATA_CATEGORY tersedia agar tidak render sebelum app.js selesai load.
//
// Kasus yang ditangani otomatis:
//   ✓ Split-window browser (viewport mengecil mendadak)
//   ✓ Maximize / restore window
//   ✓ Orientasi rotasi pada mobile
//   ✓ DevTools panel dibuka/ditutup (mengubah lebar viewport)
(function setupResizeListener() {
  let _timer = null;
  window.addEventListener("resize", () => {
    clearTimeout(_timer);
    _timer = setTimeout(() => {
      if (typeof DATA_CATEGORY !== "undefined" && DATA_CATEGORY?.length) {
        renderAllCharts();
      }
    }, 250);
  });
})();


// =============================================================================
// CHART 1 — Grouped Bar: Sales & Profit per Kategori
// =============================================================================
// Dua bar berdampingan per kategori: Sales (dominan) + Profit (opacity 0.85).
// Gradient unik per kategori untuk identifikasi visual tanpa butuh membaca label.
// DATA: DATA_CATEGORY — { category, sales, profit, margin, orders }
// =============================================================================

function renderCategoryChart() {
  const cid = "chart-category";
  clearChart(cid);
  if (!DATA_CATEGORY?.length) return;

  const data   = (FILTERED_CATEGORY?.length) ? FILTERED_CATEGORY : DATA_CATEGORY;
  const margin = { top:28, right:24, bottom:46, left:80 };
  const W      = getW(cid);
  const width  = W - margin.left - margin.right;
  const height = 300 - margin.top - margin.bottom;

  const svg = d3.select(`#${cid}`).append("svg")
    .attr("width", W).attr("height", height + margin.top + margin.bottom)
    .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // Gradient vertikal: terang atas (0%) → gelap bawah (100%)
  const defs = svg.append("defs");
  defGrad(defs, "gBikesS", "#7AD4FF", "#003A75");   // Sales Bikes: biru
  defGrad(defs, "gAccS",   "#7AE8E4", "#2D0B6B");   // Sales Accessories: teal
  defGrad(defs, "gCloS",   "#C8E87A", "#1A3A08");   // Sales Clothing: hijau
  defGrad(defs, "gBikesP", "#A8FFF8", "#004A5C");   // Profit Bikes: cyan
  defGrad(defs, "gAccP",   "#C8FFF8", "#003040");   // Profit Accessories: putih-teal
  defGrad(defs, "gCloP",   "#EAFFA8", "#1A3808");   // Profit Clothing: kuning-hijau

  const salesGrads  = { Bikes:"url(#gBikesS)", Accessories:"url(#gAccS)",  Clothing:"url(#gCloS)" };
  const profitGrads = { Bikes:"url(#gBikesP)", Accessories:"url(#gAccP)", Clothing:"url(#gCloP)" };

  // x0 = skala grup (per kategori), x1 = skala bar dalam grup (sales/profit)
  // y  = nilai numerik → tinggi bar (domain max + 15% ruang atas)
  const x0 = d3.scaleBand().domain(data.map(d => d.category))
    .range([0, width]).paddingInner(0.38).paddingOuter(0.18);
  const x1 = d3.scaleBand().domain(["sales", "profit"])
    .range([0, x0.bandwidth()]).padding(0.08);
  const y  = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.sales) * 1.15]).range([height, 0]);

  addGrid(svg, y, width);

  svg.append("g").attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x0).tickSize(0))
    .call(g => g.select(".domain").attr("stroke", "rgba(255,255,255,0.1)"))
    .selectAll("text").attr("fill", CHART_COLORS.text)
      .attr("font-size", "12px").attr("font-family", "'Poppins',sans-serif");

  svg.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(formatAxis).tickSize(0))
    .call(g => g.select(".domain").remove())
    .selectAll("text").attr("fill", CHART_COLORS.text)
      .attr("font-size", "11px").attr("font-family", "'Poppins',sans-serif");

  // Satu <g> per kategori, digeser ke posisi x0(kategori)
  const grp = svg.selectAll(".cg").data(data).join("g").attr("class", "cg")
    .attr("transform", d => `translate(${x0(d.category)},0)`);

  // Bar Sales
  grp.append("rect")
    .attr("x", () => x1("sales")).attr("y", d => y(d.sales))
    .attr("width", x1.bandwidth()).attr("height", d => height - y(d.sales))
    .attr("fill", d => salesGrads[d.category] || CHART_COLORS.sales)
    .attr("rx", 4)
    .on("mouseover", (e, d) => showTooltip(e,
      `<strong style="color:#38BDFF">${d.category}</strong><br>
       Revenue: <strong>${formatCurrency(d.sales)}</strong><br>
       Orders: ${formatNumber(d.orders)}`))
    .on("mousemove", moveTooltip).on("mouseout", hideTooltip);

  // Bar Profit — Math.max(0, profit) mencegah bar keluar ke atas jika negatif
  grp.append("rect")
    .attr("x", () => x1("profit")).attr("y", d => y(Math.max(0, d.profit)))
    .attr("width", x1.bandwidth()).attr("height", d => Math.abs(y(d.profit) - y(0)))
    .attr("fill", d => profitGrads[d.category] || CHART_COLORS.profit)
    .attr("rx", 4).attr("opacity", 0.85)
    .on("mouseover", (e, d) => showTooltip(e,
      `<strong style="color:#02C3BD">${d.category}</strong><br>
       Profit: <strong>${formatCurrency(d.profit)}</strong><br>
       Margin: ${formatPercent(d.margin)}`))
    .on("mousemove", moveTooltip).on("mouseout", hideTooltip);

  // Label nilai di atas bar (-8px dari puncak agar tidak menempel)
  grp.append("text")
    .attr("x", () => x1("sales") + x1.bandwidth() / 2)
    .attr("y", d => y(d.sales) - 8)
    .attr("text-anchor", "middle")
    .attr("fill", "#c0d8ff").attr("font-size", "11px")
    .attr("font-family", "'Syne',sans-serif").attr("font-weight", "700")
    .text(d => formatAxis(d.sales));

  grp.append("text")
    .attr("x", () => x1("profit") + x1.bandwidth() / 2)
    .attr("y", d => y(d.profit) - 8)
    .attr("text-anchor", "middle")
    .attr("fill", "#a0e8e0").attr("font-size", "10px")
    .attr("font-family", "'Poppins',sans-serif")
    .text(d => formatAxis(d.profit));

  // Legend: Revenue dan Profit menggunakan sample gradient Bikes
  const leg = svg.append("g").attr("transform", `translate(${width - 110},4)`);
  [["url(#gBikesS)", "Revenue"], ["url(#gBikesP)", "Profit"]].forEach(([fill, lbl], i) => {
    const g = leg.append("g").attr("transform", `translate(0,${i * 20})`);
    g.append("rect").attr("width", 14).attr("height", 14).attr("rx", 3).attr("fill", fill);
    g.append("text").attr("x", 18).attr("y", 11)
      .attr("fill", CHART_COLORS.text).attr("font-size", "11px")
      .attr("font-family", "'Poppins',sans-serif").text(lbl);
  });
}


// =============================================================================
// CHART 2 — Horizontal Bar: Profitabilitas per Territory
// =============================================================================
// Diurutkan sales tertinggi di atas. Warna menunjukkan rentang profit margin:
//   Teal  → margin ≥ 15%  |  Biru → 8–15%  |  Oranye → < 8%
// DATA: DATA_TERRITORY — { territory, sales, profit, margin, customers }
// =============================================================================

function renderTerritoryChart() {
  const cid = "chart-territory";
  clearChart(cid);
  if (!DATA_TERRITORY?.length) return;

  const raw  = (FILTERED_TERRITORY?.length) ? FILTERED_TERRITORY : DATA_TERRITORY;
  const data = [...raw].sort((a,b) => b.sales - a.sales);
  const margin = { top:10, right:70, bottom:34, left:108 };
  const W      = getW(cid);
  const width  = W - margin.left - margin.right;
  const rowH   = 30;
  const height = data.length * rowH;

  const svg = d3.select(`#${cid}`).append("svg")
    .attr("width", W).attr("height", height + margin.top + margin.bottom)
    .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // Gradient horizontal: terang di kiri (pangkal) → gelap di kanan (ujung bar)
  const defs = svg.append("defs");
  defGrad(defs, "gTerPos", "#7AE8E4", "#2D0B6B", "h");  // margin ≥ 15%
  defGrad(defs, "gTerMid", "#7AD4FF", "#003A75", "h");  // margin 8–15%
  defGrad(defs, "gTerNeg", "#FFB870", "#2A0A00", "h");  // margin < 8%

  const y = d3.scaleBand().domain(data.map(d => d.territory))
    .range([0, height]).padding(0.32);
  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.sales) * 1.1]).range([0, width]);

  svg.append("g")
    .call(d3.axisLeft(y).tickSize(0))
    .call(g => g.select(".domain").remove())
    .selectAll("text").attr("fill", CHART_COLORS.text)
      .attr("font-size", "11px").attr("font-family", "'Poppins',sans-serif");

  svg.append("g").attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat(formatAxis).tickSize(3))
    .call(g => g.select(".domain").attr("stroke", "rgba(255,255,255,0.1)"))
    .selectAll("text").attr("fill", CHART_COLORS.text)
      .attr("font-size", "10px").attr("font-family", "'Poppins',sans-serif");

  svg.selectAll(".tb").data(data).join("rect").attr("class", "tb")
    .attr("y", d => y(d.territory)).attr("height", y.bandwidth())
    .attr("x", 0).attr("width", d => x(d.sales))
    .attr("fill", d =>
      d.margin >= 15 ? "url(#gTerPos)" :
      d.margin >= 8  ? "url(#gTerMid)" : "url(#gTerNeg)")
    .attr("rx", 4)
    .on("mouseover", (e, d) => showTooltip(e,
      `<strong style="color:#02C3BD">${d.territory}</strong><br>
       Sales: <strong>${formatCurrency(d.sales)}</strong><br>
       Profit: ${formatCurrency(d.profit)}<br>
       Margin: <strong>${formatPercent(d.margin)}</strong><br>
       Customers: ${formatNumber(d.customers)}`))
    .on("mousemove", moveTooltip).on("mouseout", hideTooltip);

  // Label margin di dalam bar — hanya jika bar ≥ 80px lebar
  svg.selectAll(".tm").data(data).join("text").attr("class", "tm")
    .attr("x", d => Math.min(x(d.sales) - 8, x(d.sales) - 2))
    .attr("y", d => y(d.territory) + y.bandwidth() / 2 + 4)
    .attr("text-anchor", "end")
    .attr("fill", "rgba(255,255,255,0.85)")
    .attr("font-size", "10px").attr("font-family", "'Syne',sans-serif")
    .attr("font-weight", "700")
    .text(d => x(d.sales) > 80 ? formatPercent(d.margin) : "");

  // Label nilai Sales di luar bar (kanan, +6px dari ujung bar)
  svg.selectAll(".tv").data(data).join("text").attr("class", "tv")
    .attr("x", d => x(d.sales) + 6)
    .attr("y", d => y(d.territory) + y.bandwidth() / 2 + 4)
    .attr("fill", CHART_COLORS.text)
    .attr("font-size", "10px").attr("font-family", "'Poppins',sans-serif")
    .text(d => formatAxis(d.sales));
}


// =============================================================================
// CHART 3 — Line Chart: Tren Sales & Profit Bulanan
// =============================================================================
// Sales: garis solid teal + area teal transparan.
// Profit: garis kuning putus-putus + area kuning transparan.
// Mendukung filter tahun via ACTIVE_FILTERS.year.
// DATA: DATA_TREND — { label, year, sales, profit, orders }
// =============================================================================

function renderTrendChart() {
  const cid = "chart-trend";
  clearChart(cid);
  if (!DATA_TREND?.length) return;

  let data = DATA_TREND;
  if (ACTIVE_FILTERS.year !== "all")
    data = data.filter(d => String(d.year) === ACTIVE_FILTERS.year);
  if (!data.length) return;

  const margin = { top:28, right:28, bottom:54, left:78 };
  const W      = getW(cid);
  const width  = W - margin.left - margin.right;
  const height = 310 - margin.top - margin.bottom;

  const svg = d3.select(`#${cid}`).append("svg")
    .attr("width", W).attr("height", height + margin.top + margin.bottom)
    .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // Gradient area vertikal: warna solid di atas → hampir transparan di bawah
  const defs = svg.append("defs");
  const ag1  = defs.append("linearGradient").attr("id", "trendA1")
    .attr("x1","0%").attr("y1","0%").attr("x2","0%").attr("y2","100%");
  ag1.append("stop").attr("offset","0%")
    .attr("stop-color","#02C3BD").attr("stop-opacity","0.30");
  ag1.append("stop").attr("offset","100%")
    .attr("stop-color","#02C3BD").attr("stop-opacity","0.01");

  const ag2 = defs.append("linearGradient").attr("id","trendA2")
    .attr("x1","0%").attr("y1","0%").attr("x2","0%").attr("y2","100%");
  ag2.append("stop").attr("offset","0%")
    .attr("stop-color","#F4D35E").attr("stop-opacity","0.20");
  ag2.append("stop").attr("offset","100%")
    .attr("stop-color","#F4D35E").attr("stop-opacity","0.01");

  // scalePoint: interval merata untuk time series (tidak butuh lebar band seperti scaleBand)
  const x = d3.scalePoint().domain(data.map(d => d.label))
    .range([0, width]).padding(0.1);
  const maxVal = d3.max(data, d => Math.max(d.sales, d.profit));
  const y = d3.scaleLinear().domain([0, maxVal * 1.15]).range([height, 0]);

  addGrid(svg, y, width);

  // Sumbu X: max ~8 label (rotasi -35°) agar tidak bertumpukan
  const iv = Math.ceil(data.length / 8);
  svg.append("g").attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x)
      .tickValues(data.filter((_, i) => i % iv === 0).map(d => d.label))
      .tickSize(4))
    .call(g => g.select(".domain").attr("stroke","rgba(255,255,255,0.1)"))
    .selectAll("text").attr("fill",CHART_COLORS.text)
      .attr("font-size","10px").attr("font-family","'Poppins',sans-serif")
      .attr("transform","rotate(-35)").attr("text-anchor","end");

  svg.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(formatAxis).tickSize(0))
    .call(g => g.select(".domain").remove())
    .selectAll("text").attr("fill",CHART_COLORS.text)
      .attr("font-size","11px").attr("font-family","'Poppins',sans-serif");

  // Factory function: generator area dan garis per key ("sales"/"profit")
  const makeArea = key => d3.area()
    .x(d => x(d.label)).y0(height).y1(d => y(d[key]))
    .curve(d3.curveMonotoneX);
  const makeLine = key => d3.line()
    .x(d => x(d.label)).y(d => y(d[key]))
    .curve(d3.curveMonotoneX);

  // Area dulu (belakang), garis di atasnya
  svg.append("path").datum(data).attr("fill","url(#trendA1)").attr("d",makeArea("sales"));
  svg.append("path").datum(data)
    .attr("fill","none").attr("stroke","#02C3BD").attr("stroke-width",2.5)
    .attr("d",makeLine("sales"));

  svg.append("path").datum(data).attr("fill","url(#trendA2)").attr("d",makeArea("profit"));
  svg.append("path").datum(data)
    .attr("fill","none").attr("stroke","#F4D35E")
    .attr("stroke-width",2).attr("stroke-dasharray","5,3")
    .attr("d",makeLine("profit"));

  // Titik lingkaran kecil di tiap data point Sales sebagai anchor hover presisi
  svg.selectAll(".td").data(data).join("circle").attr("class","td")
    .attr("cx",d=>x(d.label)).attr("cy",d=>y(d.sales))
    .attr("r",3).attr("fill","#02C3BD")
    .attr("stroke","#08081a").attr("stroke-width",1.5)
    .on("mouseover",(e,d)=>showTooltip(e,
      `<strong style="color:#02C3BD">${d.label}</strong><br>
       Sales: <strong>${formatCurrency(d.sales)}</strong><br>
       Profit: ${formatCurrency(d.profit)}<br>
       Orders: ${formatNumber(d.orders)}`))
    .on("mousemove",moveTooltip).on("mouseout",hideTooltip);

  // Legend: garis solid (Sales) dan putus-putus (Profit)
  const leg = svg.append("g").attr("transform",`translate(${width-100},0)`);
  [["#02C3BD","Sales","none"],["#F4D35E","Profit","4,2"]].forEach(([col,lbl,dash],i) => {
    const g = leg.append("g").attr("transform",`translate(0,${i*20})`);
    g.append("line").attr("x1",0).attr("y1",7).attr("x2",20).attr("y2",7)
      .attr("stroke",col).attr("stroke-width",2)
      .attr("stroke-dasharray",dash==="none"?"":dash);
    g.append("text").attr("x",24).attr("y",11)
      .attr("fill",CHART_COLORS.text).attr("font-size","11px")
      .attr("font-family","'Poppins',sans-serif").text(lbl);
  });
}


// =============================================================================
// CHART 4 — Bubble Chart: Sales vs Profit per Subcategori  [v3]
// =============================================================================
// Posisi X → Sales, Posisi Y → Profit, Radius → Qty (scaleSqrt), Warna → Kategori
//
// CATATAN DATA — Mengapa 3 bubble menumpuk di kiri bawah?
//   BUKAN bug. Ini adalah data insight yang valid.
//   Tires/Bottles/Caps memiliki sales < $200K vs Mountain Bikes ~$3M.
//   Pada linear scale, mereka terkompres di ~7% pertama sumbu X.
//   Koordinat (sales, profit) mereka memang berdekatan di data asli.
//   Ini menggambarkan dominasi kategori Bikes yang sangat besar.
//   Solusi yang tepat adalah mengurangi radius bubble (sudah dilakukan di v3)
//   agar overlap visual berkurang — bukan mengubah scale karena itu distorsi data.
//
// [v3] Range radius: [5,20] → [4,14]
//   Luas max: π·14² ≈ 615px² (vs π·20² ≈ 1257px² sebelumnya, 2x lebih kecil)
//   Bubble terbesar tidak lagi mendominasi dan menimpa tetangganya.
//
// DATA: DATA_SUBCATEGORY — { subcategory, category, sales, profit, margin, qty }
// =============================================================================

function renderScatterChart() {
  const cid = "chart-scatter";
  clearChart(cid);

  // DATA_SUBCATEGORY (bukan per-produk) agar titik lebih sedikit dan bermakna.
  // Per-produk menghasilkan terlalu banyak titik yang bertumpukan dan susah dibaca.
  if (!DATA_SUBCATEGORY?.length) return;
  const data = DATA_SUBCATEGORY;

  const margin = { top:20, right:28, bottom:50, left:82 };
  const W      = getW(cid);
  const width  = W - margin.left - margin.right;
  // Tinggi proporsional terhadap jumlah data agar chart tidak terlalu padat
  const svgH   = Math.max(280, data.length * 22 + margin.top + margin.bottom);
  const height = svgH - margin.top - margin.bottom;

  const svg = d3.select(`#${cid}`).append("svg")
    .attr("width", W).attr("height", svgH)
    .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // ── Skala ─────────────────────────────────────────────────────────────────
  // scaleSqrt untuk radius: WAJIB agar LUAS area ∝ qty, bukan radius.
  // Tanpa ini, bubble besar terasa jauh lebih besar dari seharusnya secara persepsi.
  // [v3] range [4,14] — lebih kecil dari [5,20] sebelumnya untuk mengurangi overlap
  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.sales) * 1.12]).range([0, width]);
  const minP = d3.min(data, d => d.profit);
  const maxP = d3.max(data, d => d.profit);
  const y    = d3.scaleLinear()
    .domain([Math.min(minP * 1.15, -5000), maxP * 1.15]).range([height, 0]);
  const r    = d3.scaleSqrt()
    .domain([0, d3.max(data, d => d.qty)])
    .range([4, 14]);  // [v3] dikurangi dari [5,20]

  addGrid(svg, y, width);

  // Garis referensi profit=0: memisahkan zona untung (atas) dan rugi (bawah)
  svg.append("line")
    .attr("x1",0).attr("y1",y(0))
    .attr("x2",width).attr("y2",y(0))
    .attr("stroke","rgba(229,122,68,0.4)").attr("stroke-dasharray","4,4");

  svg.append("g").attr("transform",`translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(formatAxis).tickSize(3))
    .call(g=>g.select(".domain").attr("stroke","rgba(255,255,255,0.1)"))
    .selectAll("text").attr("fill",CHART_COLORS.text)
      .attr("font-size","10px").attr("font-family","'Poppins',sans-serif");

  svg.append("g")
    .call(d3.axisLeft(y).ticks(5).tickFormat(formatAxis).tickSize(0))
    .call(g=>g.select(".domain").remove())
    .selectAll("text").attr("fill",CHART_COLORS.text)
      .attr("font-size","10px").attr("font-family","'Poppins',sans-serif");

  svg.append("text").attr("x",width/2).attr("y",height+42)
    .attr("text-anchor","middle").attr("fill",CHART_COLORS.text)
    .attr("font-size","11px").attr("font-family","'Poppins',sans-serif")
    .text("Total Sales (USD)");
  svg.append("text").attr("transform","rotate(-90)")
    .attr("x",-height/2).attr("y",-62)
    .attr("text-anchor","middle").attr("fill",CHART_COLORS.text)
    .attr("font-size","11px").attr("font-family","'Poppins',sans-serif")
    .text("Total Profit (USD)");

  // Render bubble
  svg.selectAll(".sd").data(data).join("circle").attr("class","sd")
    .attr("cx",d=>x(d.sales)).attr("cy",d=>y(d.profit))
    .attr("r",d=>r(d.qty))
    .attr("fill",d=>CATEGORY_COLORS[d.category]||"#A8FFF8")
    .attr("opacity",0.78)
    .attr("stroke","rgba(255,255,255,0.2)").attr("stroke-width",1.5)
    .on("mouseover",(e,d)=>showTooltip(e,
      `<strong style="color:#02C3BD">${d.subcategory}</strong><br>
       <span style="color:#888">${d.category}</span><br>
       Sales: <strong>${formatCurrency(d.sales)}</strong><br>
       Profit: <strong>${formatCurrency(d.profit)}</strong><br>
       Margin: ${formatPercent(d.margin)}<br>
       Qty: ${formatNumber(d.qty)}`))
    .on("mousemove",moveTooltip).on("mouseout",hideTooltip);

  // ── Label Subcategory dengan Anti-Overlap ─────────────────────────────────
  // Algoritma sederhana:
  //   1. Posisi awal: x = tepi kanan bubble + 5px
  //   2. Urutkan label by posisi Y (atas ke bawah)
  //   3. Jika label terlalu dekat vertikal (< 13px), geser yang bawah ke bawah
  const labeled = data.map(d => ({
    ...d,
    lx: x(d.sales) + r(d.qty) + 5,
    ly: y(d.profit)
  })).sort((a, b) => a.ly - b.ly);

  for (let i = 1; i < labeled.length; i++) {
    if (labeled[i].ly - labeled[i-1].ly < 13)
      labeled[i].ly = labeled[i-1].ly + 13;
  }

  svg.selectAll(".sl").data(labeled).join("text").attr("class","sl")
    .attr("x",d=>d.lx)
    .attr("y",d=>d.ly+4)
    .attr("fill","#dde8ff").attr("font-size","9.5px")
    .attr("font-family","'Poppins',sans-serif").attr("font-weight","600")
    .text(d=>d.subcategory);

  // ── Legend HTML (di bawah SVG) ────────────────────────────────────────────
  // Menggunakan <div> HTML agar legend tidak mengganggu area plotting SVG.
  // Legend tanpa background agar menyatu dengan tema dashboard.
  const cats   = [...new Set(data.map(d => d.category))];
  const legDiv = document.createElement("div");
  legDiv.style.cssText =
    "display:flex;gap:20px;justify-content:center;padding:10px 0 2px;flex-wrap:wrap;";
  cats.forEach(cat => {
    const item = document.createElement("div");
    item.style.cssText = "display:flex;align-items:center;gap:6px;";
    item.innerHTML =
      `<span style="width:10px;height:10px;border-radius:50%;` +
      `background:${CATEGORY_COLORS[cat]||'#aaa'};display:inline-block;"></span>` +
      `<span style="font-family:'Poppins',sans-serif;font-size:11px;` +
      `color:#a0a0c0;">${cat}</span>`;
    legDiv.appendChild(item);
  });
  document.getElementById(cid).appendChild(legDiv);
}


// =============================================================================
// CHART 5 — Horizontal Bar: Top 9 Subcategori by Profit  [v3]
// =============================================================================
// Bar positif (profit ≥ 0) → gradient teal-ke-ungu, label di kanan.
// Bar negatif (rugi < 0)   → gradient oranye-ke-gelap, label di kiri.
// Garis vertikal x=0 memisahkan zona profit dan rugi.
//
// MENGAPA DATA_SUBCATEGORY bukan DATA_TOP10?
//   DATA_TOP10 berisi data per ProductName. Banyak produk berbagi subcategory
//   → duplikasi bar dan label di sumbu Y. DATA_SUBCATEGORY sudah unik per subcat.
//
// PERBAIKAN [v3] — Root cause label "Caps" (dan kasus profit negatif mendekati nol):
//
//   Dari DevTools: text.t101 memiliki x="-5.97" dan fill="#FFB870" (oranye).
//   Ini berarti "Caps" memiliki profit NEGATIF kecil (~-$1K), bukan nol.
//
//   Kode lama: x = x(d.profit) - 6
//   Untuk profit ≈ -$1K, dengan domain [Math.min(-1100,0), maxP]:
//     x(-1000) ≈ 0.03px → 0.03 - 6 = -5.97px (NEGATIF, luar chart!)
//   SVG tidak memiliki clipPath default → label tetap dirender di margin area,
//   tepat menimpa label "Caps" di sumbu Y.
//
//   FIX: Jika barPx < 10 (bar hampir tak terlihat), posisikan label
//   di kanan x(0)+8, bukan di kiri. Sama seperti profit positif sangat kecil.
//
// DATA: DATA_SUBCATEGORY — { subcategory, category, profit, sales, margin }
// =============================================================================

function renderTop10Chart() {
  const cid = "chart-top10";
  clearChart(cid);
  if (!DATA_SUBCATEGORY?.length) return;

  const data = [...DATA_SUBCATEGORY]
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 9);

  const margin = { top:10, right:85, bottom:34, left:130 };
  const W      = getW(cid);
  const width  = W - margin.left - margin.right;
  const rowH   = 34;
  const height = data.length * rowH;

  const svg = d3.select(`#${cid}`).append("svg")
    .attr("width", W).attr("height", height + margin.top + margin.bottom)
    .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // Gradient horizontal: terang di kiri (pangkal bar) → gelap di kanan (ujung)
  const defs = svg.append("defs");
  defGrad(defs, "t10Pos", "#7AE8E4", "#2D0B6B", "h");  // profit positif: teal→ungu
  defGrad(defs, "t10Neg", "#FFB870", "#2A0A00", "h");   // profit negatif: oranye→gelap

  const y = d3.scaleBand()
    .domain(data.map(d => d.subcategory))
    .range([0, height]).padding(0.3);

  const minP = d3.min(data, d => d.profit);
  const maxP = d3.max(data, d => d.profit);
  const x = d3.scaleLinear()
    .domain([Math.min(minP * 1.1, 0), maxP * 1.15])  // domain selalu mencakup 0
    .range([0, width]);

  // Garis vertikal x=0: batas pemisah zona profit dan rugi
  svg.append("line")
    .attr("x1",x(0)).attr("y1",0)
    .attr("x2",x(0)).attr("y2",height)
    .attr("stroke","rgba(255,255,255,0.12)")
    .attr("stroke-dasharray","3,3");

  // Sumbu Y: nama subcategory
  svg.append("g")
    .call(d3.axisLeft(y).tickSize(0))
    .call(g=>g.select(".domain").remove())
    .selectAll("text").attr("fill",CHART_COLORS.text)
      .attr("font-size","11px").attr("font-family","'Poppins',sans-serif");

  // Sumbu X: nilai profit
  svg.append("g").attr("transform",`translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat(formatAxis).tickSize(0))
    .call(g=>g.select(".domain").attr("stroke","rgba(255,255,255,0.1)"))
    .selectAll("text").attr("fill",CHART_COLORS.text)
      .attr("font-size","10px").attr("font-family","'Poppins',sans-serif");

  // Bars
  svg.selectAll(".t10b").data(data).join("rect").attr("class","t10b")
    .attr("y",      d=>y(d.subcategory))
    .attr("height", y.bandwidth())
    .attr("x",      d=>d.profit>=0 ? x(0) : x(d.profit))
    .attr("width",  d=>Math.abs(x(d.profit)-x(0)))
    .attr("fill",   d=>d.profit>=0 ? "url(#t10Pos)" : "url(#t10Neg)")
    .attr("rx",4)
    .on("mouseover",(e,d)=>showTooltip(e,
      `<strong style="color:#02C3BD">${d.subcategory}</strong><br>
       <span style="color:#888">${d.category}</span><br>
       Profit: <strong>${formatCurrency(d.profit)}</strong><br>
       Sales: ${formatCurrency(d.sales)}<br>
       Margin: ${formatPercent(d.margin)}`))
    .on("mousemove",moveTooltip).on("mouseout",hideTooltip);

  // ── Label Nilai Profit  [v3 FIX] ──────────────────────────────────────────
  // Kalkulasi barPx = lebar bar dalam pixel, dipakai untuk keputusan posisi.
  //
  //   POSITIF:
  //     → Math.max(x(profit)+6, x(0)+12): label min 12px dari origin x
  //
  //   NEGATIF, barPx ≥ 10px (bar cukup terlihat):
  //     → x(profit)-6: label di kiri ujung bar (behavior normal)
  //
  //   NEGATIF, barPx < 10px (bar hampir tak terlihat, profit ~0):
  //     → x(0)+8: label di kanan x(0) ← INI YANG FIX MASALAH "CAPS"
  //     x(profit)-6 menghasilkan nilai negatif → label keluar chart ke kiri
  svg.selectAll(".t10l").data(data).join("text").attr("class","t10l")
    .attr("y", d=>y(d.subcategory)+y.bandwidth()/2+4)
    .attr("x", d => {
      const barPx = Math.abs(x(d.profit) - x(0));
      if (d.profit >= 0) {
        return Math.max(x(d.profit) + 6, x(0) + 12);
      }
      // Negatif mendekati nol: bar < 10px → pindahkan label ke kanan
      if (barPx < 10) return x(0) + 8;
      return x(d.profit) - 6;
    })
    .attr("text-anchor", d => {
      if (d.profit >= 0) return "start";
      return Math.abs(x(d.profit) - x(0)) < 10 ? "start" : "end";
    })
    .attr("fill",  d=>d.profit>=0 ? "#7AE8E4" : "#FFB870")
    .attr("font-size","10px").attr("font-family","'Syne',sans-serif")
    .attr("font-weight","700")
    .text(d=>formatAxis(Math.abs(d.profit)));  // abs: tampilkan magnitude, bukan minus
}
