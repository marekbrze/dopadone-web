---
name: Dopadone
description: Osobisty menedżer zadań i projektów z metaforą ciepłego biurka
colors:
  oatmeal: "#f4efe5"
  linen: "#faf7f0"
  sandstone: "#ece7da"
  warm-border: "#cfc7b4"
  mist-border: "#e2dbd0"
  espresso: "#1c1712"
  muted-bark: "#5c4e40"
  dry-leaf: "#736151"
  burnt-umber: "#5c4a38"
  soft-umber: "#7a6150"
typography:
  display:
    fontFamily: "'IBM Plex Sans', Helvetica Neue, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "0.06em"
  headline:
    fontFamily: "'IBM Plex Sans', Helvetica Neue, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.10em"
  title:
    fontFamily: "'IBM Plex Sans', Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.4"
  body:
    fontFamily: "'IBM Plex Sans', Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.4"
  label:
    fontFamily: "'IBM Plex Sans', Helvetica Neue, Arial, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    letterSpacing: "0.10em"
rounded:
  sharp: "1px"
  subtle: "2px"
  soft: "4px"
  gentle: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "20px"
  xl: "28px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.burnt-umber}"
    textColor: "{colors.linen}"
    rounded: "{rounded.sharp}"
    padding: "7px 18px"
  button-primary-hover:
    backgroundColor: "{colors.soft-umber}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-bark}"
    rounded: "{rounded.sharp}"
    padding: "5px 13px"
  button-ghost-hover:
    backgroundColor: "{colors.sandstone}"
    textColor: "{colors.espresso}"
  modal-input:
    backgroundColor: "transparent"
    textColor: "{colors.espresso}"
    rounded: "0"
    padding: "8px 0"
  column-tab-active:
    backgroundColor: "{colors.linen}"
    textColor: "{colors.espresso}"
    rounded: "{rounded.soft}"
---

# Design System: Dopadone

## 1. Overview

**Creative North Star: "Ciepłe biurko"**

Otwarty notatnik na biurku, rano. Porządek, cisza, wszystko na swoim miejscu. Intymna przestrzeń pracy, gdzie czujesz spokój i kontrolę. Nie dashboard, nie narzędzie zespołowe. Osobisty ekosystem zadań i projektów, który oddycha wraz z Tobą przez cały dzień.

System wizualny jest celowo powściągliwy: ciepła paleta owsa i espresso, niemal ostre krawędzie, IBM Plex Sans jako jedyna rodzina typograficzna. Głębia przez tonalne warstwy papieru, nie przez cienie. Ruch tylko przy zmianach stanu, nigdy dekoracyjny. Każdy piksel celowy, każda decyzja designu służy spokoju użytkownika.

Ten system świadomie odrzuca estetykę SaaS dashboardów (Todoist, Asana, Monday), korporacyjnych project managerów (Jira, ClickUp) i gamifikacji (Habitica, Forest). Zero gradientów, zero ciemnych sidebarów, zero everywhere-onboarding.

**Key Characteristics:**
- Ciepła paleta "papierowa" z odcieniami owsa, lnu i espresso
- Niemal ostre krawędzie (1px radius) jako wyraz precyzji
- Jedna rodzina typograficzna z hierarchią przez wagę, rozmiar i tracking
- Głębia tonalna (warstwy papieru), nie cieniowa
- Ruch wyłącznie przy zmianach stanu (0.1–0.2s), zero choreografii

## 2. Colors: The Oatmeal Palette

Paleta czerpie z fizycznych materiałów: niezadrukowany papier, naturalne włókna, palona umbra. Wszystkie neutralne odcięte w stronę ciepłego brązu, nie szarości.

### Primary
- **Burnt Umber** (#5c4a38): akcent akcji. Przyciski submit, aktywne stany, akcentowe elementy. Używany celowo na ≤10% powierzchni.

### Neutral
- **Oatmeal** (#f4efe5): tło główne. Ciepły krem, bazowa płaszczyzna aplikacji.
- **Linen** (#faf7f0): powierzchnie wyżej w hierarchii (header, karty, modale). Lekko jaśniejszy niż tło.
- **Sandstone** (#ece7da): powierzchnie wciśnięte, hover tła, elementy wtórne. Ciemniejszy niż tło.
- **Warm Border** (#cfc7b4): granice między sekcjami, ramki, dividery.
- **Mist Border** (#e2dbd0): subtelniejsze granice wewnątrz sekcji, lżejsze dividery.

### Text
- **Espresso** (#1c1712): tekst główny. Głęboki brąz z kontrastem 17.2:1 na Oatmeal.
- **Muted Bark** (#5c4e40): tekst drugorzędny. Ciepły brąz z kontrastem 7.1:1.
- **Dry Leaf** (#736151): tekst trzeciorzędny, placeholder, hint. Kontrast 5.2:1.

### Named Rules
**The Paper Layer Rule.** Głębia jest tonalna. Jasność płaszczyzny określa jej pozycję w hierarchii: Linen (wyższa) > Oatmeal (baza) > Sandstone (niższa). Nie używaj cieni do rozróżniania powierzchni.

**The Espresso Accent Rule.** Burnt Umber (#5c4a38) to jedyny akcent. Pojawia się na ≤10% powierzchni ekranu: przyciski submit, aktywne stany, focus ringi. Reszta to neutralne tony.

## 3. Typography

**Display Font:** IBM Plex Sans (with Helvetica Neue, Arial, sans-serif)
**Body Font:** IBM Plex Sans (with Helvetica Neue, Arial, sans-serif)
**Label Font:** IBM Plex Sans (with Helvetica Neue, Arial, sans-serif)

**Character:** Jedna rodzina, hierarchia przez wagę i tracking. Elegancka powściągliwość: nie potrzeba dwóch fontów, żeby zbudować wyrazową typografię. Display z szerokim trackingiem (0.06em) i dużą wagą (600) kontrastuje z lekkim body (400) i czytelnym labelem (600, 10px, szeroki tracking).

### Hierarchy
- **Display** (600, 15px, uppercase, tracking 0.06em): logo, nagłówki główne. Rzadko używany, mocno wyrazowy.
- **Headline** (600, 13px, uppercase, tracking 0.10em): nagłówki sekcji, modali, paneli.
- **Title** (400, 14px, line-height 1.4): nazwy zadań, projekty, elementy listy. Główny czytelny tekst.
- **Body** (400, 14px, line-height 1.4): opisy, notatki. Maksymalna długość linii 65–75ch.
- **Label** (600, 10px, uppercase, tracking 0.10–0.14em): etykiety kolumn, przyciski, tagi, mikro-interfejs. Tracking rośnie wraz ze spadkiem rozmiaru.

### Named Rules
**The Weight-And-Tracking Rule.** Hierarchia jest przez wagę (300–600) + tracking (0.01–0.14em) + rozmiar (10–15px), nie przez różne fonty. Nie dodawaj drugiej rodziny.

## 4. Elevation

System jest płaski z głębią tonalną. Cienie pojawiają się tylko przy modali i aktywnych tabach jako minimalny akcent przestrzenny.

**Tonalna hierarchia powierzchni:**
1. **Linen** (#faf7f0) — najwyższa: header, modale, aktywne karty
2. **Oatmeal** (#f4efe5) — baza: tło główne, ciała kolumn
3. **Sandstone** (#ece7da) — najniższa: powierzchnie wciśnięte, hover tła

**Shadow Vocabulary (minimalny):**
- **Modal shadow** (`0 2px 8px rgba(28,23,18,0.08), 0 8px 32px rgba(28,23,18,0.10)`): wyłącznie dla modali i overlay paneli. Ciepły tint (28,23,18), nigdy czysta czerń.
- **Tab shadow** (`0 1px 3px rgba(0,0,0,0.10)`): aktywna zakładka w segmented control.

### Named Rules
**The Flat-By-Default Rule.** Powierzchnie są płaskie w spoczynku. Cienie pojawiają się tylko przy modali i aktywnych tabach. Nigdy na kartach zadań, panelach, czy listach.

## 5. Components

Filozofia: wyrafinowane i powściągliwe. Wystarczająco wyraźne żeby widzieć, wystarczająco ciche żeby nie rozpraszać.

### Buttons
- **Shape:** niemal ostre (1px radius)
- **Primary (Submit):** Burnt Umber bg, Linen text, 1px radius, padding 7px 18px, label style (10px, 600, uppercase, tracking 0.10em)
- **Ghost:** transparent bg, Muted Bark text, 1px solid Warm Border, 1px radius, padding 5px 13px
- **Hover:** bg zmienia się na Sandstone (ghost) lub Soft Umber (primary). Border-color na Soft Umber. Duration 0.15s.

### Navigation Tabs
- **Area tabs:** text-only z bottom-border indicator. Active: pełny tekst kolor + 2px bottom border. Padding 12px 18px 10px.
- **Segmented tabs (column tabs):** pill-style w Sandstone container. Active tab: Linen bg + subtelny shadow. Inactive: transparent.
- **Hover:** kolor tekstu z text-faint na text-muted. Duration 0.2s.

### Inputs / Fields
- **Style:** transparent bg, no border, bottom-only border 1px solid Warm Border, radius 0.
- **Placeholder:** Dry Leaf kolor, font-weight 300.
- **Focus:** border-bottom zmienia się na Burnt Umber. Duration 0.15s.
- **Modal input:** 15px, font-weight 300, padding 8px 0.

### Modals
- **Overlay:** rgba(28,23,18,0.25) + backdrop-filter blur(2px).
- **Container:** Linen bg, 1px solid Warm Border, 2px radius, padding 32px.
- **Width:** 360px. Shadow: modal-shadow (ciepły tint).

### Task Items
- **Checkbox:** 14px, accent-color Burnt Umber.
- **Name:** 14px, weight 400, line-height 1.4. Done: line-through + Muted Bark.
- **Priority dot:** 5px circle, kolor zależny od priorytetu.
- **Hover:** tekst przesuwa się w prawo (padding-left 2px → 10px). Duration 0.15s.

### Chips / Pills (Energy, Context)
- **Style:** transparent bg, 1px solid Warm Border, 1px radius, padding 4px 8px.
- **Label:** 10px, 600, tracking 0.04–0.07em.
- **Hover:** bg Sandstone, border Soft Umber.
- **Active:** bg Burnt Umber, text Linen.

## 6. Do's and Don'ts

### Do:
- **Do** używaj tonalnej hierarchii (Linen > Oatmeal > Sandstone) do rozróżniania warstw powierzchni.
- **Do** ograniczaj akcent Burnt Umber do ≤10% powierzchni ekranu. Jego rzadkość jest siłą.
- **Do** stosuj 1px radius jako domyślny. Ostre krawędzie są wyrazem precyzji, nie błędu.
- **Do** używaj ciepłego tint w cieniach: rgba(28,23,18,...), nigdy czystej czerni.
- **Do** buduj hierarchię typograficzną przez wagę + tracking + rozmiar w ramach jednej rodziny.
- **Do** używaj transition duration 0.1–0.2s, zawsze na właściwościach stanu (color, background, border-color).

### Don't:
- **Don't** używaj cieni na kartach zadań, panelach, czy listach. Cienie są wyłącznie dla modali i aktywnych tab.
- **Don't** dodawaj gradientów, glassmorphismu, ani blur dekoracyjny (backdrop-filter blur > 2px tylko przy modal overlay).
- **Don't** używaj ciemnych sidebarów, neonowych kolorów, ani corporate feel. To nie jest SaaS dashboard. Odrzucony: Todoist, Asana, Monday, Jira, ClickUp.
- **Don't** stosuj gamifikacji: odznak, punktów, streaków, social features. Odrzucony: Habitica, Forest.
- **Don't** dodawaj drugiej rodziny typograficznej. IBM Plex Sans wystarczy.
- **Don't** używaj border-left ani border-right > 1px jako kolorowy pasek akcentowy.
- **Don't** animuj właściwości layout (width, height, top, left). Tylko color, background, border-color, opacity, transform.
- **Don't** używaj czystej czerni (#000) ani czystej bieli (#fff). Każdy neutral odcięty w stronę ciepłego brązu.
