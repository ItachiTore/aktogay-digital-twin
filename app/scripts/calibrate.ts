/**
 * Сверка модели с опубликованными показателями Актогая.
 *
 * Считает по нескольким полным сменам то, что можно сопоставить с открытыми
 * источниками, приводит к году и печатает отклонение. Ничего не подгоняет:
 * если расхождение велико, оно так и печатается, а в CALIBRATION.md попадает как есть.
 *
 *   npm run calibrate            — seed 1..10
 *   npm run calibrate -- 1 20    — seed 1..20
 */
import { writeFileSync } from 'node:fs';
import { Simulation } from '../src/sim';
import { DEFAULT_CONFIG, PUBLISHED } from '../src/sim/config';

const seedFrom = Number(process.argv[2] ?? 1);
const seedTo = Number(process.argv[3] ?? 10);
const HOURS_PER_YEAR = 8760;

export interface Check {
  what: string;
  model: number;
  published: number;
  unit: string;
  /** Допустимое отклонение, доли единицы. */
  tol: number;
  source: string;
  note?: string;
}

/** Среднее по сменам: питание фабрики, медь в питании и в концентрате. */
export function runShifts(from: number, to: number) {
  let feedT = 0;
  let cuFeedT = 0;
  let cuConcT = 0;
  let minedT = 0;
  let hours = 0;
  let n = 0;
  for (let seed = from; seed <= to; seed++) {
    const s = new Simulation({ seed, truckCount: 20, strategy: 'smart' });
    s.advance(12 * 3600);
    feedT += s.stats.plantFeedT;
    cuFeedT += s.stats.cuFeedT;
    cuConcT += s.stats.cuConcT;
    minedT += s.minedTotal;
    hours += s.now / 3600;
    n++;
  }
  return { feedT: feedT / n, cuFeedT: cuFeedT / n, cuConcT: cuConcT / n, minedT: minedT / n, hours: hours / n };
}

/** Числа модели, которым не нашлось опубликованного аналога, — для контекста. */
export function context(): { feedGradePct: number; recoveryPct: number } {
  const r = runShifts(seedFrom, seedTo);
  return { feedGradePct: (r.cuFeedT / r.feedT) * 100, recoveryPct: (r.cuConcT / r.cuFeedT) * 100 };
}

export function checks(): Check[] {
  const cfg = DEFAULT_CONFIG;
  const r = runShifts(seedFrom, seedTo);
  const feedTph = r.feedT / r.hours;
  const lineMtYear = (feedTph * HOURS_PER_YEAR) / 1e6;
  // Медь из сульфида по всему руднику — это две линии; модель считает одну.
  const cuPerLineKt = (r.cuConcT / r.hours) * HOURS_PER_YEAR / 1000;

  return [
    {
      what: 'Переработка сульфидной руды, одна линия',
      model: lineMtYear,
      published: PUBLISHED.sulfideLineMtYear,
      unit: 'млн т/год',
      tol: 0.1,
      source: 'Mining Technology: «double sulphide ore processing capacity from 25Mt to 50Mt»',
      note: 'проектная мощность линии; фактический рекорд 2025 года выше неё',
    },
    {
      what: 'Переработка сульфидной руды, две линии',
      model: lineMtYear * 2,
      published: PUBLISHED.sulfideTotalMtYear,
      unit: 'млн т/год',
      tol: 0.1,
      source: 'Mining Technology, там же',
    },
    {
      what: 'Медь в концентрате, две линии',
      model: cuPerLineKt * 2,
      published: PUBLISHED.sulfideCopperKtYear,
      unit: 'тыс. т/год',
      tol: 0.25,
      source: 'Mining Technology: «increase copper production from sulphide ore to 170,000t between 2022 and 2027»',
      note: 'содержание в питании модели — не опубликованное, поэтому допуск шире',
    },
    {
      what: 'Производительность экскаватора на сульфиде',
      model: (cfg.excavators.find((e) => e.material === 'sulfide')?.rateTpm ?? 0) * 60,
      published: PUBLISHED.excavatorTphLow,
      unit: 'т/ч',
      tol: 0.15,
      source: 'Горная промышленность: парк Hitachi, в т. ч. EX5600-6; заявленные 2700–3700 т/ч',
      note: 'сверяется с нижней границей диапазона',
    },
    {
      what: 'Грузоподъёмность самосвала',
      model: cfg.truck.payloadT,
      published: PUBLISHED.truckPayloadT,
      unit: 'т',
      tol: 0.12,
      source: 'Вести Семей: 17 × CAT 793 (240+ т), 18 × CAT 785, 2 × CAT 777',
      note: 'модель берёт класс CAT 793 с номинальными 220 т, а не паспортный максимум',
    },
  ];
}

function fmt(v: number): string {
  return v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
}

export function deviation(c: Check): number {
  return (c.model - c.published) / c.published;
}

if (process.argv[1]?.includes('calibrate')) {
  const rows = checks();
  const lines = [
    '# Сверка модели с опубликованными показателями',
    '',
    `Посчитано по сменам seed ${seedFrom}…${seedTo}, 20 самосвалов, `,
    'командой `npm run calibrate`. Числа модели — её собственный результат, не настройка.',
    '',
    '| Показатель | Модель | Опубликовано | Отклонение | Источник |',
    '|---|---|---|---|---|',
  ];
  let worst = 0;
  for (const c of rows) {
    const d = deviation(c);
    worst = Math.max(worst, Math.abs(d));
    const mark = Math.abs(d) <= c.tol ? '' : ' ⚠';
    lines.push(
      `| ${c.what}${c.note ? `<br><sub>${c.note}</sub>` : ''} | ${fmt(c.model)} ${c.unit} | ${fmt(c.published)} ${c.unit} | ${(d * 100).toFixed(1)} %${mark} | ${c.source} |`,
    );
    console.log(`${(d * 100).toFixed(1).padStart(7)} %  ${c.what}`);
  }
  const ctx = context();
  lines.push(
    '',
    `Наибольшее отклонение: ${(worst * 100).toFixed(1)} %.`,
    '',
    '## Без опубликованного аналога',
    '',
    'Эти числа модель считает сама, сверить их не с чем — приводятся, чтобы было видно,',
    'из чего складывается медь в концентрате.',
    '',
    `- содержание меди в питании фабрики: ${ctx.feedGradePct.toFixed(3)} % Cu;`,
    `- извлечение на фабрике: ${ctx.recoveryPct.toFixed(1)} %.`,
    '',
  );
  writeFileSync('CALIBRATION.md', lines.join('\n'), 'utf8');
  console.log('\nCALIBRATION.md обновлён');
}
