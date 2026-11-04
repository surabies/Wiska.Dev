/**
 * field.tsx — input teks berlabel komposit (pengganti `TextField` lama).
 * Dibangun dari primitif react-native-reusables: Label + Input + Text, semua
 * berbasis `className`/NativeWind. Layar cukup mengoper `label`, `error`,
 * `description` seperti sebelumnya; validasi tetap dikelola state layar.
 */
import * as React from 'react';
import { View } from 'react-native';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type FieldProps = React.ComponentProps<typeof Input> & {
  label?: string;
  /** Pesan galat validasi; bila ada, border & teks bantuan jadi destruktif. */
  error?: string | null;
  /** Teks bantuan di bawah input saat tidak ada galat. */
  description?: string;
  containerClassName?: string;
};

function Field({ label, error, description, containerClassName, className, ...props }: FieldProps) {
  const help = error ?? description;
  return (
    <View className={cn('gap-1.5', containerClassName)}>
      {label ? <Label>{label}</Label> : null}
      <Input
        className={cn(
          'h-11',
          props.multiline && 'h-auto min-h-24 py-2',
          error && 'border-destructive',
          className
        )}
        style={props.multiline ? { textAlignVertical: 'top' } : undefined}
        {...props}
      />
      {help ? (
        <Text
          className={cn(
            'text-xs leading-4',
            error ? 'text-destructive' : 'text-muted-foreground'
          )}>
          {help}
        </Text>
      ) : null}
    </View>
  );
}

export { Field };
export type { FieldProps };
