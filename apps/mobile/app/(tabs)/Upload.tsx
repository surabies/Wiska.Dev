/** Tab Upload — antrean kirim hasil catat, dikelompokkan per rute. */
import { router } from 'expo-router';
import { AntreanUploadScreen } from '@/features/pencatat/AntreanKirim';

export default function Upload() {
  return (
    <AntreanUploadScreen
      onBukaRute={(kodeRute) => router.push({ pathname: '/UploadRute', params: { kodeRute } })}
    />
  );
}
