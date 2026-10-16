import { businessDate } from '../src/domain/dates';
import { createSeed } from '../src/data/seed';
import { MockFotoYaRepository } from '../src/data/mock-repository';
import type { PhotoFile } from '../src/domain/models';

export const today = businessDate();
export const now = new Date(`${today}T15:00:00Z`);
export function repository() {
  return new MockFotoYaRepository({ data: createSeed(), now: () => now });
}
export const sale = {
  operationId: 'new-sale',
  stationId: 'centro',
  quantity: '10',
  unitPrice: '12,50',
};
export const image: PhotoFile = {
  key: 'photo-1',
  name: 'foto.jpg',
  uri: 'file:///foto.jpg',
  mimeType: 'image/jpeg',
  size: 100,
};
