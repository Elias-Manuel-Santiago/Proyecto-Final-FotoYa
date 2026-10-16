import type { AppData, EmployeeInput, PhotoFile } from '../domain/models';
import type { FotoYaRepository, SaleInput } from './repository';
import { createSeed } from './seed';
import { saveEmployee, setEmployeeActive } from './operations/employees';
import { recordSale } from './operations/sales';
import { uploadPhotos } from './operations/photos';
import { checkIn, checkOut } from './operations/attendance';

interface MockOptions {
  data?: AppData;
  now?: () => Date;
  storePhoto?: (file: PhotoFile) => string;
}

// Memoria de demostración: no representa autenticación ni almacenamiento en servidor.
export class MockFotoYaRepository implements FotoYaRepository {
  private data: AppData;
  private now: () => Date;
  private storePhoto: (file: PhotoFile) => string;

  constructor(options: MockOptions = {}) {
    this.data = copyData(options.data ?? createSeed());
    this.now = options.now ?? (() => new Date());
    this.storePhoto = options.storePhoto ?? ((file) => file.uri);
  }

  private actor(id: string) {
    const employee = this.data.employees.find(
      (row) => row.id === id && row.active,
    );
    if (!employee) throw new Error('El usuario no está activo.');
    return employee;
  }

  async snapshot() {
    return copyData(this.data);
  }

  async saveEmployee(actorId: string, input: EmployeeInput) {
    saveEmployee(this.data, this.actor(actorId), input);
  }

  async setEmployeeActive(
    actorId: string,
    employeeId: string,
    active: boolean,
  ) {
    setEmployeeActive(this.data, this.actor(actorId), employeeId, active);
  }

  async recordSale(actorId: string, input: SaleInput) {
    recordSale(this.data, this.actor(actorId), input, this.now());
  }

  async uploadPhotos(actorId: string, stationId: string, files: PhotoFile[]) {
    return uploadPhotos(
      this.data,
      this.actor(actorId),
      stationId,
      files,
      this.now(),
      this.storePhoto,
    );
  }

  async checkIn(actorId: string, id: string) {
    checkIn(this.data, this.actor(actorId), id, this.now());
  }
  async checkOut(actorId: string, id: string) {
    checkOut(this.data, this.actor(actorId), id, this.now());
  }
}

// El conjunto de prueba contiene únicamente valores JSON, compatible también con Hermes.
function copyData(data: AppData): AppData {
  return JSON.parse(JSON.stringify(data)) as AppData;
}
