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
} from '../domain/models';
import { businessDate, periodError, utcInstant } from '../domain/dates';
import { errorMessage } from '../domain/format';
import type { FotoYaRepository } from './repository';
import { ApiClient } from './api-client';

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
const nullableNumber = (value: number | string | null) =>
  value === null ? null : Number(value);
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

export class HttpFotoYaRepository implements FotoYaRepository {
  onProfile?: (employee: Employee) => void;
  setOnProfile(listener?: (employee: Employee) => void) {
    this.onProfile = listener;
  }
  constructor(
    public api: ApiClient,
    private photoForm: (file: PhotoFile) => Promise<FormData>,
  ) {}

  async login(email: string, password: string) {
    const result = await this.api.post<{ token: string }>('auth/login', {
      email: email.trim(),
      password,
    });
    this.api.setToken(result.token);
  }

  async logout() {
    try {
      await this.api.post('auth/logout');
    } finally {
      this.api.setToken(null);
    }
  }

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
    const actor = user(await this.api.post<UserRow>('auth/me'));
    this.onProfile?.(actor);
    const has = (permission: string) => actor.permissions?.includes(permission);
    const body = {
      from: period.from,
      to: period.to,
      ...(period.stationId ? { stationId: period.stationId } : {}),
    };
    const stations = has('catalog.read')
      ? await this.api.all<Station>('catalog/query', { resource: 'stations' })
      : [];
    const normalizedStations = stations.map((row) => ({
      ...row,
      id: String(row.id),
      cityId: String(row.cityId),
      active: Boolean(row.active),
      eventId: row.eventId == null ? undefined : String(row.eventId),
      event: row.event ?? '',
    }));
    const reportBody = {
      ...body,
      ...(period.city
        ? {
            cityId: normalizedStations.find(
              (row) => row.cityId === period.city || row.city === period.city,
            )?.cityId,
          }
        : {}),
      ...(period.event
        ? {
            eventId: normalizedStations.find(
              (row) =>
                row.eventId === period.event || row.event === period.event,
            )?.eventId,
          }
        : {}),
    };
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
        ...employees.filter((row) => String(row.id) !== actor.id).map(user),
        actor,
      ],
      stations: normalizedStations,
      roles: roleRows.map((row) => ({
        id: String(row.id),
        roleId: roles[row.name],
      })),
      counts: counts.map((row) => ({
        ...row,
        stationId: String(row.stationId),
        taken: Number(row.taken),
        sold: Number(row.sold),
        revenue: Number(row.revenue),
        discarded: nullableNumber(row.discarded),
      })),
      photos: photos.map((row): Photo => ({
        ...row,
        id: String(row.id),
        stationId: String(row.stationId),
        clientId: row.clientId === null ? null : String(row.clientId),
        name: `Foto ${row.id}`,
        uri: '',
        employeeId: '',
        operationId: '',
        createdAt: '',
      })),
      sales: sales.map((row): Sale => ({
        ...row,
        id: String(row.id),
        stationId: String(row.stationId),
        quantity: Number(row.quantity),
        total: Number(row.total),
        unitPrice: 0,
        operationId: '',
        employeeId: '',
        createdAt: '',
      })),
      attendance: attendance.map((row) => ({
        ...row,
        id: String(row.id),
        stationId: String(row.stationId),
        employeeId: String(row.userId),
        checkIn: utcInstant(row.checkIn),
        checkOut: row.checkOut ? utcInstant(row.checkOut) : null,
      })),
      reports: reports?.map((row) => ({
        ...metrics(row),
        station: normalizedStations.find(
          (station) => station.id === String(row.stationId),
        )!,
        registeredDays: Number(row.registeredDays),
        expectedDays: Number(row.expectedDays),
        invalidDays: Number(row.invalidDays),
      })),
      summary: summary ? metrics(summary) : undefined,
    };
  }

  async createStation(_actorId: string, input: StationInput) {
    await this.api.post('catalog/stations/create', input);
  }

  async setStationActive(_actorId: string, stationId: string, active: boolean) {
    await this.api.post('catalog/stations/availability', { stationId, active });
  }

  async saveEmployee(_actorId: string, input: EmployeeInput) {
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

  async setEmployeeActive(_actorId: string, userId: string, active: boolean) {
    await this.api.post('users/availability', { userId, active });
  }
  async recordSale(): Promise<void> {
    throw new Error(
      'El registro de ventas todavía no está habilitado en el servidor.',
    );
  }
  async checkIn(): Promise<void> {
    throw new Error(
      'Las marcaciones de asistencia todavía no están habilitadas en el servidor.',
    );
  }
  async checkOut(): Promise<void> {
    throw new Error(
      'Las marcaciones de asistencia todavía no están habilitadas en el servidor.',
    );
  }

  async uploadPhotos(
    _actorId: string,
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
        const form = await this.photoForm(file);
        form.append('operationId', file.key);
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

  accessPhoto(photoId: string) {
    return this.api.post<{ url: string; expiresIn: number }>('photos/access', {
      photoId,
    });
  }
  async assignPhoto(photoId: string, clientId: string) {
    await this.api.post('photos/assign', { photoId, clientId });
  }
  saleDetail(saleId: string) {
    return this.api.post<{
      prices: { priceId: string; unitPrice: string; quantity: number }[];
      photos: { photoId: string }[];
    }>('sales/detail', { saleId });
  }
}
