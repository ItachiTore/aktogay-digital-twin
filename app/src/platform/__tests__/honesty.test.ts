// Признаки двойников обязаны совпадать с тем, что происходит в модели, а команда —
// получать квитанцию. Эти три проверки закрывают дефекты, из-за которых судьи
// отборочного этапа списали работающие сценарии как неработающие.
import { describe, expect, it } from 'vitest';
import { Simulation } from '../../sim';
import { applyScenario, type ApplyOut } from '../scenarios';
import { serializeCrusher, serializePlant } from '../twins';

const make = () => new Simulation({ seed: 42, truckCount: 20, strategy: 'smart' });
const run = (s: Simulation, sec: number) => s.advance(sec);

describe('признаки не противоречат состоянию', () => {
  it('обесточенная фабрика не сообщает, что работает', () => {
    const s = make();
    run(s, 3600); // накопить руду на складе, иначе фабрика встанет и без отключения

    const before = serializePlant(s);
    expect(before.state.properties.value).toBe('running');
    expect(Number(before.feed_rate.properties.value)).toBeGreaterThan(0);

    s.injectPowerCut(25 * 60);
    const during = serializePlant(s);
    expect(during.state.properties.value).toBe('no_power');
    expect(Number(during.feed_rate.properties.value)).toBe(0);

    const crusher = serializeCrusher(s);
    expect(crusher.state.properties.value).toBe('no_power');
  });

  it('после снятия отключения фабрика снова работает', () => {
    const s = make();
    run(s, 3600);
    s.injectPowerCut(25 * 60);
    expect(serializePlant(s).state.properties.value).toBe('no_power');

    applyScenario([s], { value: 'cancel_all' });
    expect(serializePlant(s).state.properties.value).toBe('running');
    expect(Number(serializePlant(s).feed_rate.properties.value)).toBeGreaterThan(0);
  });
});

describe('cancel_all снимает всё, что обещает', () => {
  it('отключение энергии, ливень, остановка орошения и непогода снимаются', () => {
    const s = make();
    s.injectPowerCut(60 * 60);
    s.injectStormWater(120_000, 180 * 60);
    s.injectLeachStop(180 * 60);
    s.weather.force(s, 'blizzard', 60 * 60);

    const text = applyScenario([s], { value: 'cancel_all' });

    expect(s.powerCutLeft).toBe(0);
    expect(s.tailings.stormLeft).toBe(0);
    expect(s.tailings.stormM3h).toBe(0);
    expect(s.leach.holdLeft).toBe(0);
    expect(s.weather.forcedLeft).toBe(0);
    expect(text).toContain('отключение энергии');
    expect(text).toContain('остановка орошения');
  });

  it('когда отменять нечего, об этом так и говорится', () => {
    const s = make();
    const out: ApplyOut = { ok: true };
    const text = applyScenario([s], { value: 'cancel_all' }, out);
    expect(text).toBe('активных сценариев не было');
    expect(out.ok).toBe(false);
  });
});

describe('отклонённая команда отличима от потерянной', () => {
  it('повторное открытие уже открытого съезда помечается как отклонение', () => {
    const s = make();
    const out: ApplyOut = { ok: true };
    const text = applyScenario([s], { value: 'open_road', arg: 0 }, out);
    expect(out.ok).toBe(false);
    expect(text).toBe('участок не был закрыт');
  });

  it('успешная команда помечается как выполненная', () => {
    const s = make();
    const out: ApplyOut = { ok: false };
    const text = applyScenario([s], { value: 'breakdown', arg: 0, dur: 30 }, out);
    expect(out.ok).toBe(true);
    expect(text).toContain('поломка экскаватора');
  });

  it('ремонт исправного экскаватора — отклонение, а не успех', () => {
    const s = make();
    const out: ApplyOut = { ok: true };
    applyScenario([s], { value: 'repair', arg: 0 }, out);
    expect(out.ok).toBe(false);
  });
});
