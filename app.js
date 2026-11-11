import { oblicz, waliduj } from './calc.js';
import { zl, ilosc, procent } from './format.js';
import { pobierzPdf } from './pdf.js';

const form = document.getElementById('formularz');
const wynikEl = document.getElementById('wynik-tresc');
const przyciskPdf = document.getElementById('pobierz-pdf');
const pdfBlad = document.getElementById('pdf-blad');

let progi = null;
let ostatnie = null; // { dane, wynik } dla PDF

const liczba = (v) => (v === '' ? NaN : Number(String(v).replace(',', '.')));

function czytajFormularz() {
  const f = new FormData(form);
  return {
    metraz: liczba(f.get('metraz')),
    pietra: Number(f.get('pietra')),
    paliwo: f.get('paliwo'),
    klasaKotla: f.get('klasaKotla'),
    ocieplenie: f.get('ocieplenie'),
    okna: f.get('okna'),
    osoby: liczba(f.get('osoby')),
    dochodMies: liczba(f.get('dochodMies')),
    dochodRoczny: liczba(f.get('dochodRoczny')),
    pompaWOfercie: f.get('pompaWOfercie') === 'on',
  };
}

function pokazPolaZalezne(d) {
  const stale = progi.zasady.paliwaStale.includes(d.paliwo);
  document.getElementById('pole-klasa').hidden = !stale;
  document.getElementById('pole-pompa').hidden = d.paliwo === 'pompa';
  const bezDotacji = progi.zasady.paliwaBezDotacjiNaPompe.includes(d.paliwo) || (stale && d.klasaKotla === '5');
  document.getElementById('podpowiedz-pompa').hidden = !bezDotacji;
}

function pokazBledy(bledy) {
  for (const el of form.querySelectorAll('[data-blad]')) {
    const pole = el.dataset.blad;
    el.textContent = bledy[pole] || '';
    const input = form.elements[pole];
    if (input) input.setAttribute('aria-invalid', bledy[pole] ? 'true' : 'false');
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function renderWynik(w) {
  const kom = w.komunikaty.map((k) => `<p class="komunikat">${esc(k)}</p>`).join('');
  const poziom = w.poziom ? `${w.nazwaPoziomu} (${procent(w.procent)})` : 'brak';

  const kafle = `
    <div class="podsumowanie">
      <div class="kafel"><p>Poziom dofinansowania</p><strong>${esc(poziom)}</strong></div>
      <div class="kafel"><p>Koszt prac brutto</p><strong>${zl(w.suma.brutto)}</strong></div>
      <div class="kafel wyrozniony"><p>Szacunkowa dotacja</p><strong>${zl(w.suma.dotacja)}</strong></div>
      <div class="kafel"><p>Wkład własny</p><strong>${zl(w.suma.wklad)}</strong></div>
    </div>`;

  if (w.pozycje.length === 0) return kom + kafle;

  const wiersze = w.pozycje.map((p) => `
    <tr>
      <td>${esc(p.nazwa)}${p.uwaga ? `<small>${esc(p.uwaga)}</small>` : ''}</td>
      <td>${ilosc(p)}</td>
      <td>${zl(p.netto)}</td>
      <td>${zl(p.brutto)}</td>
      <td>${zl(p.dotacja)}</td>
      <td>${zl(p.wklad)}</td>
    </tr>`).join('');

  return `${kom}${kafle}
    <div class="tabela-wrap">
      <table>
        <thead><tr><th>Pozycja</th><th>Ilość</th><th>Netto</th><th>Brutto (VAT ${procent(w.vat)})</th><th>Dotacja</th><th>Wkład własny</th></tr></thead>
        <tbody>${wiersze}</tbody>
        <tfoot><tr><td>Razem</td><td></td><td>${zl(w.suma.netto)}</td><td>${zl(w.suma.brutto)}</td><td>${zl(w.suma.dotacja)}</td><td>${zl(w.suma.wklad)}</td></tr></tfoot>
      </table>
    </div>
    <p class="podpowiedz">Dotacja liczona od kosztów brutto: mniejsza z kwot – procent poziomu albo limit jednostkowy programu.</p>`;
}

function przelicz() {
  const dane = czytajFormularz();
  pokazPolaZalezne(dane);
  const bledy = waliduj(dane);
  pokazBledy(bledy);
  if (Object.keys(bledy).length > 0) {
    ostatnie = null;
    przyciskPdf.disabled = true;
    wynikEl.innerHTML = '<p class="szary">Popraw zaznaczone pola, aby zobaczyć wynik.</p>';
    return;
  }
  const wynik = oblicz(dane, progi);
  ostatnie = { dane, wynik };
  przyciskPdf.disabled = wynik.pozycje.length === 0;
  wynikEl.innerHTML = renderWynik(wynik);
}

async function start() {
  try {
    const odp = await fetch('progi.json', { cache: 'no-cache' });
    if (!odp.ok) throw new Error(`HTTP ${odp.status}`);
    progi = await odp.json();
  } catch (e) {
    wynikEl.innerHTML = '<p class="komunikat">Nie udało się wczytać progów (progi.json). Otwórz stronę przez serwer, np. <code>npx serve</code>.</p>';
    console.error(e);
    return;
  }
  document.getElementById('data-progow').textContent = progi.dataAktualizacji;
  document.getElementById('marka').textContent = progi.firma.nazwa;
  document.getElementById('prog-roczny').textContent = zl(progi.poziomy.podstawowy.dochodRocznyWnioskodawcy).replace(' zł', '');
  form.addEventListener('input', przelicz);
  form.addEventListener('change', przelicz);
  przelicz();
}

przyciskPdf.addEventListener('click', async () => {
  if (!ostatnie) return;
  pdfBlad.textContent = '';
  przyciskPdf.disabled = true;
  try {
    await pobierzPdf(ostatnie.dane, ostatnie.wynik, progi);
  } catch (e) {
    console.error(e);
    pdfBlad.textContent = 'Nie udało się wygenerować PDF. Sprawdź połączenie z internetem i spróbuj ponownie.';
  } finally {
    przyciskPdf.disabled = !ostatnie || ostatnie.wynik.pozycje.length === 0;
  }
});

start();
