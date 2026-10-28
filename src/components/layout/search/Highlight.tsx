// components/layout/search/Highlight.tsx
// Tugas: memberi garis bawah biru pada bagian teks yang sama dengan kata kunci.
// Contoh: text="Safelisting", query="saf" -> "Saf" bergaris bawah, "elisting" biasa.

export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim()
  if (!q) return <>{text}</> // tanpa kata kunci: tampilkan teks apa adanya

  // Tahap 1: amankan karakter khusus regex (misal "." atau "(") agar dianggap teks biasa
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  // Tahap 2: split dengan tanda kurung () membuat bagian yang cocok IKUT tersimpan di array
  // "i" = tidak peduli huruf besar/kecil
  const parts = text.split(new RegExp(`(${escaped})`, "i"))

  return (
    <>
      {parts.map((part, i) =>
        // Tahap 3: bagian yang sama dengan kata kunci dibungkus <mark>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark
            key={i}
            className="bg-transparent text-sky-500 underline decoration-2 underline-offset-4"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}
