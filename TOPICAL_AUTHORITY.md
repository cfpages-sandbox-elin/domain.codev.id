# Topical Authority — domain.codev.id

## Role and boundary

`domain.codev.id` is a practical domain-management knowledge and product-support property for people who discover, register, organize, monitor, renew, transfer, and evaluate domains across a portfolio. It may explain availability, WHOIS/RDAP, expiration, DNS, security, automation, and rank monitoring, but live availability, registry status, dates, prices, provider limits, legal rights, and security guidance must be verified at publication and action time. Product screens own signed-in workflows and current interface instructions; editorial pages explain durable decisions without exposing private portfolio data or credentials.

## Context used

- The public entry identifies “Domain Codev” and asks users to sign in with Google to securely track a domain portfolio.
- Authenticated navigation exposes six meaningful app views: Dashboard, Documentation, Categories, WHOIS Schedule, Rank Tracking, and Settings; integration API tokens are a separate operational control.
- The product context supports bulk domain entry, Mine/To Snatch/Others classification, WHOIS/RDAP checks, expiry monitoring, provider fallback, alerts, imports/exports, integrations, and rank tracking.
- The repository has 166 tracked files, 1 public SPA/auth entry, 6 authenticated views, 6 backend function entry routes, and no sitemap.
- Twenty-seven bundled Markdown files are internal product, provider, architecture, and operational documentation rendered through one authenticated docs view. There is no `posts`, `articles`, or editorial content collection, so this is not a substantial existing article corpus and does not require deep mode.

## Ignored template noise

- Source modules, migrations, tests, dependencies, provider adapters, telemetry implementation, and build files were counted only as application infrastructure.
- Bundled engineering plans and provider setup notes were not treated as public topical coverage or mined for article-body metadata.
- Dashboard rows, filters, status variants, modal states, and user-specific portfolio data were treated as interface patterns rather than independent routes.
- Exact provider quotas, API availability, registrar prices, drop dates, registry rules, legal conclusions, and security procedures are volatile evidence gates, not evergreen facts.

## Topical map

| Topic ID | Parent topic | Reader outcome | Boundary | Article target |
|---|---|---|---|---:|
| DCV-01 | Menemukan dan menilai nama domain | Menyaring calon nama berdasarkan kejelasan, merek, penggunaan, dan risiko kebingungan. | Memiliki kualitas nama sebelum pengecekan; pilihan ekstensi dimiliki DCV-02 dan status tersedia dimiliki DCV-03. | 6 |
| DCV-02 | Strategi ekstensi dan struktur domain | Memilih TLD, ccTLD, subdomain, dan struktur nama yang sesuai dengan tujuan. | Memiliki keputusan ekstensi/struktur; syarat registrasi aktual dimiliki DCV-04 sebagai evidence gate. | 6 |
| DCV-03 | Availability dan status domain | Memeriksa serta membedakan available, registered, reserved, expired, dropped, dan unknown. | Memiliki status saat ini; interpretasi field WHOIS/RDAP dimiliki DCV-05 dan siklus expired dimiliki DCV-08. | 6 |
| DCV-04 | Registrasi dan pemilihan registrar | Membandingkan registrar dan menyiapkan registrasi tanpa terjebak harga awal atau fitur yang tidak setara. | Memiliki transaksi registrasi dan provider; transfer kepemilikan dimiliki DCV-11. | 6 |
| DCV-05 | Membaca WHOIS dan RDAP | Memahami registrar, tanggal, status registry, name server, kontak, dan keterbatasan data. | Memiliki interpretasi data lookup; keputusan DNS dimiliki DCV-10 dan cadence pemeriksaan dimiliki DCV-13. | 6 |
| DCV-06 | Inventaris dan klasifikasi portofolio | Membuat daftar domain yang jelas menurut pemilik, tujuan, kategori, dan tindakan berikutnya. | Memiliki tata kelola daftar; bulk import/data cleaning dimiliki DCV-14. | 6 |
| DCV-07 | Renewal dan pencegahan kedaluwarsa | Menetapkan owner, pengingat, pembayaran, dan verifikasi perpanjangan agar domain penting tidak terlewat. | Memiliki pencegahan sebelum expiry; lifecycle pasca-expiry dimiliki DCV-08. | 6 |
| DCV-08 | Lifecycle expired dan drop monitoring | Memahami fase pasca-expiry dan merencanakan pemantauan target tanpa menjanjikan tanggal drop. | Memiliki domain yang sudah expired/ditarget; pembelian normal domain tersedia dimiliki DCV-04. | 6 |
| DCV-09 | Akuisisi target dan due diligence | Menilai target domain, riwayat penggunaan, hak, biaya total, dan batas keputusan sebelum membeli. | Memiliki evaluasi target; kualitas nama generik dimiliki DCV-01 dan harga registrar biasa dimiliki DCV-04. | 6 |
| DCV-10 | DNS, name server, dan aktivasi | Memahami delegasi, record dasar, propagasi, dan verifikasi kesiapan layanan. | Memiliki aktivasi teknis setelah kepemilikan; keamanan akun/DNS dimiliki DCV-12. | 6 |
| DCV-11 | Transfer, kepemilikan, dan handover | Memindahkan domain atau tanggung jawab dengan bukti owner, akses, dan penerimaan yang jelas. | Memiliki perpindahan registrar/pengelola; registrasi baru dimiliki DCV-04. | 6 |
| DCV-12 | Keamanan dan privasi domain | Mengurangi risiko takeover, kehilangan akses, kebocoran data, dan perubahan DNS tanpa izin. | Memiliki kontrol keamanan evidence-gated; prosedur DNS operasional dimiliki DCV-10. | 6 |
| DCV-13 | Monitoring, jadwal, dan alert | Menetapkan apa yang dipantau, seberapa sering, dan siapa yang menerima tindakan tanpa memboroskan kuota. | Memiliki kebijakan pemeriksaan/alert; lifecycle domain dimiliki DCV-07 dan DCV-08. | 6 |
| DCV-14 | Bulk workflow dan kualitas data | Mengimpor, menormalisasi, menduplikasi, mengekspor, dan memperbaiki data domain dalam jumlah banyak. | Memiliki operasi data massal; kategori portofolio dimiliki DCV-06 dan API dimiliki DCV-15. | 6 |
| DCV-15 | API, integrasi, dan otomatisasi | Menghubungkan domain tracker ke agen, webhook, workflow, dan sistem lain secara terkontrol. | Memiliki integrasi mesin-ke-mesin; pengaturan pemeriksaan domain dimiliki DCV-13. | 6 |
| DCV-16 | Rank tracking lintas domain | Merancang pemantauan posisi keyword untuk beberapa domain dan membaca perubahan secara hati-hati. | Memiliki observasi SERP; bukan panduan SEO menyeluruh atau klaim sebab-akibat ranking. | 6 |

## Internal-link rule

Setiap artikel mengarah ke hub topiknya. Jalur penemuan bergerak dari DCV-01 ke DCV-02, DCV-03, DCV-04, lalu DCV-09 bila domain merupakan target sekunder. Jalur operasional bergerak dari DCV-05 dan DCV-06 ke DCV-07, DCV-08, serta DCV-13. Jalur teknis bergerak dari DCV-10 ke DCV-11 dan DCV-12. DCV-14 dan DCV-15 menghubungkan pengelolaan manual dengan skala/otomatisasi, sedangkan DCV-16 berdiri sebagai observasi performa domain. Tautan ke layar produk ditempatkan setelah pembaca memahami keputusan dan membutuhkan eksekusi.

## First publication wave

Gelombang pertama berisi 12 aset yang membentuk alur inventaris–verifikasi–perlindungan: `DCV-01-01`, `DCV-02-01`, `DCV-03-01`, `DCV-03-02`, `DCV-04-01`, `DCV-05-01`, `DCV-06-01`, `DCV-07-01`, `DCV-08-01`, `DCV-10-01`, `DCV-12-01`, dan `DCV-13-01`. Setiap artikel yang menyebut status, tanggal, harga, aturan registry, hak merek, provider, atau kontrol keamanan harus memakai sumber primer yang masih berlaku dan menampilkan waktu verifikasi.
