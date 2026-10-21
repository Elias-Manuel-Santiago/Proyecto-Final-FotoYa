/**
 * @file
 * Define el contrato del repositorio simulado. Mantiene soporte de tests separado del cliente
 * HTTP real.
 */
import type {
  AppData,
  EmployeeInput,
  PhotoFile,
  UploadResult,
  Period,
  StationInput,
} from '../../src/domain/models';

export interface SaleInput {
  operationId: string;
  stationId: string;
  quantity: string;
  unitPrice: string;
}

// Contrato exclusivo de la simulación de pruebas.
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
