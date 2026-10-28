// Tiga ilustrasi animasi untuk kartu fitur, masing-masing menceritakan satu layanan:
//   VisualTagihan    -> Cek Tagihan     (nomor langganan diketik, pemakaian & total muncul)
//   VisualLaporMeter -> Lapor Angka Meter (foto meter dibidik, terkirim)
//   VisualPengaduan  -> Pengaduan Gangguan Air (pipa bocor, petugas datang, tiket selesai)
// Semuanya dekoratif (aria-hidden dipasang oleh kartu pembungkus) dan memakai token tema:
//   --border, --muted, --muted-foreground, --background, --foreground,
//   --info (biru), --success (hijau), --destructive (merah)
// Animasi memakai CSS keyframes di <style> masing-masing ilustrasi (prefix "fv-t-", "fv-m-",
// "fv-p-") dan otomatis berhenti untuk pengguna yang memilih "kurangi gerakan"; nilai atribut
// pada elemen beranimasi adalah keadaan diam yang dipakai saat animasi dimatikan.
import type { ReactNode } from "react"

// Aturan bersama: matikan animasi jika prefers-reduced-motion
const REDUCED = "@media (prefers-reduced-motion: reduce){.fv-a{animation:none!important}}"

// Pembungkus sama untuk ketiga ilustrasi: grid tengah, padding 16px, rasio 322:246, maks 320px
function Bingkai({ children }: { children: ReactNode }) {
  return (
    <div className="grid size-full place-items-center p-4">
      <div className="aspect-322/246 w-full max-w-[320px]">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 1. Cek Tagihan: nomor langganan 11 digit, dial pemakaian, total     */
/* ------------------------------------------------------------------ */
const DIGIT_T = Array.from({ length: 11 }, (_, i) => i)

// Satu siklus 7 detik. Tiap digit "diketik" bergantian (persen waktu 4% sampai 34%).
const CSS_T = `
${DIGIT_T.map((i) => {
  const p = 4 + i * 3
  return `@keyframes fv-t-d${i}{0%,${p - 1}%{opacity:0}${p + 1}%,88%{opacity:1}94%,100%{opacity:0}}.fv-t-d${i}{animation:fv-t-d${i} 7s linear infinite}`
}).join("")}
@keyframes fv-t-isi{0%,34%{stroke-dashoffset:100}52%,88%{stroke-dashoffset:28}96%,100%{stroke-dashoffset:100}}
@keyframes fv-t-baris{0%,38%{opacity:0;transform:translateX(-6px)}46%,88%{opacity:1;transform:translateX(0)}96%,100%{opacity:0}}
@keyframes fv-t-total{0%,50%{opacity:0}58%,88%{opacity:1}96%,100%{opacity:0}}
.fv-t-isi{animation:fv-t-isi 7s ease-in-out infinite}
.fv-t-baris{animation:fv-t-baris 7s ease-out infinite}
.fv-t-total{animation:fv-t-total 7s ease-out infinite}
${REDUCED}
`

const BARIS_T: { y: number; w: number }[] = [
  { y: 124, w: 120 },
  { y: 140, w: 88 },
  { y: 156, w: 110 },
]

export function VisualTagihan() {
  return (
    <Bingkai>
      <svg viewBox="0 0 320 244" fill="none" className="block size-full">
        <style>{CSS_T}</style>

        {/* Kartu rekening */}
        <rect x="20" y="14" width="280" height="216" rx="12" fill="var(--muted)" />
        <rect x="20.5" y="14.5" width="279" height="215" rx="11.5" stroke="var(--muted-foreground)" strokeOpacity="0.5" />

        {/* Kepala kartu: tetes air, judul, lencana */}
        <path d="M42 28C42 28 35 35.5 35 40a7 7 0 0 0 14 0C49 35.5 42 28 42 28Z" fill="var(--info)" />
        <text x="58" y="39.5" fontSize="10" fontWeight="600" fill="var(--foreground)">
          Rekening Air
        </text>
        <rect x="228" y="29" width="58" height="14" rx="7" fill="var(--info)" fillOpacity="0.15" />
        <text x="257" y="39" fontSize="8" textAnchor="middle" fill="var(--info)">
          Bulan ini
        </text>
        <path d="M20 56H300" stroke="var(--border)" />

        {/* Nomor langganan: 11 kotak, isinya muncul satu per satu */}
        <text x="32" y="70" fontSize="8" fill="var(--muted-foreground)">
          No. langganan
        </text>
        {DIGIT_T.map((i) => {
          const x = 32 + i * 23.6
          return (
            <g key={i}>
              <rect x={x} y="76" width="20" height="22" rx="4" fill="var(--background)" stroke="var(--border)" />
              <rect
                x={x + 6} y="81" width="8" height="12" rx="2"
                fill="var(--muted-foreground)" fillOpacity="0.6"
                className={`fv-a fv-t-d${i}`}
              />
            </g>
          )
        })}

        {/* Dial pemakaian air: jalur abu + busur biru yang terisi */}
        <circle cx="84" cy="160" r="30" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="84" cy="160" r="30"
          stroke="var(--info)" strokeWidth="8" strokeLinecap="round"
          pathLength={100} strokeDasharray="100" strokeDashoffset="28"
          transform="rotate(-90 84 160)"
          className="fv-a fv-t-isi"
        />
        <text x="84" y="164" fontSize="11" fontWeight="600" textAnchor="middle" fill="var(--muted-foreground)">
          m³
        </text>

        {/* Rincian tagihan: baris masuk dari kiri */}
        {BARIS_T.map((b, i) => (
          <rect
            key={b.y} x="140" y={b.y} width={b.w} height="8" rx="4" fill="var(--border)"
            className="fv-a fv-t-baris" style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}

        {/* Total tagihan */}
        <g className="fv-a fv-t-total">
          <rect x="140" y="176" width="148" height="40" rx="8" fill="var(--info)" fillOpacity="0.1" stroke="var(--info)" strokeOpacity="0.4" />
          <text x="152" y="192" fontSize="8" fill="var(--muted-foreground)">
            Total tagihan
          </text>
          <rect x="152" y="198" width="76" height="8" rx="4" fill="var(--info)" fillOpacity="0.55" />
        </g>
      </svg>
    </Bingkai>
  )
}

/* ------------------------------------------------------------------ */
/* 2. Lapor Angka Meter: ponsel membidik meter, laporan terkirim       */
/* ------------------------------------------------------------------ */
// Satu siklus 6 detik: garis pindai turun-naik (0 sampai 50%), kilat jepret (54%),
// lencana "Terkirim" muncul (68% sampai 92%).
const CSS_M = `
@keyframes fv-m-scan{0%,100%{transform:translateY(0)}25%{transform:translateY(84px)}50%{transform:translateY(0)}}
@keyframes fv-m-kilat{0%,50%{opacity:0}54%{opacity:.35}66%,100%{opacity:0}}
@keyframes fv-m-jarum{0%,100%{transform:rotate(-22deg)}50%{transform:rotate(28deg)}}
@keyframes fv-m-terkirim{0%,58%{opacity:0;transform:translateY(5px)}68%,92%{opacity:1;transform:translateY(0)}98%,100%{opacity:0}}
@keyframes fv-m-gulir{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes fv-m-denyut{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes fv-m-kirim{to{stroke-dashoffset:-7}}
.fv-m-scan{animation:fv-m-scan 6s ease-in-out infinite}
.fv-m-kilat{animation:fv-m-kilat 6s linear infinite}
.fv-m-jarum{animation:fv-m-jarum 3s ease-in-out infinite}
.fv-m-terkirim{animation:fv-m-terkirim 6s ease-out infinite}
.fv-m-gulir{animation:fv-m-gulir 2.4s ease-in-out infinite}
.fv-m-denyut{animation:fv-m-denyut 2.4s ease-in-out infinite}
.fv-m-kirim{animation:fv-m-kirim 1s linear infinite}
${REDUCED}
`

// Digit stand meter di kartu kanan: 5 kotak, dua digit terakhir "berputar".
const DIGIT_M = Array.from({ length: 5 }, (_, i) => 176 + i * 20.25)

export function VisualLaporMeter() {
  return (
    <Bingkai>
      <svg viewBox="0 0 320 244" fill="none" className="block size-full">
        <style>{CSS_M}</style>

        {/* Ponsel */}
        <rect x="40" y="12" width="108" height="220" rx="16" fill="var(--muted)" />
        <rect x="40.5" y="12.5" width="107" height="219" rx="15.5" stroke="var(--muted-foreground)" strokeOpacity="0.5" />
        <rect x="80" y="20" width="28" height="5" rx="2.5" fill="var(--border)" />
        <rect x="48" y="32" width="92" height="188" rx="8" fill="var(--background)" stroke="var(--border)" />
        <text x="94" y="49" fontSize="8.5" textAnchor="middle" fill="var(--muted-foreground)">
          Foto stand meter
        </text>

        {/* Jendela bidik: meter air dengan jarum dan angka */}
        <circle cx="94" cy="94" r="22" stroke="var(--border)" strokeWidth="3" />
        <path
          d="M94 94V79" stroke="var(--muted-foreground)" strokeWidth="2" strokeLinecap="round"
          className="fv-a fv-m-jarum" style={{ transformOrigin: "94px 94px" }}
        />
        <circle cx="94" cy="94" r="3" fill="var(--muted-foreground)" />
        <rect x="72" y="124" width="44" height="15" rx="3" fill="var(--muted)" stroke="var(--border)" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={76 + i * 10.5} y="127" width="8" height="9" rx="1.5" fill="var(--muted-foreground)" fillOpacity="0.5" />
        ))}

        {/* Sudut bidik */}
        {[
          "M58 72V62H68",
          "M120 62H130V72",
          "M58 140V150H68",
          "M120 150H130V140",
        ].map((d) => (
          <path key={d} d={d} stroke="var(--info)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {/* Garis pindai dan kilat jepret */}
        <rect x="58" y="62" width="72" height="2" rx="1" fill="var(--info)" fillOpacity="0.85" className="fv-a fv-m-scan" />
        <rect x="58" y="62" width="72" height="88" rx="4" fill="var(--info)" opacity="0" className="fv-a fv-m-kilat" />

        <text x="94" y="166" fontSize="8" textAnchor="middle" fill="var(--muted-foreground)">
          Arahkan ke meter
        </text>

        {/* Tombol rana */}
        <circle cx="94" cy="192" r="11" stroke="var(--muted-foreground)" strokeOpacity="0.6" />
        <circle cx="94" cy="192" r="7" fill="var(--info)" className="fv-a fv-m-denyut" />

        {/* Jalur kirim ke kartu laporan */}
        <path d="M148 126H164" stroke="var(--info)" strokeDasharray="4 3" className="fv-a fv-m-kirim" />

        {/* Kartu laporan */}
        <rect x="164" y="44" width="120" height="156" rx="12" fill="var(--muted)" />
        <rect x="164.5" y="44.5" width="119" height="155" rx="11.5" stroke="var(--muted-foreground)" strokeOpacity="0.5" />
        <text x="176" y="64" fontSize="8.5" fill="var(--muted-foreground)">
          Stand meter
        </text>
        {DIGIT_M.map((x, i) => (
          <g key={x}>
            <rect x={x} y="72" width="15" height="28" rx="4" fill="var(--background)" stroke="var(--border)" />
            <rect
              x={x + 4.5} y="80" width="6" height="12" rx="1.5"
              fill="var(--muted-foreground)" fillOpacity="0.5"
              className={i >= 3 ? "fv-a fv-m-gulir" : undefined}
              style={i >= 3 ? { animationDelay: `${(i - 3) * 0.4}s` } : undefined}
            />
          </g>
        ))}

        {/* Lencana "Terkirim" */}
        <g className="fv-a fv-m-terkirim">
          <rect x="176" y="112" width="96" height="24" rx="12" fill="var(--success)" fillOpacity="0.15" stroke="var(--success)" strokeOpacity="0.5" />
          <circle cx="190" cy="124" r="6" fill="var(--success)" />
          <path d="M187.2 124.2L189.4 126.4L193 122" stroke="var(--success-foreground)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <text x="202" y="127.2" fontSize="9" fontWeight="600" fill="var(--success)">
            Terkirim
          </text>
        </g>

        {/* Status verifikasi */}
        <circle cx="181" cy="156" r="4" fill="var(--info)" className="fv-a fv-m-denyut" />
        <text x="190" y="159" fontSize="8" fill="var(--muted-foreground)">
          Verifikasi petugas
        </text>
        <circle cx="181" cy="178" r="4" fill="var(--border)" />
        <text x="190" y="181" fontSize="8" fill="var(--muted-foreground)">
          Pantau status
        </text>
      </svg>
    </Bingkai>
  )
}

/* ------------------------------------------------------------------ */
/* 3. Pengaduan Gangguan Air: pipa bocor, petugas datang, tiket selesai */
/* ------------------------------------------------------------------ */
// Satu siklus 9 detik. Persen saat tiap langkah tiket aktif:
//   Diterima 8%, Diverifikasi 30%, Ditangani 52%, Selesai 74%.
// Petugas (garis biru di pipa) jalan 30% sampai 52%, bocor beres setelah 74%.
const SIKLUS_P = 9
const TITIK_P = [8, 30, 52, 74]
const NODE_X = [52, 124, 196, 268]
const LABEL_P = ["Diterima", "Diverifikasi", "Ditangani", "Selesai"]

const CSS_P = `
@keyframes fv-p-cincin{0%{transform:scale(1);opacity:.7}100%{transform:scale(3.2);opacity:0}}
@keyframes fv-p-tetes{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(34px);opacity:0}}
@keyframes fv-p-bocor{0%,70%{opacity:1}76%,94%{opacity:0}100%{opacity:1}}
@keyframes fv-p-beres{0%,72%{opacity:0}78%,92%{opacity:1}96%,100%{opacity:0}}
@keyframes fv-p-jalan{0%,30%{stroke-dashoffset:.22}52%,100%{stroke-dashoffset:-1}}
@keyframes fv-p-petugas{0%,50%{opacity:0}54%,76%{opacity:1}80%,100%{opacity:0}}
.fv-p-cincin{animation:fv-p-cincin 1.8s ease-out infinite}
.fv-p-tetes{animation:fv-p-tetes 1.2s ease-in infinite}
.fv-p-bocor{animation:fv-p-bocor ${SIKLUS_P}s linear infinite}
.fv-p-beres{animation:fv-p-beres ${SIKLUS_P}s linear infinite}
.fv-p-jalan{animation:fv-p-jalan ${SIKLUS_P}s linear infinite}
.fv-p-petugas{animation:fv-p-petugas ${SIKLUS_P}s linear infinite}
${TITIK_P.map(
  (p, i) =>
    `@keyframes fv-p-n${i}{0%,${p - 2}%{opacity:0}${p}%,90%{opacity:1}96%,100%{opacity:0}}.fv-p-n${i}{animation:fv-p-n${i} ${SIKLUS_P}s ease-out infinite}`,
).join("")}
${[0, 1, 2]
  .map(
    (i) =>
      `@keyframes fv-p-g${i}{0%,${TITIK_P[i]}%{stroke-dashoffset:1}${TITIK_P[i + 1] - 3}%,90%{stroke-dashoffset:0}96%,100%{stroke-dashoffset:1}}.fv-p-g${i}{animation:fv-p-g${i} ${SIKLUS_P}s ease-in-out infinite}`,
  )
  .join("")}
${REDUCED}
`

// Pusat kebocoran pada pipa
const BOCOR = { x: 160, y: 76 }

export function VisualPengaduan() {
  return (
    <Bingkai>
      <svg viewBox="0 0 320 244" fill="none" className="block size-full">
        <style>{CSS_P}</style>

        {/* Kartu tiket */}
        <rect x="20" y="14" width="280" height="216" rx="12" fill="var(--muted)" />
        <rect x="20.5" y="14.5" width="279" height="215" rx="11.5" stroke="var(--muted-foreground)" strokeOpacity="0.5" />

        {/* Kepala kartu: ikon, judul, lencana status (Bocor lalu Selesai) */}
        <path d="M40 23C40 23 34 29.5 34 33.5a6 6 0 0 0 12 0C46 29.5 40 23 40 23Z" fill="var(--info)" />
        <text x="54" y="33.5" fontSize="10" fontWeight="600" fill="var(--foreground)">
          Pengaduan
        </text>
        <g className="fv-a fv-p-bocor">
          <rect x="242" y="24" width="46" height="12" rx="6" fill="var(--destructive)" fillOpacity="0.15" />
          <text x="265" y="32.6" fontSize="8" textAnchor="middle" fill="var(--destructive)">
            Bocor
          </text>
        </g>
        <g className="fv-a fv-p-beres" opacity="0">
          <rect x="242" y="24" width="46" height="12" rx="6" fill="var(--success)" fillOpacity="0.15" />
          <text x="265" y="32.6" fontSize="8" textAnchor="middle" fill="var(--success)">
            Selesai
          </text>
        </g>
        <path d="M20 46H300" stroke="var(--border)" />

        {/* Pipa: garis luar dan bagian dalam berongga */}
        <path d="M20 104H110V76H210V104H300" stroke="var(--muted-foreground)" strokeOpacity="0.35" strokeWidth="7" strokeLinejoin="round" />
        <path d="M20 104H110V76H210V104H300" stroke="var(--muted)" strokeWidth="4.5" strokeLinejoin="round" />

        {/* Petugas menuju lokasi: denyut biru yang berjalan di pipa */}
        <path
          d="M20 104H110V76H160"
          stroke="var(--info)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          pathLength={1} strokeDasharray="0.22 2" strokeDashoffset="0.22"
          className="fv-a fv-p-jalan"
        />

        {/* Kebocoran: genangan, tetesan, inti, dan cincin berdenyut */}
        <g className="fv-a fv-p-bocor">
          <ellipse cx={BOCOR.x} cy="119" rx="16" ry="3" fill="var(--info)" fillOpacity="0.25" />
          <ellipse cx="157" cy="82" rx="1.6" ry="2.4" fill="var(--info)" className="fv-a fv-p-tetes" />
          <ellipse cx="164" cy="82" rx="1.6" ry="2.4" fill="var(--info)" className="fv-a fv-p-tetes" style={{ animationDelay: "0.5s" }} />
          <circle
            cx={BOCOR.x} cy={BOCOR.y} r="6" stroke="var(--destructive)" strokeWidth="1.5" strokeOpacity="0.6"
            className="fv-a fv-p-cincin" style={{ transformBox: "fill-box", transformOrigin: "center" }}
          />
          <circle cx={BOCOR.x} cy={BOCOR.y} r="4.5" fill="var(--destructive)" />
        </g>

        {/* Tanda petugas tiba di lokasi */}
        <g className="fv-a fv-p-petugas" opacity="0">
          <path d="M182 65V73" stroke="var(--info)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="182" cy="58" r="7" fill="var(--info)" />
          <circle cx="182" cy="58" r="2.5" fill="var(--background)" />
        </g>

        {/* Bocor sudah diperbaiki */}
        <g className="fv-a fv-p-beres" opacity="0">
          <circle cx={BOCOR.x} cy={BOCOR.y} r="7" fill="var(--success)" />
          <path d="M156.5 76.5L159 79L163.5 74" stroke="var(--success-foreground)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        <path d="M20 138H300" stroke="var(--border)" />

        {/* Alur tiket: garis penghubung (terisi berurutan) */}
        {[0, 1, 2].map((i) => {
          const d = `M${NODE_X[i] + 9} 172H${NODE_X[i + 1] - 9}`
          return (
            <g key={i}>
              <path d={d} stroke="var(--border)" strokeWidth="2" />
              <path
                d={d} stroke="var(--info)" strokeWidth="2" strokeLinecap="round"
                pathLength={1} strokeDasharray="1" strokeDashoffset={i === 0 ? 0 : 1}
                className={`fv-a fv-p-g${i}`}
              />
            </g>
          )
        })}

        {/* Alur tiket: empat langkah */}
        {NODE_X.map((x, i) => {
          const selesai = i === 3
          return (
            <g key={x}>
              <circle cx={x} cy="172" r="9" fill="var(--background)" stroke="var(--border)" strokeWidth="1.5" />
              <g className={`fv-a fv-p-n${i}`} opacity={i < 2 ? 1 : 0}>
                <circle cx={x} cy="172" r="9" fill={selesai ? "var(--success)" : "var(--info)"} />
                <path
                  d={`M${x - 3.5} 172.5L${x - 1} 175L${x + 3.5} 169.5`}
                  stroke={selesai ? "var(--success-foreground)" : "var(--info-foreground)"}
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                />
              </g>
              <text x={x} y="198" fontSize="9" textAnchor="middle" fill="var(--muted-foreground)">
                {LABEL_P[i]}
              </text>
            </g>
          )
        })}
      </svg>
    </Bingkai>
  )
}

/* ------------------------------------------------------------------ */
/* Alias sementara agar import lama tidak putus. Hapus setelah kartu    */
/* fitur memakai nama baru (VisualLaporMeter dan VisualPengaduan).     */
/* ------------------------------------------------------------------ */
export { VisualLaporMeter as VisualStatus, VisualPengaduan as VisualJaringan }