// components — komponen custom & tema aplikasi Tirtawening.
export * from './theme';

export { PremiumBackground } from './PremiumBackground';
export { GlassPanel, type GlassPanelProps } from './GlassPanel';
export { AppScaffold, type AppScaffoldProps } from './AppScaffold';
export { BottomDock, TINGGI_DOCK, JANGKAUAN_SCAN, type DockItem, type BottomDockProps } from './BottomDock';
export { ScreenPlaceholder } from './ScreenPlaceholder';
export { Screen, type ScreenProps } from './Screen';
export { MacAppIcon, type MacAppIconProps } from './MacAppIcon';

export {
  StatusBadge,
  type StatusTone,
  toneStatusTagihan,
  toneStatusLaporan,
  toneStatusPengaduan,
  tonePrioritas,
} from './StatusBadge';
export { IconButton, type IconButtonProps } from './IconButton';
export { PhotoBox, type PhotoBoxProps } from './PhotoBox';
export { SectionHeader } from './SectionHeader';
export { Tekan, type TekanProps } from './Tekan';
export { RuangDockProvider, useRuangDock } from './RuangDock';
