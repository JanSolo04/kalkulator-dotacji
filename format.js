// Wspólne formatowanie dla strony i PDF.

const fmtZl = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0, useGrouping: 'always' });
const fmtIlosc = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 });

// Intl wstawia twarde spacje (U+00A0 / U+202F); zamieniamy je na zwykłe, żeby PDF ich nie gubił.
const spacje = (s) => s.replace(/\s/g, ' ');

export const zl = (x) => `${spacje(fmtZl.format(x))} zł`;
export const ilosc = (p) => (p.jednostka === 'szt.' ? '1 szt.' : `${spacje(fmtIlosc.format(p.ilosc))} m²`);
export const procent = (x) => `${Math.round(x * 100)}%`;

export const ETYKIETY = {
  paliwo: { wegiel: 'węgiel / ekogroszek', drewno: 'drewno / pellet', gaz: 'gaz', olej: 'olej opałowy', prad: 'prąd', pompa: 'pompa ciepła' },
  klasaKotla: { ponizej5: 'poniżej 5 klasy', 5: '5 klasa / ekoprojekt' },
  ocieplenie: { brak: 'brak', czesciowe: 'częściowe (dach do ocieplenia)', pelne: 'pełne' },
  okna: { stare: 'stare', nowe: 'nowe' },
};
