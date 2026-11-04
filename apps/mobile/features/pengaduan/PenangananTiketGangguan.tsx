/**
 * tiket-screen.tsx — detail satu tiket pengaduan + tindak lanjut petugas.
 * Padanan `features/staff/pengaduan/pengaduan_staff_screen.dart`.
 *
 * TOMBOL STATUS DIBANGUN DARI `transisiTersedia` YANG DIKIRIM SERVER, bukan
 * dari daftar yang ditulis di aplikasi. Menyalin matriks transisi ke sini
 * berarti dua sumber kebenaran yang pasti menyimpang, dan petugas akan
 * menekan tombol yang ditolak server tanpa tahu sebabnya.
 *
 * `SELESAI` memerlukan catatan penyelesaian DAN foto bukti — server menolak
 * tanpa keduanya. Layar ini meminta keduanya lebih dulu supaya penolakan itu
 * tidak terjadi setelah petugas telanjur pergi dari lokasi.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  CheckCircle2,
  MessageSquare,
  Send,
  TriangleAlert,
} from 'lucide-react-native';
import {
  ApiException,
  formatWaktuLokal,
  labelAksiStatusPengaduan,
  labelDari,
  labelJenisPengaduan,
  labelStatusPengaduanStaf,
} from '@workspace/mobile-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Text as UIText } from '@/components/ui/text';
import { AppDialog } from '@/components/ui/app-dialog';
import {
  Radius,
  Berat,
  GlassPanel,
  Kelas,
  Spasi,
  StatusBadge,
  Teks,
  TinggiBaris,
  UkuranIkon,
  toneStatusPengaduan,
  useTheme,
} from '@/components';
import { WorkspaceScaffold } from '@/features/pencatat/components/WorkspacePetugas';
import { MediaError, ambilFoto } from '@/features/shared/MediaLokal';
import {
  detailTiket,
  kirimChat,
  tambahCatatan,
  ubahStatus,
  unggahFotoBukti,
  type TiketStaf,
} from './lib/RepositoryGangguan';

export function TiketScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const { colors } = useTheme();
  const [tiket, setTiket] = useState<TiketStaf | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const [catatan, setCatatan] = useState('');
  const [chat, setChat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  // Dialog penyelesaian — status SELESAI butuh catatan + foto bukti.
  const [dialogSelesai, setDialogSelesai] = useState(false);
  const [catatanSelesai, setCatatanSelesai] = useState('');
  const [fotoSelesai, setFotoSelesai] = useState<string | null>(null);
  const [statusTujuan, setStatusTujuan] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      setTiket(await detailTiket(id));
    } catch (err) {
      setGalat(err instanceof ApiException ? err.message : 'Gagal memuat tiket.');
    } finally {
      setMemuat(false);
    }
  }, [id]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const pindahStatus = async (status: string) => {
    if (status === 'SELESAI') {
      setStatusTujuan(status);
      setDialogSelesai(true);
      return;
    }
    setSibuk(true);
    setGalat(null);
    try {
      await ubahStatus(id, status);
      setPesan(`Status dipindahkan ke ${labelDari(labelStatusPengaduanStaf, status)}.`);
      await muat();
    } catch (err) {
      setGalat(err instanceof ApiException ? err.message : 'Gagal mengubah status.');
    } finally {
      setSibuk(false);
    }
  };

  const selesaikan = async () => {
    if (tiket == null || statusTujuan == null) return;
    if (catatanSelesai.trim().length === 0 || fotoSelesai == null) {
      setGalat('Catatan penyelesaian dan foto bukti wajib diisi sebelum menutup tiket.');
      return;
    }
    setSibuk(true);
    setGalat(null);
    try {
      const url = await unggahFotoBukti(tiket.nomorTiket, fotoSelesai);
      await ubahStatus(id, statusTujuan, {
        catatanPenyelesaian: catatanSelesai.trim(),
        fotoPenyelesaianUrl: url,
      });
      setDialogSelesai(false);
      setCatatanSelesai('');
      setFotoSelesai(null);
      setPesan('Tiket ditandai selesai beserta bukti pekerjaannya.');
      await muat();
    } catch (err) {
      setGalat(err instanceof ApiException ? err.message : 'Gagal menyelesaikan tiket.');
    } finally {
      setSibuk(false);
    }
  };

  const kirimCatatan = async () => {
    if (catatan.trim().length === 0) return;
    setSibuk(true);
    setGalat(null);
    try {
      await tambahCatatan(id, catatan.trim());
      setCatatan('');
      setPesan('Catatan internal tersimpan.');
    } catch (err) {
      setGalat(err instanceof ApiException ? err.message : 'Gagal menyimpan catatan.');
    } finally {
      setSibuk(false);
    }
  };

  const kirimPesanWarga = async () => {
    if (chat.trim().length === 0) return;
    setSibuk(true);
    setGalat(null);
    try {
      await kirimChat(id, chat.trim());
      setChat('');
      setPesan('Pesan terkirim ke pelapor.');
    } catch (err) {
      setGalat(err instanceof ApiException ? err.message : 'Gagal mengirim pesan.');
    } finally {
      setSibuk(false);
    }
  };

  const ambilBukti = async () => {
    setGalat(null);
    try {
      const uri = await ambilFoto('kamera');
      if (uri != null) setFotoSelesai(uri);
    } catch (err) {
      setGalat(err instanceof MediaError ? err.message : 'Kamera tidak tersedia.');
    }
  };

  return (
    <WorkspaceScaffold
      judul={tiket?.nomorTiket ?? 'Tiket'}
      subjudul={tiket == null ? 'Memuat…' : labelDari(labelJenisPengaduan, tiket.jenis)}
      onBack={onBack}
      onSegarkan={() => void muat()}
      sedangMuat={memuat}
    >
      {memuat && tiket == null ? (
        <View style={styles.tengah}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : tiket == null ? (
        <Alert icon={TriangleAlert} variant="destructive">
          <AlertTitle>Tiket tidak terbaca</AlertTitle>
          <AlertDescription>{galat ?? 'Coba segarkan halaman ini.'}</AlertDescription>
        </Alert>
      ) : (
        <>
          <GlassPanel padding={14}>
            <View style={styles.kepala}>
              <StatusBadge
                label={labelDari(labelStatusPengaduanStaf, tiket.status)}
                tone={toneStatusPengaduan(tiket.status)}
              />
              {tiket.lewatSla ? (
                <Text style={[styles.slaLewat, { color: colors.destructive }]}>Lewat SLA</Text>
              ) : null}
            </View>
            <Text style={[styles.judul, { color: colors.foreground }]}>{tiket.judul}</Text>
            <Text style={[styles.deskripsi, { color: colors.mutedForeground }]}>
              {tiket.deskripsi}
            </Text>

            <View style={styles.metaBlok}>
              <Meta label="Pelapor" nilai={tiket.pelapor} />
              {tiket.kontakPelapor != null ? (
                <Meta label="Kontak" nilai={tiket.kontakPelapor} />
              ) : null}
              {tiket.nomorLangganan != null ? (
                <Meta label="No. langganan" nilai={tiket.nomorLangganan} />
              ) : null}
              {tiket.alamatKejadian != null ? (
                <Meta label="Lokasi" nilai={tiket.alamatKejadian} />
              ) : null}
              {tiket.createdAt != null ? (
                <Meta label="Dilaporkan" nilai={formatWaktuLokal(tiket.createdAt)} />
              ) : null}
            </View>

            {tiket.fotoUrl != null ? (
              <Image source={{ uri: tiket.fotoUrl }} style={styles.fotoLaporan} resizeMode="cover" />
            ) : null}
          </GlassPanel>

          {pesan != null ? (
            <View style={styles.jarak}>
              <Alert icon={CheckCircle2}>
                <AlertTitle>Berhasil</AlertTitle>
                <AlertDescription>{pesan}</AlertDescription>
              </Alert>
            </View>
          ) : null}

          {galat != null ? (
            <View style={styles.jarak}>
              <Alert icon={TriangleAlert} variant="destructive">
                <AlertTitle>Gagal</AlertTitle>
                <AlertDescription>{galat}</AlertDescription>
              </Alert>
            </View>
          ) : null}

          <GlassPanel padding={14} style={styles.jarak}>
            <Text style={[styles.judulKartu, { color: colors.foreground }]}>Tindak lanjut</Text>
            {tiket.transisiTersedia.length === 0 ? (
              <Text style={[styles.keterangan, { color: colors.mutedForeground }]}>
                Tidak ada perpindahan status yang tersedia untuk Anda pada tiket ini.
                Menutup/membuka kembali tiket adalah hak pelapor.
              </Text>
            ) : (
              tiket.transisiTersedia.map((status) => (
                <Button
                  key={status}
                  variant={status === 'SELESAI' ? 'default' : 'outline'}
                  onPress={() => void pindahStatus(status)}
                  disabled={sibuk}
                  className="mt-2 w-full"
                >
                  <UIText>{labelDari(labelAksiStatusPengaduan, status)}</UIText>
                </Button>
              ))
            )}
          </GlassPanel>

          <GlassPanel padding={14} style={styles.jarak}>
            <Text style={[styles.judulKartu, { color: colors.foreground }]}>Catatan internal</Text>
            <Text style={[styles.keterangan, { color: colors.mutedForeground }]}>
              Hanya dibaca petugas & kantor — tidak tampil di pelacakan warga.
            </Text>
            <Textarea
              value={catatan}
              onChangeText={setCatatan}
              placeholder="Mis. pipa dinas bocor di bahu jalan, perlu alat gali."
              numberOfLines={3}
            />
            <Button
              variant="outline"
              onPress={kirimCatatan}
              disabled={sibuk || catatan.trim().length === 0}
              className="mt-3 w-full"
            >
              <MessageSquare size={UkuranIkon.kecil} color={colors.foreground} />
              <UIText>Simpan Catatan</UIText>
            </Button>
          </GlassPanel>

          <GlassPanel padding={14} style={styles.jarak}>
            <Text style={[styles.judulKartu, { color: colors.foreground }]}>Pesan ke pelapor</Text>
            <Text style={[styles.keterangan, { color: colors.mutedForeground }]}>
              SELALU publik — tampil sebagai percakapan di halaman pelacakan warga.
            </Text>
            <Textarea
              value={chat}
              onChangeText={setChat}
              placeholder="Mis. petugas menuju lokasi, mohon ditunggu."
              numberOfLines={3}
            />
            <Button
              onPress={kirimPesanWarga}
              disabled={sibuk || chat.trim().length === 0}
              className="mt-3 w-full"
            >
              <Send size={UkuranIkon.kecil} color={colors.primaryForeground} />
              <UIText>Kirim ke Pelapor</UIText>
            </Button>
          </GlassPanel>
        </>
      )}

      <AppDialog
        visible={dialogSelesai}
        onDismiss={sibuk ? undefined : () => setDialogSelesai(false)}
        title="Selesaikan Tiket"
        description="Catatan penyelesaian dan foto bukti pekerjaan wajib — keduanya menjadi lampiran resmi tiket ini."
      >
        <View style={styles.isiDialog}>
          <Textarea
            value={catatanSelesai}
            onChangeText={setCatatanSelesai}
            placeholder="Apa yang dikerjakan di lokasi?"
            numberOfLines={3}
          />
          <Button variant="outline" onPress={ambilBukti} disabled={sibuk} className="mt-3 w-full">
            <Camera size={UkuranIkon.kecil} color={colors.foreground} />
            <UIText>{fotoSelesai == null ? 'Ambil Foto Bukti' : 'Ganti Foto Bukti'}</UIText>
          </Button>
          {fotoSelesai != null ? (
            <Image source={{ uri: fotoSelesai }} style={styles.pratinjauBukti} resizeMode="cover" />
          ) : null}
          <Button
            onPress={selesaikan}
            disabled={sibuk || catatanSelesai.trim().length === 0 || fotoSelesai == null}
            className="mt-3 w-full"
          >
            {sibuk ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : null}
            <UIText>Tandai Selesai</UIText>
          </Button>
          <Button
            variant="outline"
            onPress={() => setDialogSelesai(false)}
            disabled={sibuk}
            className="mt-2 w-full"
          >
            <UIText>Batal</UIText>
          </Button>
        </View>
      </AppDialog>
    </WorkspaceScaffold>
  );
}

function Meta({ label, nilai }: { label: string; nilai: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.metaBaris}>
      <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.metaNilai, { color: colors.foreground }]}>{nilai}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tengah: { paddingVertical: 48, alignItems: 'center' },
  jarak: { marginTop: Spasi.lg },
  kepala: { flexDirection: 'row', alignItems: 'center', gap: Spasi.sm },
  slaLewat: { fontSize: Teks.xs, fontWeight: '700' },
  judul: { fontSize: Teks.sm, fontWeight: '600', marginTop: Spasi.sm },
  deskripsi: { fontSize: Teks.xs, marginTop: Spasi.sm, lineHeight: TinggiBaris.xs },
  metaBlok: { marginTop: Spasi.md, gap: Spasi.xs },
  metaBaris: { flexDirection: 'row', gap: Spasi.md },
  metaLabel: { width: 104, fontSize: Teks.xs },
  metaNilai: { flex: 1, fontSize: Teks.xs },
  fotoLaporan: { width: '100%', height: 180, borderRadius: Radius.kontrol, marginTop: Spasi.md },
  judulKartu: { fontSize: Teks.sm, fontWeight: '600' },
  keterangan: { fontSize: Teks.xs, marginTop: Spasi.xs, marginBottom: Spasi.md, lineHeight: TinggiBaris.xs },
  isiDialog: { paddingTop: 4 },
  pratinjauBukti: { width: '100%', height: 150, borderRadius: Radius.kontrol, marginTop: Spasi.md },
});
