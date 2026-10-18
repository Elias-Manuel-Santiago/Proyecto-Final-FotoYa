export type RoleId =
  'owner' | 'manager' | 'secretary' | 'photographer' | 'seller' | 'client';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  dni: string;
  roleId: RoleId;
  stationId: string;
  active: boolean;
  permissions?: readonly string[];
}

export type EmployeeInput = Omit<Employee, 'id' | 'active' | 'permissions'> & {
  id?: string;
  password?: string;
};

export interface Station {
  id: string;
  name: string;
  address: string;
  city: string;
  event: string;
  cityId?: string;
  eventId?: string;
  active?: boolean;
}

export interface StationInput {
  name: string;
  address: string;
  city: string;
  event: string;
}

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
}

export interface PhotoFile {
  key: string;
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
  file?: File;
  clientId?: string;
}

export interface UploadResult {
  key: string;
  error?: string;
}

export interface DayCount {
  stationId: string;
  date: string;
  taken: number;
  sold?: number;
  revenue?: number;
  discarded?: number | null;
}

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

export interface Price {
  id: string;
  name: string;
  amount: string;
  stationId: string;
  active?: boolean;
}

export interface EventSaleInput {
  operationId: string;
  photoId: string;
  stationId: string;
  paymentMethod: 'efectivo' | 'transferencia' | 'tarjeta';
  prices: { priceId: string; copies: number }[];
}

export interface SalePhoto {
  id: string;
  date: string;
  sold: boolean;
}

export interface Attendance {
  id: string;
  employeeId: string;
  stationId: string;
  date: string;
  checkIn: string;
  checkOut: string | null;
}

export interface AppData {
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

export interface ReportMetrics {
  taken: number | null;
  sold: number;
  earnings: number;
  discarded: number | null;
  percentage: number | null;
}

export interface StationReport extends ReportMetrics {
  station: Station;
  registeredDays: number;
  expectedDays: number;
  invalidDays: number;
}

export interface Period {
  from: string;
  to: string;
  stationId: string;
  city?: string;
  event?: string;
}
