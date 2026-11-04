/**
 * MacAppIcon.tsx — Komponen ikon ubin bergaya aplikasi macOS (Big Sur / Sonoma / Sequoia).
 * Menampilkan squircle continuous, gradasi kaya kedalaman, inset highlight kaca di tepi atas,
 * dan bayangan ambient berwarna khas icon macOS asli.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';

export interface MacAppIconProps {
  ikon: LucideIcon;
  gradasi: [string, string];
  size?: number;
  iconSize?: number;
  glowColor?: string;
}

export function MacAppIcon({
  ikon: Ikon,
  gradasi,
  size = 52,
  iconSize = 26,
  glowColor,
}: MacAppIconProps) {
  const radius = Math.round(size * 0.4); // Kurvatur squircle macOS (~21dp untuk 52dp)
  const warnaBayangan = glowColor ?? gradasi[1];

  return (
    <View
      style={[
        styles.wadahLuar,
        {
          width: size,
          height: size,
          borderRadius: radius,
          boxShadow: `0px 7px 16px ${warnaBayangan}4D, 0px 2px 4px rgba(0, 0, 0, 0.12)`,
        },
      ]}
    >
      <LinearGradient
        colors={gradasi}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          styles.gradasi,
          {
            borderRadius: radius,
          },
        ]}
      >
        {/* Lapisan kilau kaca atas (Apple glass inset highlight) */}
        <View
          style={[
            styles.kilauAtas,
            {
              borderRadius: radius,
            },
          ]}
        />

        {/* Ikon Lucide di tengah */}
        <Ikon size={iconSize} color="#FFFFFF" strokeWidth={2.2} />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wadahLuar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradasi: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.45)',
    borderLeftColor: 'rgba(255, 255, 255, 0.22)',
    borderRightColor: 'rgba(255, 255, 255, 0.22)',
    borderBottomColor: 'rgba(0, 0, 0, 0.25)',
    overflow: 'hidden',
  },
  kilauAtas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
});
