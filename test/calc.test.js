import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { oblicz, poziomDofinansowania, stawkaVat, waliduj } from '../calc.js';

const progi = JSON.parse(readFileSync(new URL('../progi.json', import.meta.url), 'utf8'));

const bazowy = {
  metraz: 120,
  pietra: 2,
  paliwo: 'wegiel',
  klasaKotla: 'ponizej5',
  ocieplenie: 'brak',
  okna: 'stare',
  osoby: 4,
  dochodMies: 1200,
  dochodRoczny: 50000,
  pompaWOfercie: true,
};
const dom = (zmiany = {}) => ({ ...bazowy, ...zmiany });
const pozycja = (wynik, id) => wynik.pozycje.find((p) => p.id === id);
const ids = (wynik) => wynik.pozycje.map((p) => p.id);

test('poziom najwyższy: kwoty pozycji wyliczone ręcznie', () => {
  const w = oblicz(dom(), progi);
  assert.equal(w.poziom, 'najwyzszy');
  assert.deepEqual(ids(w), ['pompa', 'sciany', 'dach', 'okna', 'audyt']);
  // pompa: 25000 + 120*150 = 43000 netto, 46440 brutto, limit 31500
  assert.deepEqual([pozycja(w, 'pompa').netto, pozycja(w, 'pompa').brutto, pozycja(w, 'pompa').dotacja], [43000, 46440, 31500]);
  // ściany: 132 m² * 275 = 36300 (limit niższy niż 100% brutto 42768)
  assert.equal(pozycja(w, 'sciany').dotacja, 36300);
  // dach: 72 m², brutto 15552 < limit 15840 -> 100% brutto
  assert.equal(pozycja(w, 'dach').dotacja, 15552);
  assert.equal(pozycja(w, 'okna').dotacja, 23760);
  assert.equal(pozycja(w, 'audyt').dotacja, 1200);
  assert.equal(w.suma.dotacja, 108312);
  assert.equal(w.suma.wklad, w.suma.brutto - w.suma.dotacja);
  assert.equal(w.obcietoDoLimitu, false);
});

test('progi dochodowe: wieloosobowe i jednoosobowe', () => {
  assert.equal(poziomDofinansowania(dom({ dochodMies: 1300 }), progi), 'najwyzszy');
  assert.equal(poziomDofinansowania(dom({ dochodMies: 1301 }), progi), 'podwyzszony');
  assert.equal(poziomDofinansowania(dom({ osoby: 1, dochodMies: 1800 }), progi), 'najwyzszy');
  assert.equal(poziomDofinansowania(dom({ osoby: 1, dochodMies: 3000 }), progi), 'podwyzszony');
  assert.equal(poziomDofinansowania(dom({ dochodMies: 3000, dochodRoczny: 135000 }), progi), 'podstawowy');
  assert.equal(poziomDofinansowania(dom({ dochodMies: 3000, dochodRoczny: 135001 }), progi), null);
});

test('poziom podwyższony: 70% albo limit', () => {
  const w = oblicz(dom({ osoby: 1, dochodMies: 3000 }), progi);
  assert.equal(w.poziom, 'podwyzszony');
  assert.equal(pozycja(w, 'pompa').dotacja, 22000); // 70% z 46440 = 32508 > limit 22000
  assert.equal(pozycja(w, 'dach').dotacja, 10886); // 70% z 15552 = 10886,4 < limit 154*72
});

test('poziom podstawowy, duży dom: suma obcięta do limitu całkowitego', () => {
  const w = oblicz(dom({ metraz: 300, pietra: 1, dochodMies: 5000, dochodRoczny: 100000 }), progi);
  assert.equal(w.poziom, 'podstawowy');
  assert.equal(w.obcietoDoLimitu, true);
  assert.ok(w.suma.dotacja <= progi.limity.calkowity.podstawowy);
  assert.ok(w.suma.dotacja > progi.limity.calkowity.podstawowy - 10);
});

test('brak kwalifikacji: dochód powyżej progów', () => {
  const w = oblicz(dom({ dochodMies: 6000, dochodRoczny: 200000 }), progi);
  assert.equal(w.poziom, null);
  assert.equal(w.suma.dotacja, 0);
  assert.equal(w.suma.wklad, w.suma.brutto);
  assert.ok(w.komunikaty.some((k) => k.includes('przekracza')));
});

test('dom z pompą ciepła: brak pozycji pompy, termomodernizacja dotowana', () => {
  const w = oblicz(dom({ paliwo: 'pompa' }), progi);
  assert.ok(!ids(w).includes('pompa'));
  assert.ok(pozycja(w, 'sciany').dotacja > 0);
});

test('ogrzewanie gazowe + zaznaczona pompa: pompa w ofercie, ale bez dotacji', () => {
  const w = oblicz(dom({ paliwo: 'gaz' }), progi);
  assert.equal(pozycja(w, 'pompa').dotacja, 0);
  assert.match(pozycja(w, 'pompa').uwaga, /bez dotacji/);
  assert.ok(pozycja(w, 'sciany').dotacja > 0);
});

test('ogrzewanie gazowe bez pompy: pompy nie ma w tabeli', () => {
  const w = oblicz(dom({ paliwo: 'olej', pompaWOfercie: false }), progi);
  assert.ok(!ids(w).includes('pompa'));
});

test('kocioł 5 klasy: pompa bez dotacji, ocieplenie i okna dotowane', () => {
  const w = oblicz(dom({ klasaKotla: '5' }), progi);
  assert.equal(pozycja(w, 'pompa').dotacja, 0);
  assert.ok(pozycja(w, 'okna').dotacja > 0);
});

test('stary kocioł bez wymiany: brak dotacji i komunikat', () => {
  const w = oblicz(dom({ pompaWOfercie: false }), progi);
  assert.equal(w.suma.dotacja, 0);
  assert.ok(w.komunikaty.some((k) => k.includes('warunkiem')));
});

test('częściowe ocieplenie: tylko dach; pełne: bez ścian i dachu', () => {
  assert.deepEqual(ids(oblicz(dom({ ocieplenie: 'czesciowe' }), progi)), ['pompa', 'dach', 'okna', 'audyt']);
  assert.deepEqual(ids(oblicz(dom({ ocieplenie: 'pelne', okna: 'nowe' }), progi)), ['pompa', 'audyt']);
});

test('nic do zrobienia: pusta tabela i komunikat', () => {
  const w = oblicz(dom({ paliwo: 'pompa', ocieplenie: 'pelne', okna: 'nowe' }), progi);
  assert.equal(w.pozycje.length, 0);
  assert.equal(w.suma.brutto, 0);
  assert.ok(w.komunikaty.length > 0);
});

test('audyt bez innych dotowanych pozycji nie jest dotowany', () => {
  const w = oblicz(dom({ paliwo: 'gaz', ocieplenie: 'pelne', okna: 'nowe' }), progi);
  assert.equal(pozycja(w, 'audyt').dotacja, 0);
});

test('VAT: 8% do 300 m², proporcjonalnie powyżej', () => {
  assert.equal(stawkaVat(300, progi), 0.08);
  assert.ok(Math.abs(stawkaVat(400, progi) - 0.1175) < 1e-9);
});

test('walidacja', () => {
  assert.deepEqual(waliduj(dom()), {});
  assert.ok(waliduj(dom({ metraz: 20 })).metraz);
  assert.ok(waliduj(dom({ metraz: 501 })).metraz);
  assert.ok(waliduj(dom({ dochodMies: -1 })).dochodMies);
  assert.ok(waliduj(dom({ klasaKotla: '' })).klasaKotla);
  assert.equal(waliduj(dom({ paliwo: 'gaz', klasaKotla: '' })).klasaKotla, undefined);
});
