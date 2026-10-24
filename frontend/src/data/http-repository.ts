/**
 * @file
 * Traduce HTTP a modelos de pantalla y concentra operaciones. Recupera permisos actuales,
 * normaliza IDs/fechas y carga recursos permitidos.
 */
import type {
  AppData,
  Attendance,
  Employee,
  EmployeeInput,
  Period,
  Photo,
  PhotoFile,
  RoleId,
  Sale,
  Station,
  StationInput,
  UploadResult,
  Price,
  EventSaleInput,
  SalePhoto,
  CheckInEmployee,
} from '../domain/models';
import { canWork } from '../domain/permissions';
import { businessDate, periodError, utcInstant } from '../domain/dates';
import { errorMessage } from '../domain/format';
import { ApiClient } from './api-client';
import { photoForm } from './photo-form';
import type { SessionStorage } from './session-persistence';
import type { GraphicsData, GraphicValues } from '../domain/graphics';

// Los nombres del backend se traducen a roles de interfaz; los IDs de base se resuelven por catálogo.
const roles: Record<string, RoleId> = {
  dueno: 'owner',
  encargado: 'manager',
  secretario: 'secretary',
  camarografo: 'photographer',
  vendedor: 'seller',
  cliente: 'client',
};
interface UserRow extends Omit<Employee, 'roleId' | 'stationId'> {
  role: string;
  roleId: string;
  stationId: string | null;
}
interface PhotoRow {
  id: string;
  stationId: string;
  date: string;
  clientId: string | null;
  clientEmail?: string | null;
}
interface DayRow {
  stationId: string;
  date: string;
  taken: number | string;
  sold: number | string;
  revenue: string;
  discarded: number | string | null;
}
interface ReportRow {
  stationId: string;
  registeredDays: number | string;
  expectedDays: number | string;
  invalidDays: number | string;
  taken: number | string | null;
  sold: number | string;
  revenue: string;
  discarded: number | string | null;
  percentage: number | string | null;
}
// Convierte valores SQL a número conservando null como dato desconocido.
const nullableNumber = (value: number | string | null) =>
  value === null ? null : Number(value);
// Adapta indicadores remotos a los nombres usados por la interfaz.
const metrics = (
  row: Omit<
    ReportRow,
    'stationId' | 'registeredDays' | 'expectedDays' | 'invalidDays'
  >,
) => ({
  taken: nullableNumber(row.taken),
  sold: Number(row.sold),
  earnings: Number(row.revenue),
  discarded: nullableNumber(row.discarded),
  percentage: nullableNumber(row.percentage),
});
// Traduce roles de la API y normaliza identificadores para el modelo Employee.
function user(row: UserRow): Employee {
  const roleId = roles[row.role];
  if (!roleId) throw new Error('El servidor devolvió un rol desconocido.');
  return {
    ...row,
    id: String(row.id),
    roleId,
    stationId: row.stationId === null ? '' : String(row.stationId),
  };
}

export class HttpFotoYaRepository {
  private profileRevision = 0;
  onProfile?: (employee: Employee) => void;
  // Permite al proveedor recibir actualizaciones del perfil desde el repositorio.
  setOnProfile(listener?: (employee: Employee) => void) {
    this.onProfile = listener;
  }
  constructor(
    public api: ApiClient,
    private sessionStorage?: SessionStorage,
  ) {}

  async graphics(period: Period, day?: string): Promise<GraphicsData> {
    const invalid = periodError(period.from, period.to);
    if (invalid) throw new Error(invalid);
    const actor = await this.profile();
    const stationId =
      actor.roleId === 'manager' ? actor.stationId : period.stationId;
    const raw = await this.api.post<GraphicsData>('reports/graphics/query', {
      from: period.from,
      to: period.to,
      ...(stationId ? { stationId } : {}),
      ...(day ? { day } : {}),
    });
    const values = (row: GraphicValues): GraphicValues => ({
      earnings: Number(row.earnings),
      sales: Number(row.sales),
      sold: Number(row.sold),
      taken: row.taken === null ? null : Number(row.taken),
    });
    return {
      days: raw.days.map((row) => ({
        ...row,
        ...values(row),
        stationId: String(row.stationId),
      })),
      hours: raw.hours.map((row) => ({
        ...row,
        ...values(row),
        stationId: String(row.stationId),
        hour: row.hour === null ? null : Number(row.hour),
      })),
      people: raw.people.map((row) => ({
        ...row,
        ...values(row),
        stationId: String(row.stationId),
        employeeId: row.employeeId === null ? null : String(row.employeeId),
        opportunityTaken:
          row.opportunityTaken === undefined
            ? undefined
            : Number(row.opportunityTaken),
        missingTimes: Number(row.missingTimes ?? 0),
      })),
      workers: raw.workers.map((row) => ({
        ...row,
        stationId: String(row.stationId),
        employeeId: row.employeeId === null ? null : String(row.employeeId),
        opportunityTaken:
          row.opportunityTaken === undefined
            ? undefined
            : Number(row.opportunityTaken),
        missingTimes: Number(row.missingTimes ?? 0),
      })),
      attendance: raw.attendance.map((row) => ({
        ...row,
        id: String(row.id),
        stationId: String(row.stationId),
        employeeId: String(row.employeeId),
        checkIn: utcInstant(row.checkIn),
        checkOut: row.checkOut ? utcInstant(row.checkOut) : null,
      })),
    };
  }

  // Restaura una credencial local solo si una operación más reciente no cambió la sesión.
  async restoreSession() {
    const revision = this.profileRevision;
    const token = await this.sessionStorage?.read();
    if (revision !== this.profileRevision) return false;
    if (!token) return false;
    if (!/^[\w-]{43}$/.test(token)) {
      await this.clearSession();
      return false;
    }
    this.api.setToken(token);
    return true;
  }

  // Instala y persiste el Bearer e invalida lecturas anteriores del perfil.
  async acceptSession(token: string) {
    this.profileRevision += 1;
    this.api.setToken(token);
    await this.sessionStorage?.write(token);
  }

  // Invalida la revisión actual y borra el Bearer de memoria y almacenamiento.
  async clearSession() {
    this.profileRevision += 1;
    this.api.setToken(null);
    await this.sessionStorage?.write(null);
  }

  // Intercambia credenciales por una sesión y la persiste antes de continuar.
  async login(email: string, password: string) {
    const result = await this.api.post<{ token: string }>('auth/login', {
      email: email.trim(),
      password,
    });
    await this.acceptSession(result.token);
  }

  // Intenta revocar la sesión remota y elimina siempre su copia local.
  async logout() {
    try {
      await this.api.post('auth/logout');
    } finally {
      await this.clearSession();
    }
  }

  // Consulta el actor y notifica al proveedor solo si la revisión de sesión sigue vigente.
  async profile() {
    const revision = this.profileRevision;
    const actor = user(await this.api.post<UserRow>('auth/me'));
    if (revision === this.profileRevision) this.onProfile?.(actor);
    return actor;
  }

  async enterCheckIn() {
    await this.api.post('attendance/kiosk/enter');
    this.profileRevision += 1;
  }

  async logoutCheckIn(password: string) {
    // Una contraseña incorrecta conserva la sesión local y remota.
    await this.api.post('attendance/kiosk/exit', { password });
    await this.clearSession();
  }

  // Recupera empleados del kiosco y normaliza el estado de sus turnos.
  async checkInEmployees(): Promise<CheckInEmployee[]> {
    const rows = await this.api.all<CheckInEmployee>(
      'attendance/kiosk/employees',
    );
    return rows.map((row) => ({
      ...row,
      id: String(row.id),
      working: Boolean(row.working),
      attendanceId: row.attendanceId == null ? null : String(row.attendanceId),
    }));
  }

  // Envía entrada o salida con el turno esperado para detectar cambios concurrentes.
  markAttendance(employee: CheckInEmployee, email: string, password: string) {
    return this.api.post('attendance/kiosk/mark', {
      userId: employee.id,
      email: email.trim(),
      password,
      action: employee.working ? 'check-out' : 'check-in',
      attendanceId: employee.attendanceId,
    });
  }

  // Consulta el perfil y reúne recursos permitidos, adaptándolos a los modelos de pantalla.
  async snapshot(
    period: Period = {
      from: businessDate(),
      to: businessDate(),
      stationId: '',
    },
    attendanceSelf = false,
  ): Promise<AppData> {
    const invalid = periodError(period.from, period.to);
    if (invalid) throw new Error(invalid);
    const actor = await this.profile();
    // Sin jornada o en kiosco basta el perfil: no se consultan recursos de trabajo bloqueados.
    if (actor.kioskMode || !canWork(actor))
      return {
        employees: [actor],
        stations: [],
        counts: [],
        photos: [],
        sales: [],
        attendance: [],
      };
    // Consulta los permisos efectivos del perfil recién recibido.
    const has = (permission: string) => actor.permissions?.includes(permission);
    const inScope = (row: { stationId: string | number | null }) =>
      actor.roleId !== 'manager' || String(row.stationId) === actor.stationId;
    const stationId =
      actor.roleId === 'manager' ? actor.stationId : period.stationId;
    const body = {
      from: period.from,
      to: period.to,
      ...(stationId ? { stationId } : {}),
    };
    const stations = has('catalog.read')
      ? await this.api.all<Station>('catalog/query', { resource: 'stations' })
      : [];
    const normalizedStations = stations
      .filter(
        (row) =>
          actor.roleId !== 'manager' || String(row.id) === actor.stationId,
      )
      .map((row) => ({
        ...row,
        id: String(row.id),
        cityId: String(row.cityId),
        active: Boolean(row.active),
        eventId: row.eventId == null ? undefined : String(row.eventId),
        event: row.event ?? '',
      }));
    const reportBody = {
      ...body,
      ...(actor.roleId !== 'manager' && period.city
        ? {
            cityId: normalizedStations.find(
              (row) => row.cityId === period.city || row.city === period.city,
            )?.cityId,
          }
        : {}),
      ...(actor.roleId !== 'manager' && period.event
        ? {
            eventId: normalizedStations.find(
              (row) =>
                row.eventId === period.event || row.event === period.event,
            )?.eventId,
          }
        : {}),
    };
    // Las consultas independientes se ejecutan juntas, únicamente si el perfil actual tiene permiso.
    const [
      employees,
      roleRows,
      counts,
      photos,
      sales,
      attendance,
      reports,
      summary,
    ] = await Promise.all([
      has('employees.read') ? this.api.all<UserRow>('users/query') : [],
      has('employees.read') && has('catalog.read')
        ? this.api.post<{ id: string | number; name: string }[]>(
            'catalog/query',
            { resource: 'roles' },
          )
        : [],
      has('counts.read')
        ? this.api.all<DayRow>('reports/days/query', body)
        : [],
      has('photos.read') ? this.api.all<PhotoRow>('photos/query', body) : [],
      has('sales.read')
        ? this.api.all<{
            id: string;
            stationId: string;
            date: string;
            quantity: number | string;
            total: string;
            createdAt?: string | null;
          }>('sales/query', body)
        : [],
      has('attendance.read') && !attendanceSelf
        ? this.api.all<Omit<Attendance, 'employeeId'> & { userId: string }>(
            'attendance/query',
            body,
          )
        : has('attendance.self')
          ? this.api.all<Omit<Attendance, 'employeeId'> & { userId: string }>(
              'attendance/mine',
              { from: period.from, to: period.to },
            )
          : [],
      has('reports.read')
        ? this.api.all<ReportRow>('reports/query', reportBody)
        : undefined,
      has('reports.read')
        ? this.api.post<ReportRow>('reports/summary', reportBody)
        : undefined,
    ]);
    return {
      employees: [
        ...employees
          .filter((row) => inScope(row) && String(row.id) !== actor.id)
          .map(user),
        actor,
      ],
      stations: normalizedStations,
      roles: roleRows.map((row) => ({
        id: String(row.id),
        roleId: roles[row.name],
      })),
      counts: counts.filter(inScope).map((row) => ({
        ...row,
        stationId: String(row.stationId),
        taken: Number(row.taken),
        sold: Number(row.sold),
        revenue: Number(row.revenue),
        discarded: nullableNumber(row.discarded),
      })),
      photos: photos.filter(inScope).map((row): Photo => ({
        ...row,
        id: String(row.id),
        stationId: String(row.stationId),
        clientId: row.clientId === null ? null : String(row.clientId),
        clientEmail: row.clientEmail,
        name: `Foto ${row.id}`,
        uri: '',
        employeeId: '',
        operationId: '',
        createdAt: '',
      })),
      sales: sales.filter(inScope).map((row): Sale => ({
        ...row,
        id: String(row.id),
        stationId: String(row.stationId),
        quantity: Number(row.quantity),
        total: Number(row.total),
        unitPrice: 0,
        operationId: '',
        employeeId: '',
        createdAt: row.createdAt ? utcInstant(row.createdAt) : '',
      })),
      attendance: attendance.filter(inScope).map((row) => ({
        ...row,
        id: String(row.id),
        stationId: String(row.stationId),
        employeeId: String(row.userId),
        checkIn: utcInstant(row.checkIn),
        checkOut: row.checkOut ? utcInstant(row.checkOut) : null,
      })),
      reports: reports?.filter(inScope).map((row) => ({
        ...metrics(row),
        station: normalizedStations.find(
          (station) => station.id === String(row.stationId),
        )!,
        registeredDays: Number(row.registeredDays),
        expectedDays: Number(row.expectedDays),
        invalidDays: Number(row.invalidDays),
      })),
      // El total proviene del servidor para no depender de las filas visibles de una página.
      summary: summary ? metrics(summary) : undefined,
    };
  }

  // Envía el alta del puesto para que la pantalla refresque los datos tras confirmarse.
  async createStation(input: StationInput) {
    await this.api.post('catalog/stations/create', input);
  }

  // Solicita baja o reactivación del puesto por su identificador.
  async setStationActive(stationId: string, active: boolean) {
    await this.api.post('catalog/stations/availability', { stationId, active });
  }

  // Resuelve el ID real del rol y elige alta o edición según exista un usuario previo.
  async saveEmployee(input: EmployeeInput) {
    const catalog = await this.api.post<
      { id: number | string; name: string }[]
    >('catalog/query', { resource: 'roles' });
    const role = catalog.find((row) => roles[row.name] === input.roleId);
    if (!role) throw new Error('No podés asignar este rol.');
    const fields = {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      dni: input.dni,
      roleId: String(role.id),
      stationId: input.stationId || null,
    };
    await this.api.post(
      input.id ? 'users/update' : 'users/create',
      input.id
        ? { ...fields, userId: input.id }
        : { ...fields, password: input.password ?? '' },
    );
  }

  // Solicita cambiar la disponibilidad del usuario.
  async setEmployeeActive(userId: string, active: boolean) {
    await this.api.post('users/availability', { userId, active });
  }
  // Envía el UUID y los datos para que el servidor confirme o reconozca el reintento de venta.
  async recordSale(input: EventSaleInput) {
    return this.api.post<{ id: string }>('sales/create', input);
  }
  // Recupera tarifas vendibles del puesto y normaliza sus identificadores.
  async salePrices(stationId: string) {
    const rows = await this.api.all<Price>('catalog/query', {
      resource: 'prices',
      stationId,
    });
    return rows.map((row) => ({
      ...row,
      id: String(row.id),
      stationId: String(row.stationId),
    }));
  }
  // Envía nombre e importe decimal de una tarifa nueva.
  createPrice(stationId: string, name: string, amount: string) {
    return this.api.post('catalog/prices/create', { stationId, name, amount });
  }
  // Lista tarifas administrables, incluidas las inactivas.
  async stationPrices(stationId: string) {
    const rows = await this.api.all<Price>('catalog/prices/query', {
      stationId,
    });
    return rows.map((row) => ({
      ...row,
      id: String(row.id),
      stationId: String(row.stationId),
      active: Boolean(row.active),
    }));
  }
  // Envía cambios de una tarifa identificada dentro de su puesto.
  updatePrice(
    stationId: string,
    priceId: string,
    name: string,
    amount: string,
  ) {
    return this.api.post('catalog/prices/update', {
      stationId,
      priceId,
      name,
      amount,
    });
  }
  // Solicita habilitar o deshabilitar una tarifa del puesto.
  setPriceActive(stationId: string, priceId: string, active: boolean) {
    return this.api.post('catalog/prices/availability', {
      stationId,
      priceId,
      active,
    });
  }
  // Consulta si el evento está abierto y a qué fecha corresponde.
  saleEvent(stationId: string) {
    return this.api.post<{ open: boolean; date: string | null }>(
      'sales/event',
      { stationId },
    );
  }
  // Solicita abrir o cerrar las ventas del puesto.
  setSaleEvent(stationId: string, open: boolean) {
    return this.api.post('sales/event/set', { stationId, open });
  }
  // Recupera una página de doce fotos vendibles con filtro opcional por foto.
  async salePhotos(stationId: string, offset = 0, photoId?: string) {
    const rows = await this.api.post<SalePhoto[]>('sales/photos', {
      stationId,
      limit: 12,
      offset,
      ...(photoId ? { photoId } : {}),
    });
    return rows.map((row) => ({
      ...row,
      id: String(row.id),
      sold: Boolean(row.sold),
    }));
  }
  // Solicita una URL temporal por la ruta autorizada para el evento activo.
  accessSalePhoto(photoId: string) {
    return this.api.post<{ url: string; expiresIn: number }>(
      'sales/photos/access',
      { photoId },
    );
  }

  // Envía cada archivo como una carga nueva y devuelve resultados individuales.
  async uploadPhotos(
    stationId: string,
    files: PhotoFile[],
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    for (const file of files) {
      try {
        // El servidor detecta el formato por contenido, sin confiar en nombre/MIME.
        if (
          file.size !== undefined &&
          (file.size <= 0 || file.size > 6 * 1024 * 1024)
        )
          throw new Error('La foto debe pesar entre 1 byte y 6 MiB.');
        const form = await photoForm(file);
        form.append('stationId', stationId);
        if (file.clientId) form.append('clientId', file.clientId);
        await this.api.post('photos/upload', form, true);
        results.push({ key: file.key });
      } catch (error) {
        results.push({ key: file.key, error: errorMessage(error) });
      }
    }
    return results;
  }

  // Solicita la previsualización privada con los permisos de galería.
  accessPhoto(photoId: string) {
    return this.api.post<{ url: string; expiresIn: number }>('photos/access', {
      photoId,
    });
  }
  // Solicita acceso a una foto vinculada a una venta histórica.
  accessSoldPhoto(saleId: string, photoId: string) {
    return this.api.post<{ url: string; expiresIn: number }>(
      'sales/photos/sold/access',
      { saleId, photoId },
    );
  }
  // Normaliza el correo y usa la ruta de asignación de galería o venta.
  assignPhoto(photoId: string, clientEmail: string, sale = false) {
    return this.api.post<PhotoRow>(
      sale ? 'sales/photos/assign' : 'photos/assign',
      { photoId, clientEmail: clientEmail.trim().toLowerCase() },
    );
  }
  // Recupera copias, pago, fotos y precios históricos de una venta.
  saleDetail(saleId: string) {
    return this.api.post<{
      prices: { priceId: string; unitPrice: string; quantity: number }[];
      photos: { photoId: string }[];
      copies: number | null;
      paymentMethod: string | null;
    }>('sales/detail', { saleId });
  }
}
