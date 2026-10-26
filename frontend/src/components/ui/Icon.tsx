import { Image, type ImageProps } from 'expo-image';
import { useTheme } from './theme';

// Static paths let Metro bundle the local SVGs on web and native.
const icons = {
  ciudades: require('../../../assets/images/ui-svg/ciudades.svg'),
  eventos: require('../../../assets/images/ui-svg/evento.svg'),
  more: require('../../../assets/images/ui-svg/more.svg'),
  'bar-chart': require('../../../assets/images/ui-svg/bar-chart.svg'),
  'line-chart': require('../../../assets/images/ui-svg/line-chart.svg'),
  opciones: require('../../../assets/images/ui-svg/opciones.svg'),
  asistencia: require('../../../assets/images/ui-svg/asistencia.svg'),
  añadir: require('../../../assets/images/ui-svg/añadir.svg'),
  borrar: require('../../../assets/images/ui-svg/borrar.svg'),
  buscar: require('../../../assets/images/ui-svg/buscar.svg'),
  'dar-de-baja': require('../../../assets/images/ui-svg/dar-de-baja.svg'),
  estadisticas: require('../../../assets/images/ui-svg/estadisticas.svg'),
  filtrar: require('../../../assets/images/ui-svg/filtrar.svg'),
  'flecha-der': require('../../../assets/images/ui-svg/flecha-der.svg'),
  'flecha-izq': require('../../../assets/images/ui-svg/flecha-izq.svg'),
  'fotos-galeria': require('../../../assets/images/ui-svg/fotos-galeria.svg'),
  'fotos-subir': require('../../../assets/images/ui-svg/fotos-subir.svg'),
  horarios: require('../../../assets/images/ui-svg/horarios.svg'),
  inicio: require('../../../assets/images/ui-svg/inicio.svg'),
  logout: require('../../../assets/images/ui-svg/logout.svg'),
  'mi-usuario': require('../../../assets/images/ui-svg/mi-usuario.svg'),
  ordenar: require('../../../assets/images/ui-svg/ordenar.svg'),
  precios: require('../../../assets/images/ui-svg/precios.svg'),
  puestos: require('../../../assets/images/ui-svg/puestos.svg'),
  'tema-claro': require('../../../assets/images/ui-svg/tema-claro.svg'),
  'tema-oscuro': require('../../../assets/images/ui-svg/tema-oscuro.svg'),
  usuarios: require('../../../assets/images/ui-svg/usuarios.svg'),
  ventas: require('../../../assets/images/ui-svg/ventas.svg'),
} as const;
export type IconName = keyof typeof icons;
// Optional local assets for the selected state; otherwise use the same icon.
const filled: Partial<Record<IconName, ImageProps['source']>> = {};
export function Icon({
  name,
  selected = false,
  size = 24,
  color,
}: {
  name: IconName;
  selected?: boolean;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <Image
      source={selected ? (filled[name] ?? icons[name]) : icons[name]}
      tintColor={color ?? colors.text}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessible={false}
    />
  );
}
