/**
 * @file
 * Define contratos de pantallas, repositorio y tests. Distingue fotos, ventas, copias,
 * jornadas, períodos y métricas desconocidas.
 */
// Nombres de rol usados por la interfaz; el repositorio los traduce desde los nombres del servidor.
export type RoleId =
  | 'owner'
  | 'manager'
  | 'secretary'
  | 'editor'
  | 'cameraman'
  | 'seller'
  | 'client';

// Perfil público y estado de acceso del usuario; permisos y jornada pueden actualizarse durante la sesión.
export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  dni: string;
  roleId: RoleId;
  stationId: string;
  stationName?: string | null;
  active: boolean;
  permissions?: readonly string[];
  working?: boolean;
  kioskMode?: boolean;
  checkInActive?: boolean;
  auth0Subject?: string | null;
  authenticationProviders?: string[];
}

export interface Auth0User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  active: boolean;
  identities: { subject: string; provider: string; connection?: string }[];
  authenticationProviders: string[];
}

export type Auth0DirectoryResult =
  { status: 'pending' } | { status: 'complete'; users: Auth0User[] };

// Datos editables del usuario; id distingue edición y password se envía en el alta.
export type EmployeeInput = Omit<
  Employee,
  | 'id'
  | 'active'
  | 'permissions'
  | 'working'
  | 'kioskMode'
  | 'checkInActive'
  | 'stationName'
  | 'auth0Subject'
  | 'authenticationProviders'
> & {
  id?: string;
  password?: string;
};

// Puesto con ubicación, evento y disponibilidad; los inactivos siguen en el historial.
export interface Station {
  id: string;
  name: string;
  city: string;
  event: string;
  cityId?: string;
  eventId?: string;
  active?: boolean;
}

// El alta usa un nombre propio y un evento existente que determina la ciudad.
export interface StationInput {
  name: string;
  eventId: string;
}

export interface City {
  id: string;
  name: string;
}
export interface LocationEvent {
  directions: string;
  id: string;
  name: string;
  cityId: string;
}
export interface CityInput {
  id?: string;
  name: string;
  eventCities: { eventId: string; cityId: string | null }[];
}
export interface LocationEventInput {
  directions: string;
  id?: string;
  name: string;
  cityId: string;
  stationIds: string[];
}
export interface StationUpdateInput {
  stationId: string;
  name: string;
  cityId: string;
  eventId: string | null;
  employeeStations: { employeeId: string; stationId: string }[];
}

// Metadatos de una foto/familia; la URL privada se solicita aparte y puede vencer.
export interface Photo {
  id: string;
  operationId: string;
  stationId: string;
  employeeId: string;
  date: string;
  name: string;
  uri: string;
  createdAt: string;
  clientId?: string | null;
  clientEmail?: string | null;
}

// Archivo seleccionado: key mantiene el UUID de carga entre reintentos.
export interface PhotoFile {
  key: string;
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
  file?: File;
  clientId?: string;
}

// Resultado por UUID: la ausencia de error indica que la API confirmó el guardado.
export interface UploadResult {
  key: string;
  error?: string;
}

// Conteos por puesto y día; sold representa familias compradoras, no copias impresas.
export interface DayCount {
  stationId: string;
  date: string;
  taken: number;
  sold?: number;
  revenue?: number;
  discarded?: number | null;
}

// Venta histórica: quantity cuenta familias y copies representa unidades físicas.
export interface Sale {
  id: string;
  operationId: string;
  employeeId: string;
  stationId: string;
  date: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
  copies?: number | null;
  paymentMethod?: string | null;
}

// Tarifa por puesto con importe decimal textual para conservar los centavos.
export interface Price {
  id: string;
  name: string;
  amount: string;
  stationId: string;
  active?: boolean;
}

// Contrato del alta: UUID estable, foto del evento y copias por tarifa, sin importe decidido por el cliente.
export interface EventSaleInput {
  operationId: string;
  photoId: string;
  stationId: string;
  paymentMethod: 'efectivo' | 'transferencia' | 'tarjeta';
  prices: { priceId: string; copies: number }[];
}

// Foto seleccionable del evento con indicador de ventas y destinatario opcional.
export interface SalePhoto {
  id: string;
  date: string;
  sold: boolean;
  clientId?: string | null;
  clientEmail?: string | null;
}

// Turno abierto: sin checkOut ni closedAt. closedAt registra el cierre sin salida.
export interface Attendance {
  id: string;
  employeeId: string;
  stationId: string;
  date: string;
  checkIn: string;
  checkOut: string | null;
  closedAt: string | null;
}

// Empleado elegible del kiosco con el turno esperado para validar la siguiente marcación.
export interface CheckInEmployee {
  id: string;
  firstName: string;
  lastName: string;
  working: boolean;
  attendanceId: string | null;
}

// Snapshot compartido que reúne catálogos y colecciones autorizadas para las pantallas.
export interface AppData {
  cities?: City[];
  events?: LocationEvent[];
  employees: Employee[];
  stations: Station[];
  counts: DayCount[];
  photos: Photo[];
  sales: Sale[];
  attendance: Attendance[];
  roles?: { id: string; roleId: RoleId }[];
  reports?: StationReport[];
  summary?: ReportMetrics;
}

// Indicadores comerciales: null conserva datos desconocidos o inconsistentes, sin convertirlos en cero.
export interface ReportMetrics {
  taken: number | null;
  sold: number;
  earnings: number;
  discarded: number | null;
  percentage: number | null;
}

// Indicadores de un puesto con cobertura e inconsistencias del período consultado.
export interface StationReport extends ReportMetrics {
  station: Station;
  registeredDays: number;
  expectedDays: number;
  invalidDays: number;
}

// Filtros de fecha y puesto; ciudad y evento agregan restricciones a los informes.
export interface Period {
  from: string;
  to: string;
  stationId: string;
  city?: string;
  event?: string;
  scopeIds?: string[];
  stationIds?: string[];
}
