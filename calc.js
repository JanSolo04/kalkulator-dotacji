// Logika kalkulatora: czyste funkcje, bez DOM i bez bibliotek.
// Wszystkie liczby (progi, limity, stawki) przychodzą z progi.json.

export const NAZWY_POZYCJI = {
  pompa: 'Pompa ciepła powietrze-woda',
  sciany: 'Ocieplenie ścian',
  dach: 'Ocieplenie dachu / stropu',
  okna: 'Wymiana okien',
  audyt: 'Audyt energetyczny',
};

const PALIWA = ['wegiel', 'drewno', 'gaz', 'olej', 'prad', 'pompa'];
const KLASY = ['ponizej5', '5'];
const OCIEPLENIE = ['brak', 'czesciowe', 'pelne'];
const OKNA = ['stare', 'nowe'];

/** Zwraca obiekt { pole: komunikat }. Pusty obiekt = dane poprawne. */
export function waliduj(d) {
  const bledy = {};
  if (!Number.isFinite(d.metraz) || d.metraz < 30 || d.metraz > 500) {
    bledy.metraz = 'Podaj metraż od 30 do 500 m².';
  }
  if (d.pietra !== 1 && d.pietra !== 2) bledy.pietra = 'Wybierz 1 lub 2 piętra.';
  if (!PALIWA.includes(d.paliwo)) bledy.paliwo = 'Wybierz rodzaj paliwa.';
  if (['wegiel', 'drewno'].includes(d.paliwo) && !KLASY.includes(d.klasaKotla)) {
    bledy.klasaKotla = 'Wybierz klasę kotła.';
  }
  if (!OCIEPLENIE.includes(d.ocieplenie)) bledy.ocieplenie = 'Wybierz stan ocieplenia.';
  if (!OKNA.includes(d.okna)) bledy.okna = 'Wybierz stan okien.';
  if (!Number.isInteger(d.osoby) || d.osoby < 1 || d.osoby > 20) {
    bledy.osoby = 'Podaj liczbę osób od 1 do 20.';
  }
  if (!Number.isFinite(d.dochodMies) || d.dochodMies < 0) {
    bledy.dochodMies = 'Dochód nie może być ujemny.';
  }
  if (!Number.isFinite(d.dochodRoczny) || d.dochodRoczny < 0) {
    bledy.dochodRoczny = 'Dochód nie może być ujemny.';
  }
  return bledy;
}

/** 'najwyzszy' | 'podwyzszony' | 'podstawowy' | null (brak kwalifikacji). */
export function poziomDofinansowania(d, progi) {
  const p = progi.poziomy;
  const jedno = d.osoby === 1;
  const prog = (poziom) => (jedno ? poziom.dochodJednoosobowe : poziom.dochodWieloosobowe);
  if (d.dochodMies <= prog(p.najwyzszy)) return 'najwyzszy';
  if (d.dochodMies <= prog(p.podwyzszony)) return 'podwyzszony';
  if (d.dochodRoczny <= p.podstawowy.dochodRocznyWnioskodawcy) return 'podstawowy';
  return null;
}

/** Efektywna stawka VAT: 8% do 300 m², powyżej proporcjonalnie 23% od nadwyżki. */
export function stawkaVat(metraz, progi) {
  const v = progi.vat;
  if (metraz <= v.limitMetrazuDlaObnizonej) return v.stawkaObnizona;
  const udzialObnizonej = v.limitMetrazuDlaObnizonej / metraz;
  return udzialObnizonej * v.stawkaObnizona + (1 - udzialObnizonej) * v.stawkaPodstawowa;
}

const zaokr1 = (x) => Math.round(x * 10) / 10;

/** Pozycje prac (bez kwot dotacji) wynikające z danych domu. */
export function pozycjePrac(d, progi) {
  const k = progi.koszty;
  const lista = [];

  if (d.paliwo !== 'pompa' && d.pompaWOfercie) {
    lista.push({ id: 'pompa', ilosc: 1, jednostka: 'szt.', netto: k.pompa.stala + d.metraz * k.pompa.stawkaZaM2Domu });
  }
  if (d.ocieplenie === 'brak') {
    const pow = zaokr1(d.metraz * k.sciany.wspolczynnikPowierzchni);
    lista.push({ id: 'sciany', ilosc: pow, jednostka: 'm²', netto: pow * k.sciany.stawka });
  }
  if (d.ocieplenie === 'brak' || d.ocieplenie === 'czesciowe') {
    const pow = zaokr1((d.metraz / d.pietra) * k.dach.wspolczynnikPowierzchni);
    lista.push({ id: 'dach', ilosc: pow, jednostka: 'm²', netto: pow * k.dach.stawka });
  }
  if (d.okna === 'stare') {
    const pow = zaokr1(d.metraz * k.okna.wspolczynnikPowierzchni);
    lista.push({ id: 'okna', ilosc: pow, jednostka: 'm²', netto: pow * k.okna.stawka });
  }
  if (lista.length > 0) {
    lista.push({ id: 'audyt', ilosc: 1, jednostka: 'szt.', netto: k.audyt.stala });
  }
  return lista;
}

/**
 * Główne obliczenie. Zwraca pozycje z kosztem netto/brutto, dotacją i wkładem własnym,
 * sumy oraz komunikaty dla klienta.
 */
export function oblicz(d, progi) {
  const z = progi.zasady;
  const poziom = poziomDofinansowania(d, progi);
  const procent = poziom ? progi.poziomy[poziom].procent : 0;
  const vat = stawkaVat(d.metraz, progi);
  const komunikaty = [];

  const stale = z.paliwaStale.includes(d.paliwo);
  const kopciuch = stale && d.klasaKotla !== z.klasaKotlaBezDotacjiNaZrodlo;
  const pompaDotowana = kopciuch;
  // Warunek programu: stary kocioł na paliwo stałe trzeba wymienić, inaczej brak dotacji.
  const blokada = kopciuch && !d.pompaWOfercie;

  const pozycje = pozycjePrac(d, progi).map((p) => {
    const netto = Math.round(p.netto);
    const brutto = Math.round(p.netto * (1 + vat));
    return { ...p, nazwa: NAZWY_POZYCJI[p.id], netto, brutto, dotacja: 0, uwaga: '' };
  });

  if (!poziom) {
    komunikaty.push('Dochód przekracza progi programu – brak dotacji. Pokazujemy sam koszt prac.');
  }
  if (blokada) {
    komunikaty.push('Wymiana starego kotła na paliwo stałe jest warunkiem dotacji. Zaznacz pompę ciepła, aby otrzymać dofinansowanie.');
  }

  if (poziom && !blokada) {
    const limity = progi.limity;
    for (const p of pozycje) {
      if (p.id === 'audyt') continue;
      if (p.id === 'pompa' && !pompaDotowana) {
        p.uwaga = stale ? 'Kocioł 5 klasy – wymiana bez dotacji' : 'Obecne źródło (gaz/olej/prąd) – pompa bez dotacji';
        continue;
      }
      const limit = limity[p.id][poziom] * p.ilosc;
      p.dotacja = Math.floor(Math.min(p.brutto * procent, limit));
    }
    // Audyt dotujemy tylko razem z inną dotowaną pozycją.
    const audyt = pozycje.find((p) => p.id === 'audyt');
    if (audyt && pozycje.some((p) => p.dotacja > 0)) {
      audyt.dotacja = Math.floor(Math.min(audyt.brutto * procent, limity.audyt[poziom]));
    }
  }

  let obcietoDoLimitu = false;
  if (poziom) {
    const limitCalk = progi.limity.calkowity[poziom];
    const suma = pozycje.reduce((s, p) => s + p.dotacja, 0);
    if (suma > limitCalk) {
      obcietoDoLimitu = true;
      const wsp = limitCalk / suma;
      for (const p of pozycje) p.dotacja = Math.floor(p.dotacja * wsp);
      komunikaty.push(`Dotacja ograniczona do limitu całkowitego ${limitCalk.toLocaleString('pl-PL')} zł.`);
    }
  }

  if (pozycje.length === 0) {
    komunikaty.push('Dom nie wymaga prac objętych kalkulatorem.');
  }

  for (const p of pozycje) p.wklad = p.brutto - p.dotacja;

  const suma = pozycje.reduce(
    (s, p) => ({ netto: s.netto + p.netto, brutto: s.brutto + p.brutto, dotacja: s.dotacja + p.dotacja, wklad: s.wklad + p.wklad }),
    { netto: 0, brutto: 0, dotacja: 0, wklad: 0 },
  );

  return {
    poziom,
    nazwaPoziomu: poziom ? progi.poziomy[poziom].nazwa : null,
    procent,
    vat,
    pozycje,
    suma,
    obcietoDoLimitu,
    komunikaty,
  };
}
