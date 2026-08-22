import assert from "node:assert/strict";
import test from "node:test";
import { extractSongsFromText } from "./songExtractor.js";
import { findSong } from "../knowledge/store.js";
import { KnowledgeBase } from "../knowledge/schema.js";
import { repairLegacyPlaylistEntries } from "../knowledge/migrate.js";
import { inferScenarioTags } from "./scenarioTags.js";
import { parseGigLog } from "./gigLogParser.js";
import { inferScenarioTags as inferTags } from "./scenarioTags.js";
import { isValidSong, normalizeSongFields } from "./songValidation.js";

test("extracts songs from labeled numbered playlist lines", () => {
  const [song] = extractSongsFromText(
    "Clean - 20. Usher - Yeah ft Ludacris, Lil Jon",
    []
  );

  assert.equal(song.artist, "Usher");
  assert.equal(song.title, "Yeah ft Ludacris, Lil Jon");
  assert.equal(song.confidence, 0.8);
});

test("finds featured-title variants by artist", () => {
  const knowledgeBase: KnowledgeBase = {
    version: 1,
    songs: {
      "usher - yeah ft ludacris lil jon": {
        key: "usher - yeah ft ludacris lil jon",
        title: "Yeah ft Ludacris, Lil Jon",
        artist: "Usher",
        mentions: [],
        scenarioTagCounts: {},
        followUpCounts: {},
        precededByCounts: {},
        channelsPlayedBy: [],
        bangerScore: 0,
        updatedAt: "",
      },
    },
  };

  assert.equal(
    findSong(knowledgeBase, "Yeah!", "Usher")?.key,
    "usher - yeah ft ludacris lil jon"
  );
});

test("finds legacy numbered titles already in the knowledge base", () => {
  const knowledgeBase: KnowledgeBase = {
    version: 1,
    songs: {
      "clean - 20 usher yeah ft ludacris lil jon": {
        key: "clean - 20 usher yeah ft ludacris lil jon",
        title: "20. Usher - Yeah ft Ludacris, Lil Jon",
        artist: "Clean",
        mentions: [],
        scenarioTagCounts: {},
        followUpCounts: {},
        precededByCounts: {},
        channelsPlayedBy: [],
        bangerScore: 0,
        updatedAt: "",
      },
    },
  };

  assert.equal(
    findSong(knowledgeBase, "Yeah!", "Usher")?.key,
    "clean - 20 usher yeah ft ludacris lil jon"
  );
});

test("repairs legacy keys while preserving transitions", () => {
  const knowledgeBase: KnowledgeBase = {
    version: 1,
    songs: {
      "clean - 20 usher yeah ft ludacris lil jon": {
        key: "clean - 20 usher yeah ft ludacris lil jon",
        title: "20. Usher - Yeah ft Ludacris, Lil Jon",
        artist: "Clean",
        mentions: [],
        scenarioTagCounts: { "peak-hour": 1 },
        followUpCounts: { "clean - 21 usher pop ya collar": 2 },
        precededByCounts: {},
        channelsPlayedBy: [],
        bangerScore: 0,
        updatedAt: "",
      },
      "clean - 21 usher pop ya collar": {
        key: "clean - 21 usher pop ya collar",
        title: "21. Usher - Pop Ya Collar",
        artist: "Clean",
        mentions: [],
        scenarioTagCounts: {},
        followUpCounts: {},
        precededByCounts: {
          "clean - 20 usher yeah ft ludacris lil jon": 2,
        },
        channelsPlayedBy: [],
        bangerScore: 0,
        updatedAt: "",
      },
    },
  };

  assert.equal(repairLegacyPlaylistEntries(knowledgeBase), 2);
  assert.equal(
    knowledgeBase.songs["usher - yeah ft ludacris lil jon"].followUpCounts[
      "usher - pop ya collar"
    ],
    2
  );
  assert.equal(
    knowledgeBase.songs["usher - pop ya collar"].precededByCounts[
      "usher - yeah ft ludacris lil jon"
    ],
    2
  );
});

test("infers expanded event scenarios", () => {
  const tags = inferScenarioTags(
    "Prom night club bangers for a graduation pool party"
  );

  assert.deepEqual(tags, [
    "banger",
    "prom",
    "nightclub",
    "pool-party",
    "graduation",
  ]);
});

test("ignores timestamped set headings and equipment lines", () => {
  const tracks = parseGigLog(
    [
      "0:00 Intro",
      "1:00 Usher - Yeah!",
      "2:00 Opening Set",
      "3:00 Missy Elliott - Work It",
      "4:00 Rane Seventy-Two Mixer https://example.com",
      "5:00 Rihanna - Only Girl",
    ].join("\n")
  );

  assert.deepEqual(
    tracks.map((track) => `${track.artist} - ${track.title}`),
    ["Usher - Yeah!", "Missy Elliott - Work It", "Rihanna - Only Girl"]
  );
});

test("recognizes nightclub context from a search phrase", () => {
  assert.deepEqual(inferTags("nightclub DJ set tracklist"), ["nightclub"]);
});

test("rejects metadata and event labels as songs", () => {
  assert.equal(isValidSong({ title: "Reception", artist: "" }), false);
  assert.equal(isValidSong({ title: "How to Set Speaker Delay", artist: "DJ Tips" }), false);
  assert.equal(isValidSong({ title: "Equipment Overview & Load", artist: "" }), false);
  assert.equal(isValidSong({ title: "PARTY!", artist: "Artist to confirm" }), false);
});

test("accepts and normalizes a real song with a video suffix", () => {
  const song = normalizeSongFields({ title: "Yeah! (Official Music Video)", artist: "Usher" });
  assert.deepEqual(song, { title: "Yeah!", artist: "Usher" });
  assert.equal(isValidSong(song), true);
});
