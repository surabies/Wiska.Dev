/**
 * dialog-konfirmasi.tsx — dialog "yakin?" dua tombol di atas [AppDialog].
 *
 * Dipakai untuk tindakan yang TIDAK BISA dibatalkan di lapangan: keluar akun,
 * membuang baris antrean, mengganti paket rute. Semuanya berpotensi membuang
 * hasil kerja, jadi tidak satu pun boleh terjadi karena satu ketukan meleset.
 */
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { AppDialog } from '@/components/ui/app-dialog';
import { Button } from '@/components/ui/button';
import { Text as UIText } from '@/components/ui/text';
import { useTheme } from '@/components';

export function DialogKonfirmasi({
  visible,
  judul,
  deskripsi,
  labelKonfirmasi = 'Lanjutkan',
  destruktif = false,
  onTutup,
  onKonfirmasi,
}: {
  visible: boolean;
  judul: string;
  deskripsi: string;
  labelKonfirmasi?: string;
  destruktif?: boolean;
  onTutup: () => void;
  onKonfirmasi: () => void | Promise<void>;
}) {
  const { colors } = useTheme();
  const [sibuk, setSibuk] = useState(false);

  const jalankan = async () => {
    setSibuk(true);
    try {
      await onKonfirmasi();
      onTutup();
    } finally {
      setSibuk(false);
    }
  };

  return (
    <AppDialog
      visible={visible}
      onDismiss={sibuk ? undefined : onTutup}
      title={judul}
      description={deskripsi}
      actions={
        <>
          <Button
            variant={destruktif ? 'destructive' : 'default'}
            onPress={jalankan}
            disabled={sibuk}
            className="w-full"
          >
            {sibuk ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : null}
            <UIText>{labelKonfirmasi}</UIText>
          </Button>
          <Button variant="outline" onPress={onTutup} disabled={sibuk} className="w-full">
            <UIText>Batal</UIText>
          </Button>
        </>
      }
    />
  );
}
