/**
 * beranda-screen.tsx — ruang kerja PETUGAS GANGGUAN. Padanan
 * `features/staff/dashboard/gangguan_home_screen.dart`.
 *
 * Daftar tiket diurutkan menurut URGENSI, bukan waktu masuk: pelanggar SLA
 * lebih dulu, lalu sisa waktu tersedikit. Petugas yang membuka aplikasi di
 * tengah hari harus langsung melihat mana yang paling menuntut, bukan mana
 * yang kebetulan paling baru.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  ChevronRight,
  Clock,
  FileText,
  Inbox,
  PauseCircle,
  Ticket,
  TriangleAlert,
} from 'lucide-react-native';
import {
  labelDari,
  labelJenisPengaduan,
  labelStatusPengaduanStaf,
} from '@workspace/mobile-core';
import {
  Berat,
  GlassPanel,
  MasterPalette as P,
  Spasi,
  StatusBadge,
  Teks,
  TinggiBaris,
  UkuranIkon,
  toneStatusPengaduan,
  useTheme,
} from '@/components';
import { CompactStat, LaunchpadItem, WorkspaceScaffold, WorkspaceSection } from '@/features/pencatat/components/WorkspacePetugas';
import { tiketSaya, type TiketStaf } from './lib/RepositoryGangguan';

/** Status yang masih menuntut tindakan petugas. */
const AKTIF = new Set(['DITUGASKAN', 'DIPROSES', 'DIBUKA_KEMBALI']);

/** Sisa menit "tak terhingga" untuk tiket tanpa SLA — selalu di urutan akhir. */
const TANPA_SLA = Number.MAX_SAFE_INTEGER;

export function BerandaGangguanScreen({
  onBack,
  onBukaTiket,
  onBukaInfoTagihan,
  onBukaNotifikasi,
}: {
  onBack: () => void;
  onBukaTiket: (id: string) => void;
  onBukaInfoTagihan: () => void;
  onBukaNotifikasi: () => void;
}) {
  const { colors } = useTheme();
  const [tiket, setTiket] = useState<TiketStaf[] | null>(null);
  const [memuat, setMemuat] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      setTiket(await tiketSaya().catch(() => []));
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  useFocusEffect(
    useCallback(() => {
      void muat();
    }, [muat]),
  );

  const prioritas = useMemo(() => {
    return (tiket ?? [])
      .filter((t) => AKTIF.has(t.status))
      .slice()
      .sort((a, b) => {
        if (a.lewatSla !== b.lewatSla) return a.lewatSla ? -1 : 1;
        return (a.sla?.sisaMenit ?? TANPA_SLA) - (b.sla?.sisaMenit ?? TANPA_SLA);
      });
  }, [tiket]);

  const aktif = (tiket ?? []).filter((t) => AKTIF.has(t.status)).length;
  const lewatSla = (tiket ?? []).filter((t) => t.lewatSla).length;
  const terjeda = (tiket ?? []).filter((t) => t.status === 'MENUNGGU_PELANGGAN').length;

  return (
    <WorkspaceScaffold
      judul="Petugas Gangguan"
      subjudul="Tiket pengaduan & tindak lanjut"
      onBack={onBack}
      onSegarkan={() => void muat()}
      sedangMuat={memuat}
    >
      <View style={styles.statBaris}>
        <CompactStat label="Tiket Aktif" nilai={tiket == null ? '…' : String(aktif)} ikon={Ticket} />
        <CompactStat
          label="Lewat SLA"
          nilai={tiket == null ? '…' : String(lewatSla)}
          ikon={Clock}
          bahaya={lewatSla > 0}
        />
        <CompactStat
          label="Terjeda"
          nilai={tiket == null ? '…' : String(terjeda)}
          ikon={PauseCircle}
        />
      </View>

      <WorkspaceSection judul="Aplikasi" />
      <GlassPanel padding={0} style={styles.launchpadPanel}>
        <View style={styles.grid}>
          <LaunchpadItem
            ikon={FileText}
            label="Info Tagihan"
            gradasi={[P.sky300, P.sky700]}
            onPress={onBukaInfoTagihan}
          />
          <LaunchpadItem
            ikon={Inbox}
            label="Notifikasi"
            gradasi={[P.teal, P.sky700]}
            onPress={onBukaNotifikasi}
          />
          <View style={styles.slotKosong} />
        </View>
      </GlassPanel>

      <WorkspaceSection judul="Urutan Penanganan" />
      {tiket == null ? (
        <View style={styles.tengah}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : prioritas.length === 0 ? (
        <GlassPanel>
          <Text style={{ color: colors.mutedForeground, fontSize: Teks.xs, lineHeight: TinggiBaris.xs }}>
            Tidak ada tiket aktif yang ditugaskan ke Anda. Tiket baru muncul di sini setelah
            supervisor menugaskannya.
          </Text>
        </GlassPanel>
      ) : (
        prioritas.map((t) => (
          <BarisTiket key={t.id} tiket={t} onPress={() => onBukaTiket(t.id)} />
        ))
      )}
    </WorkspaceScaffold>
  );
}

function BarisTiket({ tiket, onPress }: { tiket: TiketStaf; onPress: () => void }) {
  const { colors } = useTheme();
  const sisa = tiket.sla?.sisaMenit ?? null;

  return (
    <GlassPanel padding={14} onPress={onPress} style={styles.baris}>
      <View style={styles.barisAtas}>
        {tiket.lewatSla ? <TriangleAlert size={UkuranIkon.kecil} color={colors.destructive} /> : null}
        <Text style={[styles.nomorTiket, { color: colors.foreground }]}>{tiket.nomorTiket}</Text>
        <StatusBadge
          label={labelDari(labelStatusPengaduanStaf, tiket.status)}
          tone={toneStatusPengaduan(tiket.status)}
        />
      </View>

      <Text numberOfLines={1} style={[styles.judulTiket, { color: colors.foreground }]}>
        {tiket.judul}
      </Text>
      <Text numberOfLines={1} style={[styles.rincian, { color: colors.mutedForeground }]}>
        {labelDari(labelJenisPengaduan, tiket.jenis)}
        {tiket.alamatKejadian != null ? ` · ${tiket.alamatKejadian}` : ''}
      </Text>

      <View style={styles.barisBawah}>
        <Text
          style={[
            styles.sla,
            { color: tiket.lewatSla ? colors.destructive : colors.mutedForeground },
          ]}
        >
          {tiket.lewatSla
            ? 'Melewati batas SLA'
            : sisa == null
              ? 'Tanpa batas SLA'
              : `Sisa ${formatSisa(sisa)}`}
        </Text>
        <ChevronRight size={UkuranIkon.kecil} color={colors.mutedForeground} />
      </View>
    </GlassPanel>
  );
}

/** Sisa menit → "3j 20m" / "45m" — lebih cepat dibaca daripada angka menit. */
function formatSisa(menit: number): string {
  if (menit < 60) return `${menit}m`;
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return sisa === 0 ? `${jam}j` : `${jam}j ${sisa}m`;
}

const styles = StyleSheet.create({
  statBaris: { flexDirection: 'row', gap: Spasi.md },
  launchpadPanel: { paddingVertical: Spasi.lg, paddingHorizontal: Spasi.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spasi.lg },
  slotKosong: { width: '33.333%' },
  tengah: { paddingVertical: Spasi.xxl, alignItems: 'center' },
  baris: { marginBottom: Spasi.sm },
  barisAtas: { flexDirection: 'row', alignItems: 'center', gap: Spasi.sm },
  nomorTiket: { flex: 1, fontSize: Teks.xs, fontWeight: '700' },
  judulTiket: { fontSize: Teks.sm, fontWeight: '500', marginTop: Spasi.sm },
  rincian: { fontSize: Teks.xs, marginTop: Spasi.xs },
  barisBawah: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spasi.sm,
  },
  sla: { fontSize: Teks.xs, fontWeight: '600' },
});
