# DJ Music Choice Assist — YouTube DJ Resource Engine

This module builds a **DJ knowledge layer**, primarily from **DJ Gig Logs** — videos/descriptions
where a real DJ timestamps every song they played during an actual set. That gives the engine
real-world facts: what was played, in what order, how far into the night, and what followed what.
Generic DJ list/tip videos are still supported as a lower-confidence fallback source.

It does **not** download, store, or reproduce any video/audio media — only text metadata and
publicly available caption text, which is summarized into structured tags. No copyrighted
music files are ever fetched or stored.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and set `YOUTUBE_API_KEY` (create one at
   https://console.cloud.google.com/apis/credentials with the YouTube Data API v3 enabled).

## Cloud Run customer API

The customer-facing API is available locally with:

```powershell
npm run dev:server
```

It provides `GET /health` and `POST /events`. Send an `EventInput` JSON object to `POST /events`
to receive the event profile, DJ game plan, local guidance, and automatic AI guidance. The container is defined
in [Dockerfile](Dockerfile) and listens on Cloud Run's `PORT` environment variable.

Cloud Code can build and deploy this container to project `ai-dj-mix`. Before deployment, enable
Cloud Run and Artifact Registry, choose a region, and configure `YOUTUBE_API_KEY` through Secret
Manager. Grant the Cloud Run service account access to that secret. The current service uses the
local knowledge base in `data/knowledge-base.json` unless `KNOWLEDGE_BASE_BUCKET` is set. Set it
to `knowledge-base-bucket` in Cloud Run to use `knowledge-base.json` in Cloud Storage. The Cloud
Run architecture supplies the service account's `roles/storage.objectAdmin` binding automatically.
Local development keeps using the JSON file when the bucket variable is absent.

When deployed to Cloud Run, Vertex AI is automatic for customers: the backend uses the Cloud Run
service account and Application Default Credentials, so customers never enter an AI key. Set
`GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, and `VERTEX_AI_MODEL` in Cloud Run. If Vertex AI
is unavailable during local development, the API returns the local deterministic guidance instead.
When Cloud Run is connected to the Vertex AI Agent Engine in the architecture, the generated
Terraform supplies the service account's `roles/aiplatform.user` binding automatically.

## Usage

```powershell
# Ingest by search query — finds DJ videos and extracts song knowledge from each
npm run dev:ingest -- --query "50 hip hop songs that always work in the club"

# Ingest a single video by URL or ID
npm run dev:ingest -- --video https://www.youtube.com/watch?v=XXXXXXXXXXX

# Get recommendations for a scenario, with a Banger Score + explanation
npm run dev:recommend -- --scenario peak-hour --limit 5

# Ask what real DJs play right after a given song (from gig log transitions)
npm run dev:next -- --current "Yeah!" --artist "Usher"

# Repair legacy numbered playlist records after upgrading the extractor
npm run repair

# Export every scenario match without printing the full list
npm run dev:recommend -- --scenario nightclub --all --output data/playlists/nightclub.txt

# Research gig-log videos for a scenario, then export the songs actually played
npm run dev:recommend -- --scenario nightclub --research --all --output data/playlists/nightclub.txt

# Research and organize a wedding by schedule moment
npm run dev:recommend -- --scenario wedding --schedule ceremony,cocktail,dinner,dance,peak,last-dance --research --all --output data/playlists/wedding.txt
```

Knowledge is stored in [data/knowledge-base.json](data/knowledge-base.json) and grows every
time you ingest more videos.

Recommendation scenarios include weddings, proms, nightclubs, house parties, pool and beach
parties, block parties, bar/lounges, graduations, quinceaneras, sweet sixteens, corporate events,
holiday parties, concerts/festivals, karaoke, sports parties, family parties, bachelor and
bachelorette parties, fundraisers, throwbacks, dance floors, cocktail/dinner, and set-position
tags such as opener, warm-up, peak-hour, cool-down, and late-night. Use any tag with
`npm run dev:recommend -- --scenario <tag> --limit N`.

Use `--all` to export every real gig-log song to a simple text file. Each entry includes a
YouTube search link for finding the music; video titles and DJ section headings are left out.
Add `--research` to search YouTube for gig-log videos first. Use `--query "..."` to provide a
more specific research prompt. The app reads public descriptions and captions for tracklists;
it does not download or listen to copyrighted audio.
Use `--schedule` with comma-separated stages such as `ceremony`, `cocktail`, `dinner`, `entrance`,
`first-dance`, `cake`, `bouquet`, `dance`, `peak`, and `last-dance`. The exported text groups
songs under each stage. The same schedule feature works with prom, birthday, graduation, and
other event scenarios.

## How it works

```
YouTube video description (DJ Gig Log timestamps, e.g. "0:00 Usher - Yeah!")
        ↓
gigLogParser: parses ordered tracklist, computes each track's relative position in the set
        ↓
setRole (opener/warm-up/peak-hour/cool-down/late-night) + neighbor tracks become scenario
tags + follow-up/preceded-by data — high-confidence, since it's what was actually played
        ↓ (fallback when no timestamped tracklist is found)
songExtractor: regex/heuristics find "Artist - Title" mentions in title/description/transcript
        ↓
knowledge/store: merges mentions per-song, tracks channels/follow-ups, recomputes Banger Score
        ↓
scoring/bangerScore + scoring/insights: weighted score + peak-hour strength, crowd-recognition
stars, best scenarios, common follow-ups — the "why" behind each recommendation
```

### Banger Score signals

| Signal | Weight |
| --- | --- |
| DJ recommendations (extraction confidence) | 30% |
| Frequency mentioned across sources | 20% |
| Event/scenario suitability | 15% |
| Crowd/party reputation | 15% |
| Energy | 10% |
| Transition compatibility | 10% |

## Extending

- **Sources**: add new ingestors alongside `src/youtube/` (DJ blogs, charts, your own play
  history) that produce `SongMention`s and call `addMention` — the scoring/storage layer is
  source-agnostic.
- **Extraction quality**: `src/extraction/songExtractor.ts` and `src/extraction/gigLogParser.ts`
  are currently regex/heuristic based. Either can be swapped for an LLM-based extractor without
  changing the schema.
- **Personal DJ knowledge**: your own play history/ratings can be ingested the same way,
  as a `KnowledgeSource` of a new `type`, and later weighted higher than generic sources.
- **Music metadata (BPM/key/genre)**: intended as a separate, third knowledge source that the
  future recommendation engine combines with gig-log knowledge and personal history.

## Customer-meeting Event Questionnaire → DJ Game Plan

When a DJ meets with a customer, the customer can text/paste their Must Play and Do Not Play
songs (both optional), plus optional schedule, event type, and audience details. The engine
turns that into an Event Music Profile and a DJ Game Plan built around the customer's
requests as **anchors**, filled in with Banger-Score-ranked picks from the DJ Gig Log
knowledge base.

```powershell
npm run dev:event -- --file data/events/sample-event-input.json
```

The input JSON (see [data/events/sample-event-input.json](data/events/sample-event-input.json))
mirrors the questionnaire:

- **Required**: `eventName`, `eventDate`, `eventType` (one of `wedding`, `birthday`,
  `sweet-16-quinceanera`, `graduation`, `corporate`, `school-college`, `club-bar`,
  `private-party`, `anniversary`, `holiday-party`, `concert-festival`, `other` — with
  `otherEventTypeLabel` required only when `eventType` is `"other"`).
- **Optional `schedule`**: guest arrival, cocktail hour, dinner, dancing starts, special
  performances, cake, toasts/speeches, last song, event end.
- **Optional `audience`**: age ranges, groups (family/friends/coworkers/children/teens/
  young-adults/adults/older-adults), and a freeform `culturalBackground` note — used only to
  surface relevant genres/traditions the customer wants represented, never to assume anything
  about what to play instead of their actual requests.
- **Optional `mustPlayRaw` / `doNotPlayRaw`**: freeform pasted text, one song per line (or
  comma/semicolon separated if it's all on one line), as `"Artist - Title"`, `"Title" by
  Artist`, `Title (Artist)`, or just a title/artist — [src/events/songListParser.ts](src/events/songListParser.ts)
  parses it.

The generated `DjGamePlan` ([src/events/gamePlanBuilder.ts](src/events/gamePlanBuilder.ts)) has
five sections — cocktail/arrival, dinner, dance-floor opening, peak-hour, late-night — each
filled with must-play anchors (placed by their own gig-log scenario history, or defaulted to
peak-hour) plus knowledge-base picks, with do-not-play entries filtered out everywhere. Results
are saved to `data/events/<event-id>.json`.

Each event also includes a customer-facing event advisor. It gives plain guidance about missing
timeline details, ceremony or special moments, audience balance, request review, microphone and
setup needs, and the final event check. It is local and deterministic, so it works without
another AI service or API key; a future model can be added behind the same guidance output.

