/**
 * select-field.tsx — dropdown berlabel komposit (pengganti `Select` custom lama).
 * Dibangun dari primitif react-native-reusables (shadcn) Select + Label + Text,
 * semua berbasis `className`/NativeWind. API tetap sederhana: `options` string,
 * `value` string, `onValueChange(value)` — validasi dikelola state layar.
 */
import * as React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { Kelas } from '@/components';
import { cn } from '@/lib/utils';

export interface SelectFieldOption {
  value: string;
  label: string;
}

export function SelectField({
  label,
  placeholder,
  options,
  value,
  onValueChange,
  error,
  containerClassName,
}: {
  label?: string;
  placeholder?: string;
  options: SelectFieldOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  error?: string | null;
  containerClassName?: string;
}) {
  const insets = useSafeAreaInsets();
  const contentInsets = { top: insets.top, bottom: insets.bottom, left: 12, right: 12 };
  const terpilih = options.find((o) => o.value === value);

  return (
    <View className={cn('gap-1.5', containerClassName)}>
      {label ? <Label>{label}</Label> : null}
      <Select
        value={terpilih ? { value: terpilih.value, label: terpilih.label } : undefined}
        onValueChange={(opt) => {
          if (opt) onValueChange(opt.value);
        }}>
        <SelectTrigger className={cn(Kelas.select, 'w-full', error && 'border-destructive')}>
          <SelectValue placeholder={placeholder ?? 'Pilih…'} />
        </SelectTrigger>
        {/* Lebar TIDAK dipaksa `w-full` lagi: di dalam portal, "full" berarti
            selebar layar, bukan selebar pemicunya — itu yang membuat tepi
            panel meleset keluar dari kotaknya. SelectContent kini mengambil
            lebar dari pemicu, sama seperti shadcn di web. */}
        <SelectContent insets={contentInsets}>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} label={o.label} />
          ))}
        </SelectContent>
      </Select>
      {error ? <Text className="text-destructive text-xs leading-4">{error}</Text> : null}
    </View>
  );
}
