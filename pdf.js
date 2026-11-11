// Generowanie oferty PDF: jsPDF + jspdf-autotable (z CDN) i osadzona czcionka Roboto (polskie znaki).
import { zl, ilosc, procent, ETYKIETY } from './format.js';

let czcionkaBase64 = null;

async function wczytajCzcionke() {
  if (czcionkaBase64) return czcionkaBase64;
  const odp = await fetch('fonts/Roboto-Regular.ttf');
  if (!odp.ok) throw new Error(`Czcionka: HTTP ${odp.status}`);
  const bajty = new Uint8Array(await odp.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bajty.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bajty.subarray(i, i + 0x8000));
  }
  czcionkaBase64 = btoa(bin);
  return czcionkaBase64;
}

export async function pobierzPdf(d, w, progi) {
  if (!window.jspdf?.jsPDF) throw new Error('Biblioteka jsPDF nie jest wczytana');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  doc.addFileToVFS('Roboto-Regular.ttf', await wczytajCzcionke());
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.setFont('Roboto', 'normal');

  const zielony = [31, 122, 77];
  const szary = [93, 107, 101];
  const L = 15;
  const dzis = new Date().toLocaleDateString('pl-PL');

  // Logo: kwadrat z inicjałami + nazwa firmy demo.
  doc.setFillColor(...zielony);
  doc.roundedRect(L, 14, 12, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  const inicjaly = progi.firma.nazwa.split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  doc.text(inicjaly, L + 6, 21.8, { align: 'center' });
  doc.setTextColor(28, 42, 36);
  doc.setFontSize(14);
  doc.text(progi.firma.nazwa, L + 16, 19.5);
  doc.setFontSize(8);
  doc.setTextColor(...szary);
  doc.text(progi.firma.podpis, L + 16, 24.5);
  doc.text(`Data: ${dzis}`, 195, 19.5, { align: 'right' });

  doc.setTextColor(28, 42, 36);
  doc.setFontSize(16);
  doc.text('Orientacyjna oferta modernizacji domu', L, 40);
  doc.setFontSize(10);
  doc.setTextColor(...szary);
  doc.text('z szacunkiem dotacji z programu „Czyste Powietrze”', L, 46);

  // Dane z formularza.
  const ogrzewanie = progi.zasady.paliwaStale.includes(d.paliwo)
    ? `${ETYKIETY.paliwo[d.paliwo]}, kocioł ${ETYKIETY.klasaKotla[d.klasaKotla]}`
    : ETYKIETY.paliwo[d.paliwo];
  doc.autoTable({
    startY: 52,
    theme: 'plain',
    styles: { font: 'Roboto', fontStyle: 'normal', fontSize: 9, cellPadding: 1.2 },
    columnStyles: { 0: { textColor: szary, cellWidth: 55 } },
    body: [
      ['Metraż / kondygnacje', `${d.metraz} m² / ${d.pietra}`],
      ['Obecne ogrzewanie', ogrzewanie],
      ['Ocieplenie / okna', `${ETYKIETY.ocieplenie[d.ocieplenie]} / ${ETYKIETY.okna[d.okna]}`],
      ['Gospodarstwo', `${d.osoby} os., ${zl(d.dochodMies)} netto/os./mies., ${zl(d.dochodRoczny)}/rok wnioskodawcy`],
      ['Poziom dofinansowania', w.poziom ? `${w.nazwaPoziomu} (${procent(w.procent)})` : 'brak kwalifikacji'],
    ],
  });

  // Tabela pozycji.
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 6,
    head: [['Pozycja', 'Ilość', 'Netto', `Brutto (VAT ${procent(w.vat)})`, 'Dotacja', 'Wkład własny']],
    body: w.pozycje.map((p) => [p.uwaga ? `${p.nazwa}\n${p.uwaga}` : p.nazwa, ilosc(p), zl(p.netto), zl(p.brutto), zl(p.dotacja), zl(p.wklad)]),
    foot: [['Razem', '', zl(w.suma.netto), zl(w.suma.brutto), zl(w.suma.dotacja), zl(w.suma.wklad)]],
    styles: { font: 'Roboto', fontStyle: 'normal', fontSize: 9 },
    headStyles: { fillColor: zielony, fontStyle: 'normal' },
    footStyles: { fillColor: [227, 242, 234], textColor: [28, 42, 36], fontStyle: 'normal' },
    didParseCell: (c) => { if (c.column.index > 0) c.cell.styles.halign = 'right'; },
  });

  let y = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(9);
  doc.setTextColor(138, 90, 0);
  for (const k of w.komunikaty) {
    const linie = doc.splitTextToSize(k, 180);
    doc.text(linie, L, y);
    y += linie.length * 4.5;
  }

  doc.setTextColor(...szary);
  doc.setFontSize(8);
  const uwaga = 'Wersja demonstracyjna. Kwoty orientacyjne, nie stanowią oferty handlowej. Koszty prac to przykładowe stawki. '
    + 'Dotacja liczona od kosztów brutto jako mniejsza z kwot: procent poziomu albo limit jednostkowy programu. '
    + `Zasady programu: czystepowietrze.gov.pl. Progi z dnia: ${progi.dataAktualizacji}.`;
  doc.text(doc.splitTextToSize(uwaga, 180), L, Math.max(y + 4, 270));

  doc.save(`oferta-${new Date().toISOString().slice(0, 10)}.pdf`);
}
