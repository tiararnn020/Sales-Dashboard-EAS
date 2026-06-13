// =============================================================================
// js/aiInsight.js
// Integrasi AI Insight menggunakan Groq API (LLaMA 3.1 8B Instant).
//
// CARA KERJA:
// 1. User klik tombol insight → initAIButtons() menangkap event
// 2. buildDataContext() merangkum data dashboard jadi teks ringkas
// 3. buildPrompt() menyusun instruksi + konteks data untuk AI
// 4. callGroqAPI() mengirim request ke Groq dan mengembalikan teks respons
// 5. typewriterEffect() menampilkan respons dengan animasi ketik
//
// DEPENDENSI:
//   config.js → CONFIG.GROQ_API_KEY, CONFIG.GROQ_MODEL, CONFIG.GROQ_MAX_TOKENS
//   app.js    → DATA_KPI, DATA_CATEGORY, DATA_TERRITORY, DATA_TREND,
//               ACTIVE_FILTERS, FILTERED_CATEGORY, FILTERED_TERRITORY
// =============================================================================


// =============================================================================
// BAGIAN 1: INISIALISASI TOMBOL AI
// Dipasang saat halaman siap, menangkap klik dari semua tombol insight.
// =============================================================================

/**
 * Pasang event listener ke semua tombol AI di panel insight.
 * Dipanggil oleh initDashboard() di app.js setelah data selesai dimuat.
 */
function initAIButtons() {

  // ── Tombol utama: "✦ Minta Insight Menyeluruh" ──
  const btnMain = document.getElementById("btn-insight");
  if (btnMain) {
    btnMain.addEventListener("click", () => {
      getAIInsight("general");
    });
  }

  // ── Tombol quick question ──
  // Setiap tombol punya atribut data-question
  // yang menentukan jenis pertanyaan ke AI
  document.querySelectorAll(".btn-insight-quick").forEach(btn => {
    btn.addEventListener("click", () => {
      const q = btn.getAttribute("data-question");
      getAIInsight(q);
    });
  });

  console.log("[aiInsight.js] Tombol AI siap ✓");
}


// =============================================================================
// BAGIAN 2: FUNGSI UTAMA — GET AI INSIGHT
// Orkestrasi seluruh alur: build context → build prompt → call API → display
// =============================================================================

/**
 * Mendapatkan insight dari Groq AI berdasarkan jenis pertanyaan.
 *
 * @param {string} questionType - "general" | "anomali" | "produk" | "wilayah"
 */
async function getAIInsight(questionType = "general") {

  // Cek API key tersedia
  if (!hasGroqApiKey()) {
    displayAIResponse(
      "⚠ API key belum diatur. Klik tombol <strong>⚙ API Key</strong> " +
      "di navbar untuk memasukkan Groq API key-mu.",
      true
    );
    return;
  }

  // Tampilkan loading, nonaktifkan tombol
  setAILoading(true);

  try {
    // 1. Rangkum data dashboard jadi konteks teks
    const context = buildDataContext();

    // 2. Susun prompt sesuai jenis pertanyaan
    const prompt  = buildPrompt(questionType, context);

    // 3. Panggil Groq API
    const response = await callGroqAPI(prompt);

    // 4. Tampilkan dengan animasi ketik
    typewriterEffect("ai-response", response);

  } catch (err) {
    // Tampilkan error yang informatif
    const msg = err.message.includes("401")
      ? "⚠ API key tidak valid. Periksa kembali key di ⚙ API Key."
      : err.message.includes("429")
      ? "⚠ Terlalu banyak request. Tunggu beberapa detik lalu coba lagi."
      : `⚠ Gagal mendapatkan insight: ${err.message}`;

    displayAIResponse(msg, true);
    console.error("[aiInsight.js] Error:", err);

  } finally {
    // Selalu matikan loading setelah selesai (sukses atau gagal)
    setAILoading(false);
  }
}


// =============================================================================
// BAGIAN 3: BUILD DATA CONTEXT
// Merangkum semua data dashboard yang relevan menjadi teks ringkas.
// Teks ini dimasukkan ke dalam prompt agar AI punya konteks data aktual.
// =============================================================================

/**
 * Membangun ringkasan teks dari data dashboard saat ini.
 * Menggunakan data yang sudah difilter (FILTERED_*) jika filter aktif.
 *
 * @returns {string} Teks konteks data dalam format yang mudah dibaca AI
 */
function buildDataContext() {
  const lines = [];

  // ── KPI Ringkasan ──
  if (DATA_KPI) {
    lines.push("=== KPI RINGKASAN ===");
    lines.push(`Total Sales: $${DATA_KPI.total_sales.toLocaleString()}`);
    lines.push(`Total Profit: $${DATA_KPI.total_profit.toLocaleString()}`);
    lines.push(`Profit Margin: ${DATA_KPI.profit_margin}%`);
    lines.push(`Total Qty Sold: ${DATA_KPI.total_qty.toLocaleString()}`);
    lines.push(`Total Orders: ${DATA_KPI.total_orders.toLocaleString()}`);
    lines.push(`Periode Data: ${DATA_KPI.date_start} – ${DATA_KPI.date_end}`);
    lines.push("");
  }

  // ── Sales & Profit per Kategori ──
  // Gunakan data terfilter jika ada, fallback ke data penuh
  const catData = (FILTERED_CATEGORY?.length) ? FILTERED_CATEGORY : DATA_CATEGORY;
  if (catData?.length) {
    lines.push("=== SALES & PROFIT PER KATEGORI ===");
    catData.forEach(d => {
      lines.push(
        `${d.category}: Sales $${d.sales.toLocaleString()}, ` +
        `Profit $${d.profit.toLocaleString()}, Margin ${d.margin}%`
      );
    });
    lines.push("");
  }

  // ── Profitabilitas per Territory (top 5 + bottom 3) ──
  const terData = (FILTERED_TERRITORY?.length) ? FILTERED_TERRITORY : DATA_TERRITORY;
  if (terData?.length) {
    const sorted  = [...terData].sort((a,b) => b.sales - a.sales);
    const top5    = sorted.slice(0, 5);
    const bottom3 = sorted.slice(-3);

    lines.push("=== TOP 5 TERRITORY (by Sales) ===");
    top5.forEach(d => {
      lines.push(
        `${d.territory}: Sales $${d.sales.toLocaleString()}, ` +
        `Profit $${d.profit.toLocaleString()}, Margin ${d.margin}%`
      );
    });
    lines.push("");

    lines.push("=== BOTTOM 3 TERRITORY (by Sales) ===");
    bottom3.forEach(d => {
      lines.push(
        `${d.territory}: Sales $${d.sales.toLocaleString()}, ` +
        `Margin ${d.margin}%`
      );
    });
    lines.push("");
  }

  // ── Tren Tahunan (agregasi sales & profit per tahun) ──
  if (DATA_TREND?.length) {
    // Agregasi data bulanan menjadi ringkasan per tahun
    const yearMap = {};
    DATA_TREND.forEach(d => {
      if (!yearMap[d.year]) yearMap[d.year] = { sales:0, profit:0, orders:0 };
      yearMap[d.year].sales   += d.sales;
      yearMap[d.year].profit  += d.profit;
      yearMap[d.year].orders  += d.orders;
    });

    lines.push("=== TREN TAHUNAN ===");
    Object.entries(yearMap).sort().forEach(([yr, v]) => {
      const margin = v.sales > 0 ? ((v.profit / v.sales) * 100).toFixed(1) : 0;
      lines.push(
        `${yr}: Sales $${Math.round(v.sales).toLocaleString()}, ` +
        `Profit $${Math.round(v.profit).toLocaleString()}, Margin ${margin}%`
      );
    });
    lines.push("");
  }

  // ── Status Filter Aktif ──
  const activeFilters = Object.entries(ACTIVE_FILTERS)
    .filter(([,v]) => v !== "all")
    .map(([k,v]) => `${k}=${v}`);
  if (activeFilters.length > 0) {
    lines.push(`=== FILTER AKTIF: ${activeFilters.join(", ")} ===`);
    lines.push("");
  }

  return lines.join("\n");
}


// =============================================================================
// BAGIAN 4: BUILD PROMPT
// Menyusun instruksi sistem + konteks data + pertanyaan spesifik.
// Prompt dalam Bahasa Indonesia agar respons AI juga dalam Bahasa Indonesia.
// =============================================================================

/**
 * Membangun prompt lengkap untuk dikirim ke Groq AI.
 *
 * @param {string} questionType - Jenis pertanyaan
 * @param {string} context      - Konteks data dari buildDataContext()
 * @returns {string} Prompt final yang siap dikirim
 */
function buildPrompt(questionType, context) {

  // ── System Instruction (selalu sama) ──
  // Mendefinisikan peran dan gaya respons AI
  const systemInstruction =
    "Kamu adalah analis data bisnis profesional yang ahli dalam menganalisis " +
    "data penjualan ritel. Berikan insight yang tajam, actionable, dan berbasis " +
    "angka. Gunakan Bahasa Indonesia yang jelas dan profesional. " +
    "Struktur respons: mulai dengan temuan utama, lalu berikan 2-3 insight " +
    "spesifik dengan angka pendukung, akhiri dengan 1 rekomendasi konkret. " +
    "Panjang respons: 150-250 kata. Jangan bertele-tele.";

  // ── Pertanyaan Spesifik per Jenis ──
  const questions = {

    general:
      "Berdasarkan data penjualan di bawah, berikan analisis menyeluruh tentang " +
      "performa bisnis. Identifikasi pola utama, kekuatan, dan area yang perlu " +
      "perhatian. Sertakan angka spesifik dari data.",

    anomali:
      "Berdasarkan data penjualan di bawah, identifikasi anomali atau pola tidak " +
      "normal yang paling signifikan. Jelaskan APA anomalinya, MENGAPA itu " +
      "mengkhawatirkan, dan BAGAIMANA mengatasinya. Fokus pada 2-3 anomali " +
      "terpenting dengan angka spesifik.",

    produk:
      "Berdasarkan data penjualan per kategori di bawah, berikan rekomendasi " +
      "produk/kategori mana yang harus diprioritaskan untuk meningkatkan " +
      "profitabilitas. Jelaskan MENGAPA berdasarkan margin dan tren data. " +
      "Sertakan angka konkret sebagai justifikasi.",

    wilayah:
      "Berdasarkan data penjualan per territory di bawah, identifikasi wilayah " +
      "mana yang paling profitable dan mana yang underperform. Jelaskan " +
      "perbedaan margin antar wilayah dan berikan rekomendasi strategi " +
      "geografis yang spesifik.",
  };

  // Gunakan pertanyaan general jika jenis tidak dikenal
  const userQuestion = questions[questionType] || questions.general;

  // ── Gabungkan Semua ──
  return `${systemInstruction}\n\n${userQuestion}\n\nDATA:\n${context}`;
}


// =============================================================================
// BAGIAN 5: CALL GROQ API
// Mengirim request HTTP ke Groq API dan mengembalikan teks respons.
// =============================================================================

/**
 * Mengirim prompt ke Groq API dan mengembalikan teks respons.
 *
 * @param   {string} prompt - Prompt lengkap (system + user + data)
 * @returns {Promise<string>} Teks respons dari AI
 * @throws  {Error} Jika API call gagal atau token tidak valid
 */
async function callGroqAPI(prompt) {

  const apiKey = getGroqApiKey();
  const model  = CONFIG.GROQ_MODEL       || "llama-3.1-8b-instant";
  const maxTok = CONFIG.GROQ_MAX_TOKENS  || 1024;

  // Groq menggunakan format OpenAI-compatible API
  const requestBody = {
    model:       model,
    max_tokens:  maxTok,
    temperature: 0.7,      // sedikit kreatif tapi tetap faktual
    messages: [
      {
        role:    "user",
        content: prompt,
      }
    ],
  };

  // Kirim request ke Groq API endpoint
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  // Tangani error HTTP
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errText}`);
  }

  // Parse respons JSON
  const data = await response.json();

  // Ekstrak teks respons dari struktur OpenAI-compatible response
  const text = data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("Respons API kosong atau format tidak dikenal.");
  }

  return text;
}


// =============================================================================
// BAGIAN 6: UI HELPERS
// Fungsi-fungsi untuk update tampilan panel AI.
// =============================================================================

/**
 * Tampilkan / sembunyikan loading indicator di panel AI.
 * Juga mengaktifkan/menonaktifkan semua tombol AI agar tidak double-click.
 *
 * @param {boolean} isLoading - true = tampilkan loading, false = sembunyikan
 */
function setAILoading(isLoading) {
  const loadingEl = document.getElementById("ai-loading");
  const responseEl = document.getElementById("ai-response");
  const btnMain    = document.getElementById("btn-insight");

  if (isLoading) {
    // Tampilkan loading, kosongkan response area
    if (loadingEl)   loadingEl.style.display  = "flex";
    if (responseEl)  responseEl.style.opacity = "0.3";
    if (btnMain)     btnMain.disabled          = true;
    // Nonaktifkan quick question buttons juga
    document.querySelectorAll(".btn-insight-quick").forEach(b => b.disabled = true);
  } else {
    // Sembunyikan loading, kembalikan opacity response
    if (loadingEl)   loadingEl.style.display  = "none";
    if (responseEl)  responseEl.style.opacity = "1";
    if (btnMain)     btnMain.disabled          = false;
    document.querySelectorAll(".btn-insight-quick").forEach(b => b.disabled = false);
  }
}

/**
 * Langsung set teks di area respons AI (tanpa animasi).
 * Digunakan untuk pesan error atau status.
 *
 * @param {string}  html    - Konten HTML yang akan ditampilkan
 * @param {boolean} isError - Jika true, tampilkan dengan warna peringatan
 */
function displayAIResponse(html, isError = false) {
  const el = document.getElementById("ai-response");
  if (!el) return;
  el.innerHTML = isError
    ? `<span style="color:#E57A44">${html}</span>`
    : html;
}

/**
 * Menampilkan teks AI dengan efek animasi mengetik (typewriter).
 * Membuat respons terasa lebih hidup dan mudah dibaca secara bertahap.
 *
 * Cara kerja:
 * - Pecah teks menjadi array karakter
 * - Tambahkan karakter satu per satu dengan setInterval
 * - Scroll otomatis ke bawah saat teks bertambah
 * - Format teks: **bold** → <strong>, baris baru → <br>
 *
 * @param {string} elementId - ID elemen target
 * @param {string} text      - Teks plain yang akan ditampilkan
 */
function typewriterEffect(elementId, text) {
  const el = document.getElementById(elementId);
  if (!el) return;

  // Format teks sebelum ditampilkan:
  // **teks** → <strong>teks</strong>
  // Baris baru → <br>
  const formatted = text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");

  // Pecah menjadi karakter HTML (hati-hati dengan tag HTML)
  // Gunakan innerHTML langsung dengan append bertahap via timer
  el.innerHTML = "";
  let i = 0;

  // Tulis 3 karakter sekaligus per interval (lebih cepat, tetap terasa animasi)
  const interval = setInterval(() => {
    // Ambil potongan teks sampai karakter ke-i
    el.innerHTML = formatted.substring(0, i);
    i += 3;

    // Scroll ke bawah otomatis
    el.scrollTop = el.scrollHeight;

    // Hentikan saat semua karakter sudah ditulis
    if (i > formatted.length) {
      el.innerHTML = formatted;  // pastikan teks lengkap di akhir
      clearInterval(interval);
    }
  }, 16);  // ~60fps
}
