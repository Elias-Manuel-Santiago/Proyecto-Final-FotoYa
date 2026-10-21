/**
 * @file
 * Construye datos del repositorio simulado. No carga demostraciones en base ni pantallas
 * reales.
 */
import type { AppData, Employee } from '../../src/domain/models';
import { businessDate } from '../../src/domain/dates';

export function createSeed(): AppData {
  const today = businessDate();
  const employees: Employee[] = [
    {
      id: 'owner',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      dni: '30111222',
      roleId: 'owner',
      stationId: 'centro',
      active: true,
    },
    {
      id: 'manager',
      firstName: 'Bruno',
      lastName: 'López',
      email: 'bruno@example.com',
      dni: '31222333',
      roleId: 'manager',
      stationId: 'centro',
      active: true,
    },
    {
      id: 'secretary',
      firstName: 'Carla',
      lastName: 'Díaz',
      email: 'carla@example.com',
      dni: '32333444',
      roleId: 'secretary',
      stationId: 'parque',
      active: true,
    },
    {
      id: 'photographer',
      firstName: 'Diego',
      lastName: 'Ruiz',
      email: 'diego@example.com',
      dni: '33444555',
      roleId: 'photographer',
      stationId: 'centro',
      active: true,
    },
    {
      id: 'seller',
      firstName: 'Elena',
      lastName: 'Gómez',
      email: 'elena@example.com',
      dni: '34555666',
      roleId: 'seller',
      stationId: 'centro',
      active: true,
    },
    {
      id: 'other-seller',
      firstName: 'Fabio',
      lastName: 'Torres',
      email: 'fabio@example.com',
      dni: '35666777',
      roleId: 'seller',
      stationId: 'parque',
      active: true,
    },
  ];
  return {
    employees: employees.map((employee) => ({ ...employee, working: true })),
    stations: [
      {
        id: 'centro',
        name: 'Centro',
        address: 'San Martín 100',
        city: 'Buenos Aires',
        event: 'Recorrido urbano',
      },
      {
        id: 'parque',
        name: 'Parque',
        address: 'Av. del Parque 200',
        city: 'La Plata',
        event: 'Feria',
      },
      {
        id: 'costanera',
        name: 'Costanera',
        address: 'Av. Costanera 300',
        city: 'Buenos Aires',
        event: 'Recorrido urbano',
      },
    ],
    counts: [
      { stationId: 'centro', date: today, taken: 100 },
      { stationId: 'parque', date: today, taken: 50 },
    ],
    photos: [],
    sales: [
      {
        id: 'sale-1',
        operationId: 'initial-1',
        employeeId: 'seller',
        stationId: 'centro',
        date: today,
        quantity: 70,
        unitPrice: 10,
        total: 700,
        createdAt: `${today}T12:00:00.000Z`,
      },
      {
        id: 'sale-2',
        operationId: 'initial-2',
        employeeId: 'other-seller',
        stationId: 'parque',
        date: today,
        quantity: 20,
        unitPrice: 10,
        total: 200,
        createdAt: `${today}T12:30:00.000Z`,
      },
    ],
    attendance: [
      {
        id: 'attendance-1',
        employeeId: 'photographer',
        stationId: 'centro',
        date: today,
        checkIn: `${today}T11:00:00.000Z`,
        checkOut: null,
      },
    ],
  };
}
