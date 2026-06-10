# Lokální test scrapingu Kantýna + Svoboda

Plný test lokálního scraperu ve vyhrazeném klonu (`%LOCALAPPDATA%\reporyje-menu\repo`).
Obejde středeční/čtvrteční guard i kontrolu čerstvosti webu a po skončení po sobě uklidí:

```powershell
cd "$env:LOCALAPPDATA\reporyje-menu\repo"; $env:FORCE_SCRAPE = "1"; node scrapers/run-local.js; Remove-Item Env:\FORCE_SCRAPE; git checkout -- docs
```

Co příkaz dělá:

1. Přepne do vyhrazeného klonu (ne do pracovního checkoutu).
2. `FORCE_SCRAPE=1` vynutí scrape Kantýny i Svobody bez ohledu na den a stav webu.
3. `Remove-Item Env:\FORCE_SCRAPE` smaže proměnnou, aby nezůstala viset v shellu.
4. `git checkout -- docs` zahodí testem zapsaná data — je to jen test, ostrá data
   commitne až scheduled task `ReporyjeMenuScrape` / CI.

## Očekávaný výstup

- `Loaded FB_COOKIES from ...` a `Loaded IG_COOKIES from ...`
- Kantýna: `Page state: ...title":"Kantýna STAPO | Facebook"` (= přihlášení OK)
  a `OK: fresh menu (<datum aktuálního pondělí>)`
- Svoboda: `OK: fresh menu (<rozsah týdne>)`; občasné `429` znamená dočasný
  rate-limit Instagramu na tvou IP — srovná se samo do pár hodin

## Když Kantýna hlásí „Redirected to login"

Cookies expirovaly. Nový export a nasazení:

1. V prohlížeči se přihlas throwaway účtem na facebook.com a **ověř, že vidíš
   feed** (export z nepřihlášeného stavu nemá `c_user`/`xs` a je k ničemu).
2. Exportuj přes „Get cookies.txt LOCALLY" (Netscape formát) — soubor se uloží
   jako `fb_cookies.txt` (pro Instagram `ig_cookies.txt`).
3. Nasazení (skript export vyfiltruje jen na FB/IG cookies a originál smaže;
   `-UpdateSecrets` zároveň obnoví GitHub secrets pro CI):

```powershell
cd "$env:LOCALAPPDATA\reporyje-menu\repo"; .\scripts\setup-local-task.ps1 -FbCookies ~\Downloads\fb_cookies.txt -IgCookies ~\Downloads\ig_cookies.txt -UpdateSecrets
```

4. Znovu spustit plný test (příkaz nahoře).

## Ostrý test naplánované úlohy

```powershell
Start-ScheduledTask ReporyjeMenuScrape
Get-Content "$env:LOCALAPPDATA\reporyje-menu\scrape.log" -Tail 20
```

Pozn.: ve středu/čtvrtek úloha jen zaloguje „přeskakuji" — plný průchod
otestuje pouze `FORCE_SCRAPE` příkaz nahoře.
