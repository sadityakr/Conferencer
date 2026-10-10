# Conferencer

Turn a conference **schedule PDF** into a calendar, sort everyone's **photos** into the talk they were taken in, and export a **conference book** (PDF).

Most conference photos end up as hundreds of unlabelled pictures in a camera roll. Every photo already records *when* it was taken, and the schedule says *what* was happening then and where. Conferencer joins the two, so each slide photo ends up next to its talk title, speakers, session and room.

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000
npm test               # unit + end-to-end tests on the toy conference
```

Try it with the toy data in `public/samples/`:

1. Set your name at the top, upload `toy-schedule.pdf` → a two-day calendar with parallel rooms.
2. **Add photos → Upload photos**, choose the `alice_*.jpg` files.
   - The keynote photo is filed automatically (only one session was running).
   - The coffee-break photo goes to *Unsorted*.
   - The three Room A/B photos ask **"Which session were you in?"** Answer once and all three land in the right talks.
3. Change your name to Bob and upload the `bob_*.jpg` files. Bob gets his own question, because people in a group sit in different rooms.
4. Open a talk to add notes or photos straight to it, then **Book → Open PDF book**.

`npm run samples` regenerates the toy PDF and photos (they have fake EXIF capture times).

## How photos are matched

| Situation at capture time | What happens |
| --- | --- |
| exactly one session running | assigned to it, and to the talk running at that minute |
| parallel sessions running | you are asked which one you were in; the answer is remembered for your other photos from that session |
| break / outside the programme / no time | *Unsorted* — place it by hand or leave it in the book's last chapter |

Capture time is read in this order: EXIF `DateTimeOriginal` + `OffsetTimeOriginal` → EXIF time read as conference-local time (cameras store wall-clock time) → in-app capture moment → file date (flagged "check", since copying files can change it). A 10-minute grace period covers photos taken just before or after a session.

Three ways to add photos:

- **Upload photos**: a whole camera roll, matched by time.
- **Capture now**: if parallel sessions are running, it asks which one you are in, then you take photos. *Pretend it is another time* lets you try this on the toy conference.
- **From a talk page**: "I'm in this talk". Photos go straight to it, and you can add notes.

## Group use

There is no login yet. Each browser picks a display name, and photos and notes are credited to it. Everyone who opens the same conference link adds to one shared pool, and the book can be built for the **group** or as one person's **personal** book.

**Shared OneDrive / Teams folder** (Add photos → Shared folder): paste the folder link and every image in it is imported, credited to the person who added the file to the folder, and matched by time. Re-running skips photos that were already imported. This uses the Microsoft Graph `shares` API and currently needs a token in `MS_GRAPH_TOKEN` (Files.Read.All). A proper "Sign in with Microsoft" flow is still to do (see below).

## Schedule parsing and the VLM

`SCHEDULE_PARSER=text` (default) uses a built-in heuristic parser. It rebuilds lines from the PDF with pdf.js and expects every session and talk line to carry a time range, as the toy PDF does.

`SCHEDULE_PARSER=vlm` sends the programme text to a vision-language model and validates the JSON it returns. Providers can be swapped in `src/lib/vlm/provider.ts`:

- `VLM_PROVIDER=mock` (default) for tests and offline work
- `VLM_PROVIDER=openai-compatible` with `VLM_BASE_URL`, `VLM_API_KEY`, `VLM_MODEL` for any OpenAI-style endpoint (vLLM, Ollama, a university-hosted model, …)

See `.env.example`.

## Code map

```
src/lib/schedule/   pdfText (pdf.js → lines), textParser, vlmParser, normalize
src/lib/assign.ts   pure photo → session/talk decision (most of the logic, fully unit-tested)
src/lib/time.ts     EXIF / timezone handling
src/lib/photos.ts   ingest (EXIF, store, match), resolve choices, cascade to other photos
src/lib/book.ts     PDF conference book (pdf-lib)
src/lib/sources/    OneDrive / SharePoint shared folder via Microsoft Graph
src/lib/db.ts       SQLite schema (better-sqlite3); data in ./data (CONFERENCER_DATA_DIR)
src/app/            Next.js pages + API routes
tests/              vitest: time, assign, parsers, end-to-end flow on the toy conference
```

## Not done yet

- **Login and groups**: real accounts, invite links, and permissions (currently names are on the honour system).
- **Microsoft sign-in** for OneDrive/Teams import (MSAL + an Entra app registration, which a university tenant may need to approve).
- **VLM on photos**: read the slide title in a photo to choose between parallel sessions without asking, and caption photos.
- **Schedule review/edit** screen to fix parser mistakes; real-world PDF layouts (grids, multi-column) via the VLM path.
- **HEIC** photos: currently rejected with a hint to use JPEG ("Most Compatible" on iPhone).
- **lit-RAG export**: per-talk Markdown/JSON with image references, alongside the PDF book.
- **Phone app**: the web app is mobile-first, so a PWA or React Native shell is the natural next step.
