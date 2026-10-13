# A108 Surface Inspection Assistant

**Accounting For Every Aspect In Less Time.** Answers from the standard, never from memory.

Type a surface-inspection question in plain English (or fill in the form) and get an ASTM A108-18 Table A1.8 result card:

| Signal | Meaning |
|---|---|
| 🟢 **YES · WITHIN LIMIT** | Depth is at or under the Table A1.8 limit for every column that applies |
| 🔴 **NO · EXCEEDS LIMIT** | Depth is over the limit for every column that applies |
| 🟡 **HOLD** | Missing or unclear input, out of scope, or the answer depends on the grade, so it asks |
| 🔵 **LIMIT** | No depth given, so it shows the allowable depth |

Every card cites the Table A1.8 row, column and footnotes, shows the math, lists assumptions, and ends with *"Per the cited table; confirm against your engineering criteria."* **Copy for NCR / inspection record** puts the same result on your clipboard in the project's output format.

## Go live (one time, about 3 minutes)

1. Create a new GitHub repository (for example `non-destructive-surface-inspection-ai-assistant`), then push this folder to it:
   ```bash
   cd a108-inspector
   git init -b main
   git add .
   git commit -m "A108 surface inspection assistant"
   git remote add origin https://github.com/<you>/non-destructive-surface-inspection-ai-assistant.git
   git push -u origin main
   ```
2. On GitHub, open **Settings → Pages**, and under **Build and deployment → Source** pick **GitHub Actions**.
3. Open the **Actions** tab. The *Test and deploy demo* workflow runs the tests, then publishes the site. When it turns green, the live link is shown on the run page (it looks like `https://<you>.github.io/non-destructive-surface-inspection-ai-assistant/`).

From then on, **every push to `main` re-runs the tests and redeploys automatically**. If a test fails, the old site stays up and nothing broken goes live.

## Run it on your laptop (backup for the demo)

No install needed: open `site/index.html` in a browser. It works offline.
Or, with Node 18+: `npm start`, then open http://localhost:8080.

## Demo script (about 2 minutes)

1. Click the **1018 CD · 1 in. · 0.020** chip → 🔴 red: 0.020 in. vs 0.016 in. allowed.
2. Click **1215 · 1 in. · 0.018** → 🟢 green: 0.018 in. vs 0.024 in. allowed.
3. Click **"1 inch defect"** → 🟡 hold: it asks whether 1 in. is depth or length, and for the grade and size.
4. Click **No grade · 1.5 in. · 0.032** → 🟡 hold: two grade groups fail, one passes, so the grade decides.
5. Type a judge's question live, then edit any field in **What I read** to show the result update.
6. Click **Copy for NCR** and paste it into a document.

## How it works

| File | What it does |
|---|---|
| `site/engine.js` | Rules engine. The Table A1.8 values: Level 1 = 0.008 / 0.010 / 0.012 in. (¼ thru ⅝ in.) or 1.6 / 2.0 / 2.4 % of size (over ⅝ thru 6 in.); Level 2 = Nil. No interpolation. |
| `site/grades.js` | 189 grade → sulfur entries extracted from ASTM A29/A29M-20 Tables 1–2. Leaded grades (e.g. 12L14, 41L40) map to their base grade. |
| `site/parse.js` | Reads plain-English questions: thousandths, "20,000 deep", fractions like 1-1/16, "10 % sulfur", and more. Anything it reinterprets is flagged on the card. |
| `site/app.js`, `index.html`, `style.css` | The page. |
| `tests/session.test.js` | Regression tests: all 10 test-session questions, in the original wording, plus edge cases. Run `npm test`. |
| `.github/workflows/pages.yml` | Test, then deploy to GitHub Pages, on every push. |

### Rules it follows (from the project instructions)
1. Source only: limits come from Table A1.8, and grade sulfur comes from A29-20.
2. It cites the row, column and footnotes by label.
3. Missing or unclear input gets 🟡 HOLD, with a list of what's needed. Sizes outside ¼–6 in. and sulfur above 0.35 % are "not specified".
4. No interpolation between size ranges. Exactly ⅝ in. uses the fixed-inch column.
5. Units are kept as written, and conversions are shown separately.
6. No final verdicts: every card says to confirm against your engineering criteria.

When the grade is unknown, it checks every sulfur column. If they all agree, it answers. If they disagree, it holds and asks.

## Important

- The ASTM PDFs are **not** in this repo. ASTM standards are copyrighted, so keep them out of any public repository. Verify results against your licensed copies.
- Guidance tool only. Not affiliated with or endorsed by ASTM International.
