import assert from "node:assert";
import {
  breadcrumbJsonLd,
  characterJsonLd,
  episodeJsonLd,
  personJsonLd,
  subjectJsonLd,
  websiteJsonLd,
} from "../src/lib/seo/site.ts";
import { SubjectType, type Subject, type Character, type PersonDetail, type EpisodeDetail } from "@bangumi-x/share";

function mockSubject(over: Partial<Subject> = {}): Subject {
  return {
    id: 12,
    type: SubjectType.Anime,
    name: "test",
    name_cn: "测试",
    summary: "s",
    nsfw: false,
    date: "2020-01-01",
    platform: "TV",
    images: { large: "l", common: "c", medium: "m", small: "s", grid: "g" },
    volumes: 0,
    eps: 12,
    total_episodes: 12,
    rating: { rank: 1, total: 50, score: 8.5, count: {} },
    collection: { wish: 1, collect: 1, doing: 1, on_hold: 0, dropped: 0 },
    tags: [{ name: "标签A", count: 5 }, { name: "标签B", count: 3 }],
    ...over,
  };
}

const s = subjectJsonLd(mockSubject(), [], []);
assert.strictEqual(s["@type"], "TVSeries", "Anime subject should map to TVSeries");
assert.ok(Array.isArray(s.sameAs), "subject must have sameAs array");
assert.ok((s.sameAs as string[]).includes("https://bgm.tv/subject/12"));
assert.strictEqual(s.genre, "动画");
assert.ok(typeof s.keywords === "string" && (s.keywords as string).includes("标签A"));
assert.ok(s.aggregateRating, "rating with total>=10 should be present");

const noRating = subjectJsonLd(mockSubject({ rating: { rank: 0, total: 5, score: 7, count: {} } }), [], []);
assert.ok(!noRating.aggregateRating, "rating with total<10 must be filtered");

const book = subjectJsonLd(mockSubject({ type: SubjectType.Book }), [], []);
assert.strictEqual(book["@type"], "Book");
const game = subjectJsonLd(mockSubject({ type: SubjectType.Game }), [], []);
assert.strictEqual(game["@type"], "VideoGame");
const music = subjectJsonLd(mockSubject({ type: SubjectType.Music }), [], []);
assert.strictEqual(music["@type"], "MusicAlbum");

const dirtySubject = subjectJsonLd(
  mockSubject({ date: "", eps: 0, rating: { rank: 0, total: 0, score: 0, count: {} } }),
  [],
  [],
);
assert.ok(!("datePublished" in dirtySubject), "empty date must be pruned");
assert.ok(!("numberOfEpisodes" in dirtySubject), "zero eps must be pruned");
assert.ok(!dirtySubject.aggregateRating);

const c: Character = {
  id: 1,
  name: "角色",
  type: 1,
  images: { large: "l", medium: "m", small: "s", grid: "g" },
  summary: "s",
  locked: false,
  stat: { comments: 0, collects: 0 },
};
const cj = characterJsonLd(c, []);
assert.strictEqual(cj["@type"], "FictionalCharacter", "character must not be Person");
assert.ok((cj.sameAs as string[]).includes("https://bgm.tv/character/1"));

const p: PersonDetail = {
  id: 9,
  name: "人物",
  type: 1,
  career: ["seiyu"],
  images: { large: "l", medium: "m", small: "s", grid: "g" },
  summary: "s",
  locked: false,
  stat: { comments: 0, collects: 0 },
};
const pj = personJsonLd(p);
assert.strictEqual(pj["@type"], "Person");
assert.ok((pj.sameAs as string[]).includes("https://bgm.tv/person/9"));

const ep: EpisodeDetail = {
  id: 100,
  type: 0,
  name: "ep",
  name_cn: "",
  sort: 1,
  airdate: "",
  comment: 0,
  duration: "",
  desc: "",
  disc: 0,
  subject_id: 12,
};
const ej = episodeJsonLd(ep);
assert.ok(!("datePublished" in ej), "empty airdate must be pruned");
assert.ok(!("duration" in ej), "empty duration must be pruned");
assert.ok((ej.sameAs as string[]).includes("https://bgm.tv/subject/12"));

const web = websiteJsonLd();
assert.ok(web.publisher, "website must have publisher Organization");
assert.ok((web.publisher as Record<string, unknown>).sameAs);

const crumb = breadcrumbJsonLd("/subjects/12") as Record<string, unknown>;
const items = crumb.itemListElement as Array<Record<string, unknown>>;
assert.ok(items.length >= 2, "breadcrumb for detail page must have >= 2 levels");
assert.strictEqual(items[0].name, "首页");
assert.strictEqual(items[1].name, "条目");

console.log("✓ json-ld self-check passed");
