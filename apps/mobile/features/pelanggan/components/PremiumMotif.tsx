/**
 * premium-motif.tsx — motif dekoratif premium untuk header/kartu berwarna:
 * cincin "riak air" (padanan HeroRipplePainter Flutter) + orb cahaya radial.
 * Murni hiasan (pointerEvents none), di-clip oleh induk yang overflow:hidden.
 *
 * Memakai react-native-svg supaya orb benar-benar radial (memudar ke
 * transparan) dan riak berupa cincin garis tipis — bukan lingkaran solid.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

export function PremiumMotif({
  idPrefix,
  tint = '#FFFFFF',
  orbOpacity = 0.22,
}: {
  /** Prefix id gradient unik per pemakaian (hindari bentrok antar-SVG). */
  idPrefix: string;
  /** Warna riak & orb (biasanya putih di atas latar berwarna). */
  tint?: string;
  orbOpacity?: number;
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Orb cahaya kanan-atas — radial memudar ke transparan. */}
      <Svg width={200} height={200} style={styles.orb}>
        <Defs>
          <RadialGradient id={`${idPrefix}-orb`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={tint} stopOpacity={orbOpacity} />
            <Stop offset="100%" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={200} height={200} fill={`url(#${idPrefix}-orb)`} />
      </Svg>

      {/* Riak air kanan-bawah — 4 cincin garis makin redup ke luar. */}
      <Svg width={260} height={260} style={styles.ripple}>
        {[0, 1, 2, 3].map((i) => (
          <Circle
            key={i}
            cx={130}
            cy={130}
            r={60 + i * 40}
            fill="none"
            stroke={tint}
            strokeWidth={1.5}
            strokeOpacity={0.18 - i * 0.04}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  orb: { position: 'absolute', top: -40, right: -20 },
  ripple: { position: 'absolute', bottom: -60, right: -60 },
});
