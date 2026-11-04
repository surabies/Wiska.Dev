/**
 * icon-button.tsx — tombol ikon bulat kecil (padanan `ShadIconButton`).
 * Dipakai untuk aksi sekunder ringkas (mis. muat ulang, tutup).
 */
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { Tekan } from './Tekan';

import { useTheme } from './theme/ThemeContext';
import { Radius } from './theme/Ukuran';

export interface IconButtonProps {
  name: ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  size?: number;
  color?: string;
  disabled?: boolean;
  variant?: 'ghost' | 'secondary';
}

export function IconButton({
  name,
  onPress,
  size = 20,
  color,
  disabled = false,
  variant = 'ghost',
}: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Tekan
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        styles.btn,
        { borderRadius: Radius.bundar },
        variant === 'secondary' && { backgroundColor: colors.secondary },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Ionicons name={name} size={size} color={color ?? colors.foreground} />
    </Tekan>
  );
}

const styles = StyleSheet.create({
  btn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.5 },
  disabled: { opacity: 0.4 },
});
