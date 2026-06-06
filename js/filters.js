// =============================================================================
// js/filters.js
// Mengelola semua filter interaktif di filter bar.
//
// Tugas file ini:
// 1. Mengambil nilai unik dari data/filters.json
// 2. Mengisi dropdown filter (tahun, kategori, territory, segmen)
// 3. Mendengarkan perubahan filter dan memanggil ulang render chart
// =============================================================================


// =============================================================================
// BAGIAN 1: STATE FILTER
// Menyimpan kondisi filter yang sedang aktif.
// Semua modul lain bisa baca nilai filter dari sini.
// =============================================================================

// Objek global yang menyimpan nilai filter yang sedang aktif
// "all" berarti tidak ada filter (tampilkan semua data)
const ACTIVE_FILTERS = {
  year:      "all",   // contoh aktif: "2001", "2002", "2003", "2004"
  category:  "all",   // contoh aktif: "Bikes", "Accessories", "Clothing"
  territory: "all",   // contoh aktif: "Southwest", "Canada", dll
  segment:   "all",   // contoh aktif: "Individu", "Shop"
};


// =============================================================================
// BAGIAN 2: INISIALISASI FILTER
// Fungsi utama untuk mengisi semua dropdown dari filters.json
// =============================================================================

/**
 * Mengambil data filters.json lalu isi semua dropdown.
 * Dipanggil oleh app.js saat halaman pertama kali dimuat.
 *
 * @param {Object} filtersData - Data dari data/filters.json
 */
function initFilters(filtersData) {

  // Isi dropdown Tahun
  // filtersData.years berisi array seperti [2001, 2002, 2003, 2004]
  populateSelect("filter-year", filtersData.years, (year) => ({
    value: String(year),   // simpan sebagai string untuk perbandingan
    label: String(year),   // tampilkan angka tahun: "2001", "2002", dll
  }));

  // Isi dropdown Category
  // filtersData.categories berisi array seperti ["Accessories", "Bikes", "Clothing"]
  populateSelect("filter-category", filtersData.categories, (cat) => ({
    value: cat,
    label: cat,
  }));

  // Isi dropdown Territory
  // filtersData.territories berisi array 10 wilayah
  populateSelect("filter-territory", filtersData.territories, (ter) => ({
    value: ter,
    label: ter,
  }));

  // Isi dropdown Segment
  // filtersData.segments berisi ["Individu", "Shop"]
  populateSelect("filter-segment", filtersData.segments, (seg) => ({
    value: seg,
    label: seg,
  }));

  // Pasang event listener ke semua dropdown
  // agar perubahan filter langsung ditangkap
  attachFilterListeners();

  // Pasang event listener ke tombol Reset Filter
  attachResetListener();

  console.log("[filters.js] Filter berhasil diinisialisasi");
}


// =============================================================================
// BAGIAN 3: HELPER — ISI DROPDOWN
// =============================================================================

/**
 * Mengisi elemen <select> dengan opsi-opsi dari array data.
 *
 * @param {string}   selectId  - ID elemen <select> di HTML
 * @param {Array}    dataArray - Array nilai yang akan jadi opsi
 * @param {Function} mapper    - Fungsi pengubah item → {value, label}
 */
function populateSelect(selectId, dataArray, mapper) {
  // Ambil elemen <select> dari DOM
  const select = document.getElementById(selectId);

  // Jika elemen tidak ditemukan, hentikan dan catat error
  if (!select) {
    console.error(`[filters.js] Elemen #${selectId} tidak ditemukan di HTML`);
    return;
  }

  // Loop setiap item di array, buat <option> dan tambahkan ke <select>
  dataArray.forEach((item) => {
    const { value, label } = mapper(item);  // ubah item ke {value, label}

    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;

    select.appendChild(option);  // tambahkan opsi ke dropdown
  });
}


// =============================================================================
// BAGIAN 4: EVENT LISTENERS FILTER
// Mendengarkan perubahan setiap dropdown dan memicu update dashboard
// =============================================================================

/**
 * Pasang event listener "change" ke semua 4 dropdown filter.
 * Setiap kali user memilih nilai berbeda, ACTIVE_FILTERS diupdate
 * dan fungsi onFiltersChanged() dipanggil.
 */
function attachFilterListeners() {

  // Mapping: ID elemen HTML → nama key di ACTIVE_FILTERS
  const filterMap = {
    "filter-year":      "year",
    "filter-category":  "category",
    "filter-territory": "territory",
    "filter-segment":   "segment",
  };

  // Loop setiap filter, pasang event listener
  Object.entries(filterMap).forEach(([elementId, filterKey]) => {
    const select = document.getElementById(elementId);
    if (!select) return;  // skip jika elemen tidak ada

    select.addEventListener("change", (event) => {
      // Update nilai filter yang aktif
      ACTIVE_FILTERS[filterKey] = event.target.value;

      console.log(`[filters.js] Filter berubah: ${filterKey} = "${event.target.value}"`);

      // Panggil fungsi update dashboard
      // Fungsi ini ada di app.js dan akan merender ulang semua chart
      onFiltersChanged();
    });
  });
}

/**
 * Pasang event listener ke tombol "Reset Filter".
 * Saat diklik, semua filter dikembalikan ke "all"
 * dan semua dropdown direset ke opsi pertama.
 */
function attachResetListener() {
  const btnReset = document.getElementById("btn-reset-filter");
  if (!btnReset) return;

  btnReset.addEventListener("click", () => {
    // Reset semua nilai ACTIVE_FILTERS ke "all"
    Object.keys(ACTIVE_FILTERS).forEach((key) => {
      ACTIVE_FILTERS[key] = "all";
    });

    // Reset semua dropdown ke opsi pertama (index 0 = "Semua...")
    ["filter-year", "filter-category", "filter-territory", "filter-segment"]
      .forEach((id) => {
        const select = document.getElementById(id);
        if (select) select.selectedIndex = 0;
      });

    console.log("[filters.js] Semua filter direset ke 'all'");

    // Panggil update dashboard dengan filter kosong
    onFiltersChanged();
  });
}


// =============================================================================
// BAGIAN 5: FUNGSI HELPER — CEK APAKAH DATA COCOK DENGAN FILTER
// Digunakan oleh chart dan KPI untuk memfilter data
// =============================================================================

/**
 * Mengecek apakah satu baris data sesuai dengan semua filter aktif.
 * Digunakan untuk memfilter data sebelum dirender ke chart.
 *
 * @param {Object} item - Satu baris data (harus punya field year, category, territory, segment)
 * @returns {boolean} true jika data cocok dengan filter aktif
 */
function matchesFilter(item) {
  // Cek filter tahun — jika "all" lewati, jika tidak cek kecocokan
  if (ACTIVE_FILTERS.year !== "all" && String(item.year) !== ACTIVE_FILTERS.year) {
    return false;
  }
  // Cek filter category
  if (ACTIVE_FILTERS.category !== "all" && item.category !== ACTIVE_FILTERS.category) {
    return false;
  }
  // Cek filter territory
  if (ACTIVE_FILTERS.territory !== "all" && item.territory !== ACTIVE_FILTERS.territory) {
    return false;
  }
  // Cek filter segment
  if (ACTIVE_FILTERS.segment !== "all" && item.segment !== ACTIVE_FILTERS.segment) {
    return false;
  }
  // Jika semua lolos → data cocok
  return true;
}
