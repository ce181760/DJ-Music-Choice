import { ScenarioTag } from "../knowledge/schema.js";

/** Keyword heuristics used to infer scenario tags from surrounding text (title/description/transcript). */
const TAG_KEYWORDS: Record<ScenarioTag, string[]> = {
  banger: ["banger", "crowd killer", "always works", "never fails", "goes off"],
  "dance-floor": ["dance floor", "dancefloor", "get people dancing", "packed floor"],
  "cocktail-dinner": ["cocktail hour", "dinner music", "background music", "lounge"],
  wedding: ["wedding", "reception", "bride and groom", "first dance"],
  "car-show-party": ["car show", "car meet", "trunk", "riding music"],
  throwback: ["throwback", "old school", "classic", "nostalgia", "2000s", "90s", "80s"],
  "birthday-party": ["birthday", "bday party"],
  "college-party": ["college party", "frat party", "campus party"],
  prom: ["prom", "prom night", "school dance", "formal dance"],
  nightclub: ["nightclub", "night club", "club set", "club bangers"],
  "house-party": ["house party", "house party mix", "at-home party"],
  "pool-party": ["pool party", "poolside"],
  "beach-party": ["beach party", "beach club"],
  "block-party": ["block party", "street party"],
  "bar-lounge": ["bar lounge", "bar playlist", "lounge bar"],
  graduation: ["graduation", "grad party", "graduation party"],
  quinceanera: ["quinceañera", "quinceanera", "quince"],
  "sweet-16": ["sweet 16", "sweet sixteen"],
  "corporate-event": ["corporate event", "company party", "office party"],
  "holiday-party": ["holiday party", "christmas party", "new year's party", "new years party"],
  "concert-festival": ["concert", "festival", "music festival", "live set"],
  karaoke: ["karaoke", "singalong classics"],
  "sports-party": ["sports party", "game day", "tailgate", "watch party"],
  "family-party": ["family party", "family reunion", "family gathering"],
  "bachelor-party": ["bachelor party", "stag party"],
  "bachelorette-party": ["bachelorette party", "hen party"],
  fundraiser: ["fundraiser", "charity event", "benefit party"],
  ceremony: ["ceremony", "processional", "recessional", "walk down the aisle"],
  "cocktail-hour": ["cocktail hour", "cocktail-hour", "cocktail reception"],
  dinner: ["dinner music", "dinner playlist", "dinner hour"],
  "grand-entrance": ["grand entrance", "grand-entrance", "bridal party entrance"],
  "first-dance": ["first dance", "couples first dance"],
  "cake-cutting": ["cake cutting", "cake-cutting"],
  "bouquet-toss": ["bouquet toss", "bouquet-toss", "garter toss"],
  "last-dance": ["last dance", "final song", "closing song"],
  "slow-singalong": ["slow song", "sing along", "singalong", "ballad", "sing-along"],
  "peak-hour": ["peak hour", "peak time", "prime time", "main event"],
  "late-night": ["late night", "after hours", "closing set", "last call"],
  transition: ["transition", "bpm", "mixed into", "blend", "segue"],
  "dj-tool": ["dj tool", "intro edit", "acapella", "mashup", "clean edit", "extended edit"],
  opener: ["opener", "opening set", "warm up song", "first song"],
  "warm-up": ["warm up", "warming up", "building energy"],
  "cool-down": ["cool down", "cooling down", "bringing it down", "wind down"],
};

/** Returns scenario tags whose keywords appear in the given text. */
export function inferScenarioTags(text: string): ScenarioTag[] {
  const lower = text.toLowerCase();
  const tags: ScenarioTag[] = [];
  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS) as [
    ScenarioTag,
    string[]
  ][]) {
    if (keywords.some((kw) => lower.includes(kw))) {
      tags.push(tag);
    }
  }
  return tags;
}
