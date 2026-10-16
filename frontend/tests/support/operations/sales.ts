import { businessDate } from '../../../src/domain/dates';
import { operationId } from '../../../src/domain/format';
import type { AppData, Employee } from '../../../src/domain/models';
import {
  requirePermission,
  requireStation,
} from '../../../src/domain/permissions';
import { saleAmounts } from '../../../src/domain/validation';
import type { SaleInput } from '../repository';

export function recordSale(
  data: AppData,
  actor: Employee,
  input: SaleInput,
  now: Date,
) {
  requirePermission(actor, 'sales.create');
  requireStation(actor, input.stationId);
  const amounts = saleAmounts(input.quantity, input.unitPrice);
  const duplicate = data.sales.find(
    (sale) => sale.operationId === input.operationId,
  );
  if (duplicate) {
    if (
      duplicate.employeeId !== actor.id ||
      duplicate.stationId !== input.stationId ||
      duplicate.quantity !== amounts.quantity ||
      duplicate.unitPrice !== amounts.unitPrice
    ) {
      throw new Error('La operación ya fue utilizada con otros datos.');
    }
    return;
  }
  const date = businessDate(now);
  const count = data.counts.find(
    (row) => row.stationId === input.stationId && row.date === date,
  );
  if (!count)
    throw new Error('No hay un conteo de fotos para este puesto y día.');
  const sold = data.sales
    .filter((row) => row.stationId === input.stationId && row.date === date)
    .reduce((sum, row) => sum + row.quantity, 0);
  if (sold + amounts.quantity > count.taken)
    throw new Error(`Solo hay ${count.taken - sold} fotos disponibles.`);
  data.sales.push({
    id: operationId('sale'),
    operationId: input.operationId,
    stationId: input.stationId,
    employeeId: actor.id,
    date,
    ...amounts,
    createdAt: now.toISOString(),
  });
}
