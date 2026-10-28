import type { ColDef } from "ag-grid-community"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { kunciKolom, teksSel } from "./nilai-sel"
import type { BarisData, DataGridProps } from "./tipe"

/** Susunan kartu: tiga kolom pertama jadi kepala kartu (identitas, nama,
 *  alamat), sisanya jadi pasangan label/nilai. */
function susunKartu(kolom: ColDef[]) {
  const [identitas, nama, alamat, ...rinci] = kolom
  return {
    identitas: identitas as ColDef | undefined,
    nama: nama as ColDef | undefined,
    alamat: alamat as ColDef | undefined,
    rinci,
  }
}

type SusunanKartu = ReturnType<typeof susunKartu>

function KartuBaris({
  row,
  susunan,
  terpilih,
  onRowClicked,
  onRowContextMenu,
}: {
  row: BarisData
  susunan: SusunanKartu
  terpilih: boolean
  onRowClicked?: DataGridProps["onRowClicked"]
  onRowContextMenu?: DataGridProps["onRowContextMenu"]
}) {
  const { identitas, nama, alamat, rinci } = susunan

  return (
    <article
      className={cn(
        "block w-full px-4 py-3.5 text-left transition-colors sm:px-5",
        terpilih
          ? "bg-table-accent"
          : "hover:bg-table-accent",
        onRowClicked && "cursor-pointer"
      )}
      role={onRowClicked ? "button" : undefined}
      tabIndex={onRowClicked ? 0 : undefined}
      aria-pressed={onRowClicked ? terpilih : undefined}
      onClick={onRowClicked ? () => onRowClicked(row) : undefined}
      onKeyDown={
        onRowClicked
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onRowClicked(row)
              }
            }
          : undefined
      }
      onContextMenu={
        onRowContextMenu
          ? (event) => {
              event.preventDefault()
              onRowContextMenu(row, { x: event.clientX, y: event.clientY })
            }
          : undefined
      }
    >
      <dl className="grid min-w-0 gap-3">
        {(identitas || nama) && (
          <div className="grid min-w-0 grid-cols-2 gap-3">
            {identitas && (
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">
                  {identitas.headerName}
                </dt>
                <dd className="mt-0.5 font-mono text-[13px] leading-5 font-medium wrap-break-word text-foreground tabular-nums">
                  {teksSel(identitas, row)}
                </dd>
              </div>
            )}
            {nama && (
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">
                  {nama.headerName}
                </dt>
                <dd className="mt-0.5 text-sm/5 font-medium wrap-break-word text-foreground">
                  {teksSel(nama, row)}
                </dd>
              </div>
            )}
          </div>
        )}

        {alamat && (
          <div className="min-w-0 border-t border-border-subtle pt-2.5">
            <dt className="text-xs text-muted-foreground">
              {alamat.headerName}
            </dt>
            <dd className="mt-0.5 text-sm/5 wrap-break-word text-foreground">
              {teksSel(alamat, row)}
            </dd>
          </div>
        )}

        {rinci.length > 0 && (
          <div className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-2.5 border-t border-border-subtle pt-2.5 min-[420px]:grid-cols-2">
            {rinci.map((column) => (
              <div
                key={kunciKolom(column)}
                className="grid min-w-0 grid-cols-[minmax(5.5rem,0.8fr)_minmax(0,1.2fr)] items-start gap-2 min-[420px]:block"
              >
                <dt className="text-xs leading-5 wrap-break-word text-muted-foreground min-[420px]:mb-0.5">
                  {column.headerName}
                </dt>
                <dd className="min-w-0 text-[13px] leading-5 wrap-break-word text-foreground min-[420px]:font-medium">
                  {teksSel(column, row)}
                </dd>
              </div>
            ))}
          </div>
        )}
      </dl>
    </article>
  )
}

/** Daftar kartu ponsel + keadaan memuat/galat/kosong + tombol muat berikutnya. */
export function DaftarKartu({
  baris,
  kolom,
  idTerpilih,
  memuat,
  galat,
  adaLagi,
  total,
  onRowClicked,
  onRowContextMenu,
  onMuatLagi,
  onCobaLagi,
}: {
  baris: BarisData[]
  kolom: ColDef[]
  idTerpilih?: string | null
  memuat: boolean
  galat: string | null
  adaLagi: boolean
  total: number | null
  onRowClicked?: DataGridProps["onRowClicked"]
  onRowContextMenu?: DataGridProps["onRowContextMenu"]
  onMuatLagi: () => void
  onCobaLagi: () => void
}) {
  const susunan = susunKartu(kolom)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={memuat}>
      {baris.length > 0 ? (
        <ul className="divide-y divide-border-subtle">
          {baris.map((row, index) => {
            const id = String(row.id ?? index)
            return (
              <li key={id}>
                <KartuBaris
                  row={row}
                  susunan={susunan}
                  terpilih={(row as { id?: string }).id === idTerpilih}
                  onRowClicked={onRowClicked}
                  onRowContextMenu={onRowContextMenu}
                />
              </li>
            )
          })}
        </ul>
      ) : memuat ? (
        <div
          role="status"
          className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <Spinner className="size-4" />
          <span>Memuat data…</span>
        </div>
      ) : galat ? (
        <div className="flex min-h-32 flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Data belum dapat dimuat.
          </p>
          <Button variant="outline" size="sm" onClick={onCobaLagi}>
            Coba lagi
          </Button>
        </div>
      ) : (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Tidak ada data untuk ditampilkan.
        </p>
      )}

      {adaLagi && (
        <div className="flex flex-col items-center gap-2 border-t border-border-subtle px-4 py-4">
          <Button
            variant="outline"
            size="sm"
            disabled={memuat}
            onClick={onMuatLagi}
          >
            {memuat ? <Spinner className="size-4" /> : null}
            {memuat ? "Memuat…" : "Muat data berikutnya"}
          </Button>
          {total !== null && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Menampilkan {baris.length.toLocaleString("id-ID")} dari{" "}
              {total.toLocaleString("id-ID")} data
            </p>
          )}
        </div>
      )}
    </div>
  )
}
