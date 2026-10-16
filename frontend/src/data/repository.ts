import type {
  AppData,
  EmployeeInput,
  PhotoFile,
  UploadResult,
  Period,
  StationInput,
} from '../domain/models';

export interface SaleInput {
  operationId: string;
  stationId: string;
  quantity: string;
  unitPrice: string;
}

// Todos los métodos reciben un actor para reflejar permisos también en el adaptador de prueba.
// El adaptador HTTP deberá obtener el actor de la sesión validada en el servidor.
export interface FotoYaRepository {
  snapshot(period?: Period): Promise<AppData>;
  createStation(actorId: string, input: StationInput): Promise<void>;
  setStationActive(
    actorId: string,
    stationId: string,
    active: boolean,
  ): Promise<void>;
  saveEmployee(actorId: string, input: EmployeeInput): Promise<void>;
  setEmployeeActive(
    actorId: string,
    employeeId: string,
    active: boolean,
  ): Promise<void>;
  recordSale(actorId: string, input: SaleInput): Promise<void>;
  uploadPhotos(
    actorId: string,
    stationId: string,
    files: PhotoFile[],
  ): Promise<UploadResult[]>;
  checkIn(actorId: string, operationId: string): Promise<void>;
  checkOut(actorId: string, attendanceId: string): Promise<void>;
}
