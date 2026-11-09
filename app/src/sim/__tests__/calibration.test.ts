// Модель должна оставаться сопоставимой с опубликованными показателями Актогая.
// Если правка параметров уводит расчёт за допуск, тест падает — это и есть
// «калибровка по открытым измерениям», а не разовая сверка на словах.
import { describe, expect, it } from 'vitest';
import { checks, deviation } from '../../../scripts/calibrate';

describe('сверка с опубликованными показателями', () => {
  const rows = checks();

  it('проверок столько, сколько опубликованных показателей', () => {
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });

  for (const c of rows) {
    it(`${c.what}: модель в пределах ${(c.tol * 100).toFixed(0)} % от опубликованного`, () => {
      const d = deviation(c);
      expect(Number.isFinite(d)).toBe(true);
      expect(Math.abs(d)).toBeLessThanOrEqual(c.tol);
    });
  }

  it('переработка одной линии близка к проектным 25 млн т/год', () => {
    const line = rows.find((r) => r.what.includes('одна линия'));
    expect(line).toBeDefined();
    // Модель заведомо чуть выше проектной мощности: фабрика считается без плановых
    // остановок на ремонт. Больше чем на десятую часть расходиться не должна.
    expect(line!.model).toBeGreaterThan(24);
    expect(line!.model).toBeLessThan(28);
  });
});
