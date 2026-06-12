# =============================================================================
# prepare_data.py
# Script untuk mengolah file CSV Sales menjadi file-file JSON
# yang akan digunakan oleh dashboard.
#
# CARA MENJALANKAN (di terminal VS Code):
#   python prepare_data.py
#
# OUTPUT: Semua file JSON akan tersimpan di folder 'data/'
# =============================================================================

import pandas as pd      # library untuk olah data tabular
import json              # library untuk buat file JSON
import os                # library untuk operasi folder/file
from datetime import datetime  # library untuk format tanggal

# =============================================================================
# BAGIAN 1: KONFIGURASI
# Ubah nama file CSV jika namanya berbeda
# =============================================================================

CSV_FILE = "Sales_BY_Category_202606040914-1.csv"   # nama file CSV sumber
OUTPUT_FOLDER = "data"                               # folder output JSON

# =============================================================================
# BAGIAN 2: BUAT FOLDER OUTPUT
# Jika folder 'data/' belum ada, buat otomatis
# =============================================================================

if not os.path.exists(OUTPUT_FOLDER):
    os.makedirs(OUTPUT_FOLDER)
    print(f"[OK] Folder '{OUTPUT_FOLDER}' berhasil dibuat")
else:
    print(f"[OK] Folder '{OUTPUT_FOLDER}' sudah ada")

# =============================================================================
# BAGIAN 3: BACA DAN BERSIHKAN DATA
# =============================================================================

print("\n[PROSES] Membaca file CSV...")

# Baca file CSV dengan pandas
df = pd.read_csv(CSV_FILE)

# Konversi kolom OrderDate dari string ke format datetime Python
# agar bisa diekstrak tahun, bulan, dsb.
df['OrderDate'] = pd.to_datetime(df['OrderDate'])

# Tambah kolom Year dan Month untuk kemudahan agregasi
df['Year']  = df['OrderDate'].dt.year    # contoh: 2001, 2002
df['Month'] = df['OrderDate'].dt.month   # contoh: 1 (Januari), 7 (Juli)

# Buat label bulan-tahun untuk tren chart, contoh: "Jul 2001"
df['MonthLabel'] = df['OrderDate'].dt.strftime('%b %Y')

# Buat key pengurutan bulan: "2001-07", "2001-08", dst.
# digunakan agar urutan bulan di chart benar (kronologis)
df['MonthKey'] = df['OrderDate'].dt.strftime('%Y-%m')

print(f"[OK] Data berhasil dibaca: {len(df):,} baris transaksi")
print(f"     Periode: {df['Year'].min()} - {df['Year'].max()}")
print(f"     Kategori: {', '.join(df['Category'].unique())}")

# =============================================================================
# BAGIAN 4: BUAT kpi.json
# Berisi angka ringkasan utama untuk KPI Cards di dashboard
# =============================================================================

print("\n[PROSES] Membuat kpi.json...")

total_sales   = round(df['Sales'].sum(), 2)         # total penjualan dalam USD
total_profit  = round(df['Profit'].sum(), 2)         # total keuntungan
profit_margin = round((total_profit / total_sales) * 100, 2)  # margin dalam %
total_qty     = int(df['Qty'].sum())                 # total unit terjual
total_orders  = int(df['SalesOrderID'].nunique())    # jumlah order unik
# Hitung customer: hanya baris yang memiliki nama customer (tidak kosong)
total_customers = int(df['CustomerName'].notna().sum())

kpi_data = {
    "total_sales":      total_sales,
    "total_profit":     total_profit,
    "profit_margin":    profit_margin,
    "total_qty":        total_qty,
    "total_orders":     total_orders,
    "total_customers":  total_customers,
    "date_start":       str(df['OrderDate'].min().strftime('%b %Y')),  # contoh: "Jul 2001"
    "date_end":         str(df['OrderDate'].max().strftime('%b %Y'))   # contoh: "Dec 2004"
}

# Simpan ke file JSON
with open(f"{OUTPUT_FOLDER}/kpi.json", "w") as f:
    json.dump(kpi_data, f, indent=2)

print(f"[OK] kpi.json → Sales: ${total_sales:,.2f} | Profit: ${total_profit:,.2f} | Margin: {profit_margin}%")

# =============================================================================
# BAGIAN 5: BUAT by_category.json
# Berisi agregasi Sales, Profit, Qty per Kategori produk
# Digunakan oleh Bar Chart: Sales by Category
# =============================================================================

print("\n[PROSES] Membuat by_category.json...")

# Kelompokkan data berdasarkan Category, lalu hitung total
category_agg = df.groupby('Category').agg(
    sales   = ('Sales', 'sum'),    # total penjualan per kategori
    profit  = ('Profit', 'sum'),   # total profit per kategori
    qty     = ('Qty', 'sum'),      # total quantity per kategori
    orders  = ('SalesOrderID', 'nunique')  # jumlah order unik per kategori
).reset_index()

# Urutkan dari sales tertinggi ke terendah
category_agg = category_agg.sort_values('sales', ascending=False)

# Konversi ke list of dict dan bulatkan angka
category_list = []
for _, row in category_agg.iterrows():
    category_list.append({
        "category": row['Category'],
        "sales":    round(row['sales'], 2),
        "profit":   round(row['profit'], 2),
        "margin":   round((row['profit'] / row['sales']) * 100, 2),  # margin %
        "qty":      int(row['qty']),
        "orders":   int(row['orders'])
    })

with open(f"{OUTPUT_FOLDER}/by_category.json", "w") as f:
    json.dump(category_list, f, indent=2)

print(f"[OK] by_category.json → {len(category_list)} kategori")

# =============================================================================
# BAGIAN 6: BUAT by_subcategory.json
# Berisi agregasi per SubCategory
# Digunakan oleh Bar Chart: Top Sub-Category
# =============================================================================

print("\n[PROSES] Membuat by_subcategory.json...")

subcat_agg = df.groupby(['SubCategory', 'Category']).agg(
    sales   = ('Sales', 'sum'),
    profit  = ('Profit', 'sum'),
    qty     = ('Qty', 'sum'),
    orders  = ('SalesOrderID', 'nunique')
).reset_index()

# Urutkan dari profit tertinggi ke terendah
subcat_agg = subcat_agg.sort_values('profit', ascending=False)

subcat_list = []
for _, row in subcat_agg.iterrows():
    subcat_list.append({
        "subcategory": row['SubCategory'],
        "category":    row['Category'],
        "sales":       round(row['sales'], 2),
        "profit":      round(row['profit'], 2),
        "margin":      round((row['profit'] / row['sales']) * 100, 2),
        "qty":         int(row['qty']),
        "orders":      int(row['orders'])
    })

with open(f"{OUTPUT_FOLDER}/by_subcategory.json", "w") as f:
    json.dump(subcat_list, f, indent=2)

print(f"[OK] by_subcategory.json → {len(subcat_list)} sub-kategori")

# =============================================================================
# BAGIAN 7: BUAT by_territory.json
# Berisi agregasi Sales, Profit per Territory (wilayah)
# Digunakan oleh Bar Chart: Profit by Territory
# =============================================================================

print("\n[PROSES] Membuat by_territory.json...")

territory_agg = df.groupby('Territory').agg(
    sales     = ('Sales', 'sum'),
    profit    = ('Profit', 'sum'),
    qty       = ('Qty', 'sum'),
    orders    = ('SalesOrderID', 'nunique'),
    customers = ('CustomerID', 'nunique')   # jumlah customer unik per wilayah
).reset_index()

# Urutkan dari sales tertinggi ke terendah
territory_agg = territory_agg.sort_values('sales', ascending=False)

territory_list = []
for _, row in territory_agg.iterrows():
    territory_list.append({
        "territory": row['Territory'],
        "sales":     round(row['sales'], 2),
        "profit":    round(row['profit'], 2),
        "margin":    round((row['profit'] / row['sales']) * 100, 2),
        "qty":       int(row['qty']),
        "orders":    int(row['orders']),
        "customers": int(row['customers'])
    })

with open(f"{OUTPUT_FOLDER}/by_territory.json", "w") as f:
    json.dump(territory_list, f, indent=2)

print(f"[OK] by_territory.json → {len(territory_list)} territory")

# =============================================================================
# BAGIAN 8: BUAT trend_monthly.json
# Berisi tren Sales dan Profit per bulan secara kronologis
# Digunakan oleh Line Chart: Tren Bulanan
# =============================================================================

print("\n[PROSES] Membuat trend_monthly.json...")

# Kelompokkan per bulan (berdasarkan MonthKey agar urutan benar)
trend_agg = df.groupby(['MonthKey', 'MonthLabel', 'Year', 'Month']).agg(
    sales  = ('Sales', 'sum'),
    profit = ('Profit', 'sum'),
    orders = ('SalesOrderID', 'nunique')
).reset_index()

# Urutkan secara kronologis berdasarkan MonthKey (format YYYY-MM)
trend_agg = trend_agg.sort_values('MonthKey')

trend_list = []
for _, row in trend_agg.iterrows():
    trend_list.append({
        "month_key": row['MonthKey'],       # "2001-07" untuk sorting
        "label":     row['MonthLabel'],      # "Jul 2001" untuk tampilan di chart
        "year":      int(row['Year']),
        "month":     int(row['Month']),
        "sales":     round(row['sales'], 2),
        "profit":    round(row['profit'], 2),
        "orders":    int(row['orders'])
    })

with open(f"{OUTPUT_FOLDER}/trend_monthly.json", "w") as f:
    json.dump(trend_list, f, indent=2)

print(f"[OK] trend_monthly.json → {len(trend_list)} bulan data")

# =============================================================================
# BAGIAN 9: BUAT scatter.json
# Berisi data per produk untuk Scatter Plot: Sales vs Profit
# Setiap titik di scatter plot = satu produk
# =============================================================================

print("\n[PROSES] Membuat scatter.json...")

# Agregasi per ProductName untuk scatter plot
# (hanya 9 produk unik, jadi scatter-nya bersih dan informatif)
scatter_agg = df.groupby(['ProductName', 'SubCategory', 'Category']).agg(
    sales   = ('Sales', 'sum'),
    profit  = ('Profit', 'sum'),
    qty     = ('Qty', 'sum'),
    orders  = ('SalesOrderID', 'nunique')
).reset_index()

scatter_list = []
for _, row in scatter_agg.iterrows():
    scatter_list.append({
        "product":     row['ProductName'],
        "subcategory": row['SubCategory'],
        "category":    row['Category'],
        "sales":       round(row['sales'], 2),
        "profit":      round(row['profit'], 2),
        "margin":      round((row['profit'] / row['sales']) * 100, 2),
        "qty":         int(row['qty']),
        "orders":      int(row['orders'])
    })

with open(f"{OUTPUT_FOLDER}/scatter.json", "w") as f:
    json.dump(scatter_list, f, indent=2)

print(f"[OK] scatter.json → {len(scatter_list)} produk")

# =============================================================================
# BAGIAN 10: BUAT top10.json
# Berisi produk/sub-kategori terbaik berdasarkan profit
# Digunakan oleh Horizontal Bar Chart: Top Products
# =============================================================================

print("\n[PROSES] Membuat top10.json...")

# Karena hanya ada 9 produk, ambil semua, urutkan dari profit tertinggi
top_agg = df.groupby(['ProductName', 'SubCategory', 'Category']).agg(
    sales   = ('Sales', 'sum'),
    profit  = ('Profit', 'sum'),
    qty     = ('Qty', 'sum')
).reset_index()

# Urutkan dari profit tertinggi, ambil maksimal 10
top_agg = top_agg.sort_values('profit', ascending=False).head(10)

top_list = []
for _, row in top_agg.iterrows():
    top_list.append({
        "product":     row['ProductName'],
        "subcategory": row['SubCategory'],
        "category":    row['Category'],
        "sales":       round(row['sales'], 2),
        "profit":      round(row['profit'], 2),
        "margin":      round((row['profit'] / row['sales']) * 100, 2),
        "qty":         int(row['qty'])
    })

with open(f"{OUTPUT_FOLDER}/top10.json", "w") as f:
    json.dump(top_list, f, indent=2)

print(f"[OK] top10.json → {len(top_list)} produk teratas")

# =============================================================================
# BAGIAN 11: BUAT filters.json
# Berisi semua nilai unik untuk setiap filter interaktif di dashboard
# =============================================================================

print("\n[PROSES] Membuat filters.json...")

filters_data = {
    # Semua tahun unik, diurutkan
    "years":       sorted(df['Year'].unique().tolist()),
    # Semua kategori unik, diurutkan
    "categories":  sorted(df['Category'].unique().tolist()),
    # Semua sub-kategori unik, diurutkan
    "subcategories": sorted(df['SubCategory'].unique().tolist()),
    # Semua territory unik, diurutkan
    "territories": sorted(df['Territory'].unique().tolist()),
    # Semua segmen unik, diurutkan
    "segments":    sorted(df['Segment'].unique().tolist())
}

with open(f"{OUTPUT_FOLDER}/filters.json", "w") as f:
    json.dump(filters_data, f, indent=2)

print(f"[OK] filters.json → tahun: {filters_data['years']}")
print(f"     kategori: {filters_data['categories']}")
print(f"     territory: {len(filters_data['territories'])} wilayah")

# =============================================================================
# BAGIAN 12: BUAT anomaly_data.json
# Berisi data mentah per bulan per kategori untuk deteksi anomali
# oleh anomaly.js di sisi browser menggunakan Z-score dan IQR
# =============================================================================

print("\n[PROSES] Membuat anomaly_data.json...")

# Agregasi profit per bulan per sub-kategori
# Data ini akan diproses oleh anomaly.js untuk cari outlier
anomaly_agg = df.groupby(['MonthKey', 'MonthLabel', 'SubCategory', 'Category']).agg(
    sales   = ('Sales', 'sum'),
    profit  = ('Profit', 'sum'),
    qty     = ('Qty', 'sum')
).reset_index().sort_values('MonthKey')

anomaly_list = []
for _, row in anomaly_agg.iterrows():
    anomaly_list.append({
        "month_key":   row['MonthKey'],
        "label":       row['MonthLabel'],
        "subcategory": row['SubCategory'],
        "category":    row['Category'],
        "sales":       round(row['sales'], 2),
        "profit":      round(row['profit'], 2)
    })

with open(f"{OUTPUT_FOLDER}/anomaly_data.json", "w") as f:
    json.dump(anomaly_list, f, indent=2)

print(f"[OK] anomaly_data.json → {len(anomaly_list)} data poin")

# ── 9. DETAIL DATA untuk filter client-side ──────────────────────────────
# Agregasi berdasarkan 4 dimensi: Year × Category × Territory × Segment
# Digunakan app.js untuk hitung KPI dan chart sesuai filter aktif
# Ukuran: maks ~240 baris, sangat ringan di browser
detail = df.groupby(['Year','Category','Territory','Segment']).agg(
    sales   = ('Sales',   'sum'),
    profit  = ('Profit',  'sum'),
    qty     = ('Qty',     'sum'),
    orders  = ('SalesOrderID', 'nunique')
).reset_index()

detail_list = []
for _, row in detail.iterrows():
    detail_list.append({
        "year":      int(row['Year']),
        "category":  row['Category'],
        "territory": row['Territory'],
        "segment":   row['Segment'],
        "sales":     round(row['sales'], 2),
        "profit":    round(row['profit'], 2),
        "qty":       int(row['qty']),
        "orders":    int(row['orders'])
    })
with open('data/detail_data.json', 'w') as f:
    json.dump(detail_list, f, indent=2)
print("✓ detail_data.json")

# =============================================================================
# SELESAI: Tampilkan ringkasan semua file yang dibuat
# =============================================================================

print("\n" + "="*60)
print("SEMUA FILE JSON BERHASIL DIBUAT DI FOLDER 'data/'")
print("="*60)

# Tampilkan daftar file yang berhasil dibuat beserta ukurannya
json_files = [f for f in os.listdir(OUTPUT_FOLDER) if f.endswith('.json')]
for fname in sorted(json_files):
    fpath = os.path.join(OUTPUT_FOLDER, fname)
    fsize = os.path.getsize(fpath)
    # Konversi ukuran ke KB untuk tampilan
    print(f"  {fname:<25} {fsize/1024:.1f} KB")

print("\nLangkah selanjutnya: Buka index.html dan mulai coding dashboard!")
