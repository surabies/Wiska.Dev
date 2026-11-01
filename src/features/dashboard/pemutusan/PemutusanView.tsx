import { PemutusanGrid } from "./components/PemutusanGrid"
import { TerapkanStatusPemutusan } from "./components/TerapkanStatus"

export function PemutusanView() {
  return (
    <div className="flex flex-col gap-4">
      <TerapkanStatusPemutusan />
      <PemutusanGrid />
    </div>
  )
}
