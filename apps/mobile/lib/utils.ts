// utils.ts — helper `cn` (padanan shadcn/ui). Gabungkan className bersyarat
// via clsx lalu selesaikan konflik utility Tailwind via tailwind-merge.
// Dipakai oleh komponen react-native-reusables (NativeWind/className).
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
