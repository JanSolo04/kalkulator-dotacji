# Kalkulator oferty i dotacji „Czyste Powietrze”

Statyczna strona, na której klient wpisuje dane domu, a kalkulator na bieżąco pokazuje:

- orientacyjny koszt pompy ciepła, ocieplenia ścian i dachu, okien oraz audytu (netto i brutto),
- poziom dofinansowania (podstawowy 40% / podwyższony 70% / najwyższy 100%),
- szacunkową dotację i wkład własny dla każdej pozycji,
- ofertę do pobrania jako PDF (z polskimi znakami).

Bez backendu, bez logowania, bez bazy. HTML + czysty JavaScript (moduły ES), hosting na GitHub Pages.

> **Wersja demonstracyjna.** Kwoty są orientacyjne. Firma „EkoDom Demo” jest fikcyjna. Aktualne zasady: [czystepowietrze.gov.pl](https://czystepowietrze.gov.pl).

<!-- Zrzut ekranu: docs/screenshot.png -->

## Uruchomienie lokalne

Strona wczytuje `progi.json` przez `fetch`, więc trzeba ją otworzyć przez serwer (nie przez `file://`):

```bash
npx serve .
# albo
python -m http.server 8000
```

Testy logiki (Node 18+):

```bash
npm test
```

## Struktura

| Plik | Rola |
| --- | --- |
| `index.html` | formularz, wynik, przycisk PDF, stopka |
| `style.css` | wygląd, mobile-first, tryb ciemny |
| `calc.js` | czyste funkcje: walidacja, poziom, VAT, pozycje, dotacje |
| `app.js` | podpięcie formularza i renderowanie wyniku |
| `pdf.js` | oferta PDF (jsPDF + jspdf-autotable z CDN, czcionka Roboto) |
| `format.js` | formatowanie kwot i etykiety |
| `progi.json` | **wszystkie liczby**: progi dochodowe, limity, stawki, VAT, data |
| `test/calc.test.js` | 15 przypadków testowych (`node --test`) |

## Jak liczymy

1. **Poziom** z dochodu na osobę (próg zależy od tego, czy gospodarstwo jest jednoosobowe), a dla poziomu podstawowego z rocznego dochodu wnioskodawcy.
2. **Pozycje:** pompa ciepła (jeśli zaznaczona i dom nie ma jeszcze pompy), ściany i dach (brak ocieplenia), sam dach (ocieplenie częściowe), okna (stare), audyt (zawsze, gdy jest jakakolwiek praca).
3. **Brutto** = netto × (1 + VAT). VAT 8% do 300 m², powyżej proporcjonalnie 23% od nadwyżki.
4. **Dotacja na pozycję** = mniejsza z kwot: brutto × % poziomu albo limit jednostkowy × ilość. Suma nie przekracza limitu całkowitego (przy przekroczeniu wszystkie pozycje są proporcjonalnie zmniejszane).
5. **Reguły źródła ciepła:**
   - stary kocioł na węgiel lub drewno → pompa dotowana; bez wymiany kotła nie ma żadnej dotacji,
   - kocioł 5 klasy, gaz, olej, prąd → pompa możliwa w ofercie, ale **bez dotacji**; ocieplenie i okna są dotowane,
   - audyt jest dotowany tylko razem z inną dotowaną pozycją.

**Uproszczenia:** nie liczymy pompy gruntowej, rekuperacji, fotowoltaiki ani prefinansowania. Limit całkowity jest jeden (wariant „pompa powietrze-woda + termomodernizacja”). Powierzchnie ścian, dachu i okien są szacowane z metrażu.

## Jak zaktualizować progi

Wszystko jest w `progi.json`, kod się nie zmienia:

1. Sprawdź aktualne wartości na [czystepowietrze.gov.pl](https://czystepowietrze.gov.pl/wez-dofinansowanie/pytania-i-odpowiedzi/nowy-program-czyste-powietrze-obowiazujacy-od-31-marca-2025/8).
2. Popraw `poziomy` (progi dochodowe), `limity` (limity jednostkowe i całkowite), w razie potrzeby `vat`.
3. Ustaw `dataAktualizacji` (wyświetla się w stopce i w PDF) i `zrodlo`.
4. Własny cennik: zmień sekcję `koszty`. Nazwa firmy: `firma`.
5. Uruchom `npm test`. Jeśli zmieniły się limity, testy z ręcznie policzonymi kwotami pokażą różnice i trzeba je zaktualizować.

## Licencje

Czcionka Roboto: Apache License 2.0 (Google). jsPDF i jspdf-autotable: MIT.
