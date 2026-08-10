# Throwaway účet pro scraping Facebooku a Instagramu

Python tier 2 (`scrapers/py/fb_group_images.py`, `scrapers/py/ig_profile_images.py`)
potřebuje cookies přihlášeného účtu — Facebook skupinu Kantýny nelze číst bez
přihlášení a Instagram blokuje anonymní API. **Nepoužívej osobní účet** — účet
používaný ke scrapingu z CI riskuje checkpoint nebo ban.

## 1. Založení účtů

- **Facebook**: nový účet na facebook.com (potřeba e-mail + SMS ověření).
  Po založení **požádej o členství ve skupině Kantýna STAPO**
  (https://www.facebook.com/groups/1396911425536833) a počkej na schválení —
  bez členství scraper skupinu neuvidí.
- **Instagram**: nový účet na instagram.com (stačí e-mail). Není potřeba nikoho
  sledovat — profil @svoboda_reznictvi je veřejný, jen čtení vyžaduje login.

Tip: účty pár dní normálně používej (prohlížení, pár lajků), čerstvý účet
s nulovou aktivitou dostane checkpoint rychleji.

## 2. Export cookies

1. Přihlas se daným účtem v Chrome/Firefoxu.
2. Nainstaluj rozšíření **Get cookies.txt LOCALLY** (Chrome) nebo **cookies.txt**
   (Firefox).
3. Na otevřené stránce facebook.com (resp. instagram.com) klikni na rozšíření
   → Export → ulož `facebook.com_cookies.txt` / `instagram.com_cookies.txt`
   (Netscape formát; JSON export z Cookie-Editoru funguje taky — scrapery
   umí oba formáty).

## 3. Nahrání do GitHub secrets

```powershell
gh secret set FB_COOKIES --repo Dat0s/restaurace-menu-reporyje < facebook.com_cookies.txt
gh secret set IG_COOKIES --repo Dat0s/restaurace-menu-reporyje < instagram.com_cookies.txt
```

Pak spusť workflow a zkontroluj log, který tier uspěl:

```powershell
gh workflow run scrape.yml --repo Dat0s/restaurace-menu-reporyje
```

## 3b. Lokální scraping na PC (doporučeno)

Místo ručního `gh secret set` použij setup skript — z jednoho exportu nastaví
**všechno najednou** (lokální cookies, volitelně i GH secrets, klon repa
a scheduled task `ReporyjeMenuScrape`, který Po/Út/Pá v 7–11 h scrapne
Kantýnu+Svobodu z domácí IP, pokud web nemá aktuální menu):

```powershell
.\scripts\setup-local-task.ps1 -FbCookies ~\Downloads\facebook.com_cookies.txt `
                               -IgCookies ~\Downloads\instagram.com_cookies.txt `
                               -UpdateSecrets
```

Skript exporty sám **vyfiltruje jen na facebook/instagram cookies** (rozšíření
často exportují všechny domény včetně banky a práce!) a originály smaže.
Cookies skončí v `%LOCALAPPDATA%\reporyje-menu\`, log tasku tamtéž
(`scrape.log`). Když menu nejde stáhnout ani lokálně, dorazí ti e-mail
z GitHubu (workflow **Menu freshness alert**, Po/Út/Pá ~11:15).

## 4. Údržba

- Cookies expirují (typicky po pár měsících, nebo když Meta session zneplatní).
  Příznaky v logu (workflow i `%LOCALAPPDATA%\reporyje-menu\scrape.log`):
  - **Facebook**: `Redirected to login` + `No post images found in group feed`
  - **Instagram**: `IG SESSION INVALID/EXPIRED` (puppeteer tier) a `429 Too
Many Requests` na `web_profile_info` (fetch + instaloader tiery — IG
    odpovídá 429 na jakýkoli API dotaz bez platné session, není to skutečný
    rate-limit)

  Web pak spadne na fallback kartu → zopakuj krok 2–3 (přihlas se throwaway
  účtem v prohlížeči, znovu exportuj cookies a spusť
  `scripts/setup-local-task.ps1 -IgCookies ... [-FbCookies ...] -UpdateSecrets`).

- Lokální test bez CI:

```powershell
$env:FB_COOKIES = Get-Content facebook.com_cookies.txt -Raw
python scrapers/py/fb_group_images.py
```
