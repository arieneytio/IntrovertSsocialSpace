# Introverts' Social Space

A tiny social-media-style feed that runs **completely offline**, straight from
disk — no server, no account, no internet. Everything you write and every
picture you add is stored locally in your browser (`localStorage`), so it stays
on your machine and is there again next time you open it.

Think of it as a private journal that *looks* like a social app.

## What you can do

- **Set your name and profile picture** — your name and avatar live in the top
  bar (top-right). Click the avatar to upload a picture; a small ✕ removes it and
  falls back to your initial. The picture also shows on every post you make.
  Uploads are **auto-cropped to a square and downscaled to 256×256** (saved as a
  compact JPEG), so even a huge photo only takes a few tens of KB. You can also
  **turn any existing picture into your avatar** — use the 👤 button on an album
  thumbnail, or open any photo full-screen and click **"Set as profile picture"**.
- **Daily reminders** — a panel on the right with a checklist of daily habits
  (eat breakfast/lunch/supper, exercise, study something new, clean your room,
  organize your things…). Tick them off through the day; the checks **reset
  automatically each new day**. Add your own reminders, rename them inline, or
  remove ones you don't need. Complete them all and you build a **🔥 day streak**
  (it counts consecutive days and breaks if you miss a whole day).
- **Play with me** — a tab with a simple card duel against the mascot. Each side
  holds cards ranked 1–7 (Magikarp → Mewtwo); over 7 rounds you each play one
  card per round and the higher rank wins the round — most round-wins takes the
  match. No armor, no power-ups, just a **running score** plus a cumulative
  win/loss/tie **record**. The mascot **learns from your last 100 games**
  (predicting what you tend to play at each round and trying to counter it), and
  it **talks every round** with excited, win/lose/tie-specific lines (the mascot
  sits on the right of the board). Played cards **deal in with a short reveal
  animation** and the winner gets a quick ring. The tab **widens to full width**
  (the side panels tuck away) so all seven cards fit comfortably. Fully offline —
  cards are drawn with emoji, no images are downloaded. After you play, the
  mascot takes a short **"thinking…"** pause, then its face-down card **flips
  face-up** to reveal the round. Win the match and you get a **confetti burst** 🎉.
- **Chibi mascot** — a friendly little character floats in the bottom-right with
  a speech bubble. Click it for a new thought; it also refreshes on its own. Its
  lines are **context-aware**: your reminder streak, nudges about reminders you
  haven't done yet ("Don't forget to eat breakfast today!"), a task still on your
  to-do list, suggestions to post a photo or start an album, questions about your
  day, a nudge to pray, reflection prompts, and inspirational quotes.
  - **Drag** it anywhere (its position is remembered), **hide** it with the ✕
    (a ✨ summon button appears to bring it back), and pick a **design** with the
    🎨 button: Blob, T-square, Ruler, Floppy disc, Card, Sun, or Moon — each a
    cute face on the shape. The chosen design, position, and hidden state persist.
- **Set a status** — a free-text line ("Out for coffee ☕") plus a colored
  availability dot you click to cycle: 🟢 online → 🟠 away → 🔴 busy → ⚪ invisible.
- **Post "what's on your mind"** — write up to 500 characters.
- **Attach pictures** — one or many per post. They're read on-device and shown
  in a tidy grid; click any image to view it full-screen.
- **Like** your posts (🤍 → ❤️) and **delete** ones you don't want.
- **Organize pictures into albums** — switch to the **Albums** tab to create
  named albums, add pictures to each, rename or delete an album, and remove
  individual pictures. Click any picture to view it full-screen. Pictures you
  attach to a **feed post are auto-filed into a default "Feed Photos" album**
  (identified by that name — if you rename or delete it, the next feed picture
  just creates a fresh one), and any picture can be **moved to another album**
  (⇄ on the thumbnail) — including a brand-new one created on the spot.
- **Keep a to-do list** — a **panel on the left** (under your profile) lets you
  add tasks, check them off, edit them inline, filter by All / Active / Completed,
  and clear finished ones.
- **Build spreadsheets** — the **Sheets** tab lets you create as many little
  spreadsheets as you like (a budget, a weight log, anything). Add/rename/delete
  columns and rows, edit any cell, and each numeric column gets an automatic
  total at the bottom. **Export** any sheet to a `.csv` file or **import** a CSV
  (create a new sheet from one, or replace an open sheet's contents).
- Everything **persists** — close the tab, reopen later, it's all still there.

## Tabs

The top bar carries four tabs (the To-Do list lives in the left column, not as a
tab):

- **Feed** — the composer and your timeline of posts.
- **Albums** — create albums and drop pictures into them to keep your photos
  organized separately from the feed.
- **Sheets** — create editable spreadsheets for tracking money, weight, or
  anything. Click a cell to type; the **Σ** row sums each numeric column (it's
  lenient — `$1,200`, `70kg`, and `-15` all count). Add columns/rows, rename
  headers, and delete what you don't need.
  - **⬇ Export CSV** downloads the open sheet as a standard `.csv` (UTF-8 with a
    BOM so Excel opens it cleanly).
  - **⬆ Import CSV** in the detail view replaces the open sheet's contents from a
    `.csv` file; **⬆ Import CSV** on the Sheets list creates a *new* sheet from a
    file (named after the file). The first row is treated as column headers, and
    quoted fields, embedded commas/newlines, and doubled quotes are all handled.
  - **➕ Append CSV** adds a CSV's rows to the *end* of the open sheet without
    touching its columns. The file's first row is treated as a header and
    skipped, and each appended row is fitted to the sheet's column count
    (extra cells dropped, missing cells left blank) — handy for adding a new
    month's data to an existing log.
- **Play with me** — a card duel against the mascot (see the feature list above).

## How to run

**Easiest:** double-click **`play.bat`** — it opens the app in your default
browser. You can also just open `src/index.html` directly. It uses `file://`
and needs no server.

**Optional (Python):** if you'd rather have a real `http://localhost` address,
run:

```
python serve.py        # then open http://localhost:8000
```

This serves the `src/` folder locally; it still never goes online.

## Project layout

```
New Project/
├── README.md
├── .gitignore
├── play.bat                Launcher — opens src/index.html in default browser
├── serve.py                Optional local Python server (not required)
│
├── src/
│   ├── index.html          Markup + post template
│   ├── css/
│   │   └── styles.css      All styling (CSS variables up top to retheme)
│   ├── js/
│   │   ├── storage.js      localStorage read/write (single namespaced blob)
│   │   └── app.js          UI logic: profile + avatar (crop/downscale), composer, feed, likes, albums, to-do, sheets, daily reminders + streak, chibi mascot, card-duel game, tabs, lightbox
│   └── assets/             (room for icons/images if you add any)
│
└── tests/
    └── test.html           Open in a browser to run the logic tests
```

## How your data is stored

All state lives under one `localStorage` key (`offlinegram.v1` — the original
name, kept so existing data survives the rename to Introverts' Social Space) as JSON:

```json
{
  "profile": { "name": "...", "status": "...", "availability": "online",
               "avatar": "data:image/... or null" },
  "posts":   [ { "id": "...", "text": "...", "images": ["data:image/..."],
                 "likes": 0, "liked": false, "createdAt": 1730000000000 } ],
  "albums":  [ { "id": "...", "name": "Feed Photos",
                 "images": ["data:image/..."], "createdAt": 1730000000000 } ],
  "todos":   [ { "id": "...", "text": "Buy milk", "done": false,
                 "createdAt": 1730000000000 } ],
  "sheets":  [ { "id": "...", "name": "Budget",
                 "columns": ["Item", "Amount"],
                 "rows": [ ["Rent", "1200"], ["Food", "300"] ],
                 "createdAt": 1730000000000 } ],
  "reminders": { "items": [ { "id": "r1", "text": "Eat breakfast" } ],
                 "checkedDate": "2026-06-01", "checked": { "r1": true },
                 "streak": 3, "streakDate": "2026-06-01" },
  "mascot":  { "design": "blob", "dismissed": false, "x": null, "y": null },
  "game":    { "stats": { "matches": 0, "playerWins": 0, "mascotWins": 0, "ties": 0 },
               "history": [ [4, 2, 7, 1, 5, 3, 6] ] }
}
```

The game's `history` keeps up to the last 100 finished matches (each entry is
your card picks in round order); the mascot tallies those to predict and counter
your next move.

The reminder `items` list persists; `checked` is wiped whenever `checkedDate`
no longer matches today's local date, giving the daily reset. `streak` is
credited the first time all reminders are completed on a day (`streakDate`
tracks when), and is treated as broken if a whole day passes uncompleted.

Images are stored inline as data URLs. Browser `localStorage` is typically
limited to ~5–10 MB, so very large or very many photos can fill it up — the app
will warn you if a save fails and rejects single images over 4 MB.

To wipe everything, clear site data for the page in your browser, or run
`localStorage.removeItem("offlinegram.v1")` in the dev-tools console.

## Notes

- No build step, no dependencies, no tracking, no network calls.
- Plain HTML / CSS / vanilla JavaScript; the only Python is the optional server.
- Tested by opening `tests/test.html` (see below).

## Running the tests

Open **`tests/test.html`** in a browser. It exercises the storage round-trip
and the helper functions (relative-time formatting, avatar initials) and prints
pass/fail results on the page.
