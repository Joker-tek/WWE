# WWE Universe Tracker

A complete management and tracking app for your own WWE Universe: RAW, SmackDown and NXT rosters, championships and lineages, matches, rivalries, storylines, tag teams, statistics and a matchmaking assistant. It runs entirely on your device, works offline and can be installed as an app on desktop or phone.

## Running it

**Windows, easiest:** double-click `start-tracker.bat`. It builds the app and opens it at <http://localhost:4173>. Keep the black window open while you use the app.

**From a terminal:**

```sh
npm install        # first time only
npm run build
npm run preview    # serves the built app at http://localhost:4173
```

For development with live reload, run `npm run dev` (port 5173).

> **Important:** browsers keep data separately for each address. Data entered at `localhost:4173` is not visible at `localhost:5173`, and vice versa. Pick one address for real use (the launcher always uses 4173), and move data between addresses or devices with **Data & Backups → Download / Import**.

Node.js was installed as a portable copy in `%LOCALAPPDATA%\nodejs-portable` and added to your user PATH. Open a new terminal for `npm` to be found.

### On your phone

The app is a Progressive Web App. To install it on a phone it needs to be served over HTTPS:

1. Push this repository to GitHub.
2. In the repo, go to **Settings → Pages → Source** and choose **GitHub Actions**. The included workflow (`.github/workflows/deploy.yml`) tests, builds and publishes the app.
3. Open the published URL on your phone and choose **Add to Home Screen** / **Install app**.

Only the app's code is published. Your universe data never leaves the device you enter it on. To use the same universe on phone and computer, export a backup on one and import it on the other.

## Your data and backups

| Layer | What it does |
|---|---|
| **Browser database (IndexedDB)** | Every change is saved automatically within half a second and survives closing the browser or restarting. The app asks the browser to mark the storage as *persistent* so it isn't cleared automatically. |
| **Auto-save file** (desktop Chrome / Edge) | In **Data & Backups**, choose a file (ideally in OneDrive, Dropbox or Google Drive). The full universe is rewritten to it after every change. After a browser restart, click **Resume file auto-save** once to re-grant access. |
| **Snapshots** | A restore point is saved automatically each day and before every import or restore. The newest 20 are kept. |
| **JSON backups** | **Download full backup** saves everything, pictures included, to one `.json` file. **Import / restore** validates the file, shows what's in it, snapshots your current data, then restores. On phones, **Share / save to cloud** sends the file to Drive, iCloud or Files. |
| **CSV exports** | Superstars and records, match history, title reigns and tag teams, for Excel or Sheets. |

The dashboard reminds you when your last backup is older than the number of days set in Settings (7 by default).

## Features

- **Dashboard:** brand overviews, superstar totals, every champion with days held, active rivalries, upcoming matches, recent results, top-5 rankings and notifications. Notifications cover overdue results, injuries (including injured champions), vacant titles, reign milestones, storyline deadlines, rivalries at boiling point and backup reminders.
- **Brands:** a hub page each for RAW, SmackDown and NXT, with separate men's and women's rosters plus tag teams, titles, rivalries, storylines and matches. Superstars and tag teams can be transferred between brands, and every transfer is logged with a date.
- **Superstars:** separate **Men's Division** and **Women's Division** pages with stats, filters (brand, status, alignment, card position, search), sorting and grid or table views. Each profile has:
  - picture, real name, brand, division, alignment, status and popularity;
  - wins, losses, draws, win %, current, best and worst streak, and power rank;
  - current titles, every reign, rivalries, storylines and tag teams;
  - full match history, head-to-head against every opponent, and a career timeline.
- **Championships:** custom titles per brand or cross-brand, men's or women's, singles or tag, with a tier.
  - Current champion, days held and defenses.
  - Full lineage with editable reigns, plus records for most reigns, longest reign and most total days.
  - Title changes happen from match results, or manually (awarded titles, past history). Titles can be vacated or retired.
- **Matches:** 21 built-in types (singles, tag, Triple Threat, Fatal 4-Way, Battle Royal, Royal Rumble, Ladder, TLC, Steel Cage, Hell in a Cell, Elimination Chamber, elimination tag, WarGames and more) plus your own custom types.
  - Each match records participants, brand, show, date, winner and losers, draw or no contest, finish, description, duration, rating, title stakes, rivalry, storyline and notes.
  - Matches can be scheduled now and their results recorded later.
- **Rivalries:** two or more superstars or teams, with intensity 1–10 and a status (planned, active, paused, ended).
  - A timeline of moments and matches, with matches between the participants detected automatically.
  - Each participant's record within the rivalry, a winner and ending, and one-click booking.
- **Storylines:** short- or long-term, with any number of superstars and teams, a current chapter and **Next chapter**, planned events with dates and overdue warnings, key moments, a merged timeline, linked matches and rivalries, and a final outcome.
- **Tag teams:** create teams, add and remove members (logged), assign a brand, track team win/loss records, title reigns, rivalries and history, disband or transfer.
- **Stats & rankings:** leaderboards (most wins and losses, best win %, longest win and losing streaks, most matches, most championships, longest reigns, current streaks), men's and women's power rankings, brand comparison, head-to-head and match-type breakdowns. Filters cover brand, division, date range and match type, and results export to CSV.
- **Matchmaker:** suggests championship matches, singles, tag matches, new rivalries and storyline developments, each with a score and the reasons for and against it. **Nothing is booked automatically.** You approve a suggestion, which books it as a scheduled match, or open it in the match form to adjust it first.
- **Universe date:** follow the real date, or run an in-universe calendar you advance yourself. The date drives reign lengths and notifications.
- **Interface:** dark theme by default (light theme available), responsive on desktop, tablet and phone, global search (top bar), and filters throughout.

## How statistics stay correct

Records are never stored as counters. Wins, losses, draws, streaks, rankings, reign lengths and defenses are always calculated from the match and reign history. That means editing a match, changing its winner or deleting it can never double-count anything.

Title changes recorded in a match are linked to it:

- Editing the match updates the reign.
- Un-ticking **Title changes hands** or deleting the match restores the previous champion.
- If a later title change already ended that reign, the app refuses the edit and explains why, rather than corrupting the lineage.

Deleting a superstar or team that appears in matches or title history is blocked. Set their status to Released, Inactive or Disbanded instead, so the history stays intact.

## About the "AI" matchmaker

The Matchmaker is a transparent, rule-based scoring engine that runs offline. It weighs:

- active rivalries and their intensity;
- power ranking and popularity;
- head-to-head history and how recently the pair met;
- win and losing streaks;
- current champions and title contenders;
- card position and division;
- brand;
- shared storylines;
- how often each superstar has wrestled in the last 30 days, and whether they're already booked.

It doesn't call an online AI model, so it needs no API key or account, and every score is fully explained.

## Starter roster

A new universe can start with about 55 superstars, all 16 current championships and two tag teams. The roster reflects roughly the 2025 WWE lineup, so it may be out of date. Edit it freely. All championships start **vacant** so you crown your own champions.

## Project structure

```
src/
  domain/      Pure logic, no UI: schema (zod), stats, titles, matchmaking, notifications, actions, CSV, seed
  store/       App state (zustand + immer) and persistence (IndexedDB, linked file, snapshots)
  components/  Reusable UI: layout, cards, tables, pickers, forms, modals, toasts
  pages/       One file per section
tests/         Domain tests and page render / UI-flow tests (Vitest + Testing Library)
```

Run `npm test` for the test suite (43 tests) and `npm run typecheck` for TypeScript.

## Known limitations

- Data lives in one browser on one device. Sync between devices is manual (export, then import), or via the auto-save file in a synced folder on desktop.
- Pictures are stored inside your data, shrunk to 320 px, so backups stay small.
- If the app is open in two tabs, a warning appears. Edit in one place at a time.
