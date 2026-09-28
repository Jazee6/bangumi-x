export type ApiErrorCode =
  | "INVALID_IMAGE_URL"
  | "INVALID_OG_QUERY"
  | "BANGUMI_UPSTREAM_ERROR"
  | "IMAGE_UPSTREAM_ERROR"
  | "UPSTREAM_RATE_LIMITED"
  | "NOT_FOUND"
  | "INTERNAL_SERVER_ERROR"
  | "INVALID_SUBJECT_ID"
  | "SUBJECT_NOT_FOUND"
  | "SUBJECT_UPSTREAM_ERROR"
  | "INVALID_CHAPTER_ID"
  | "INVALID_PAGINATION"
  | "CHAPTER_NOT_FOUND"
  | "CHAPTER_UPSTREAM_ERROR"
  | "INVALID_PERSON_ID"
  | "PERSON_NOT_FOUND"
  | "PERSON_UPSTREAM_ERROR"
  | "INVALID_CHARACTER_ID"
  | "CHARACTER_NOT_FOUND"
  | "CHARACTER_UPSTREAM_ERROR"
  | "INVALID_DISCOVERY_QUERY"
  | "DISCOVERY_UPSTREAM_ERROR"
  | "INVALID_RANKINGS_QUERY"
  | "RANKINGS_UPSTREAM_ERROR"
  | "AUTH_UNAVAILABLE"
  | "UNAUTHORIZED"
  | "INVALID_ORIGIN"
  | "INVALID_RETURN_TARGET"
  | "INVALID_COLLECTION_QUERY"
  | "INVALID_COLLECTION_LIST"
  | "DUPLICATE_COLLECTION_LIST"
  | "COLLECTION_LIST_NOT_FOUND"
  | "PUBLIC_COLLECTION_LIST_NOT_FOUND"
  | "INVALID_PROGRESS"
  | "INVALID_PROGRESS_QUERY"
  | "COLLECTION_SNAPSHOT_UNAVAILABLE"
  | "INVALID_DIRECTORY_QUERY"
  | "MINI_AUTH_UNAVAILABLE"
  | "INVALID_WECHAT_LOGIN"
  | "INVALID_MINI_PROFILE"
  | "MINI_PROFILE_RATE_LIMITED"
  | "MINI_PROFILE_REVIEW_FAILED"
  | "MINI_ACCOUNT_LINK_NOT_FOUND"
  | "MINI_ACCOUNT_LINK_EXPIRED"
  | "MINI_ACCOUNT_LINK_CONFLICT"
  | "MINI_ACCOUNT_LINK_CHANGED"
  | "MINI_ACCOUNT_LINK_RATE_LIMITED";

export interface ApiErrorResponse {
  code: ApiErrorCode;
  message: string;
  retryable: boolean;
}

export const CANONICAL_WEB_ORIGIN = "https://bgmx.jaze.top";

export type PublicationState = "index" | "noindex-follow" | "noindex-nofollow" | "not-found";

export interface PublicationDecision {
  state: PublicationState;
  reason: string;
}

export const PUBLICATION = {
  index: (reason: string): PublicationDecision => ({ state: "index", reason }),
  noindexFollow: (reason: string): PublicationDecision => ({ state: "noindex-follow", reason }),
  noindexNofollow: (reason: string): PublicationDecision => ({
    state: "noindex-nofollow",
    reason,
  }),
  notFound: (reason: string): PublicationDecision => ({ state: "not-found", reason }),
};

export function getRobotsDirective(decision: PublicationDecision): string {
  return decision.state === "index"
    ? "index, follow"
    : decision.state === "noindex-follow"
      ? "noindex, follow"
      : "noindex, nofollow";
}

export type DirectoryResourceType =
  | "subject"
  | "chapter"
  | "character"
  | "person"
  | "collection_list"
  | "ranking";
export type DirectoryDiscoverySource =
  | "daily_broadcast"
  | "annual_popular"
  | "rankings"
  | "relation"
  | "direct_access"
  | "collection_list";
export type DirectoryIndexStatus = "pending" | "index" | "noindex";

export interface DirectoryItemSummary {
  externalId: string;
  lastVerifiedAt: string | null;
  firstDiscoveredAt: string;
}

export interface DirectoryQueryResponse {
  resourceType: DirectoryResourceType;
  entries: DirectoryItemSummary[];
  nextCursor: string | null;
}

export function isIndexableSubject(subject: { nsfw: boolean; title?: string | null }): boolean {
  if (subject.nsfw) return false;
  const title = subject.title?.trim();
  if (!title || title === "未命名条目") return false;
  return true;
}

export function isIndexableChapter(
  chapter: {
    summary?: string | null;
    date?: string | null;
    title?: string | null;
  },
  parentSubject?: { nsfw: boolean },
): boolean {
  if (parentSubject?.nsfw) return false;
  const title = chapter.title?.trim();
  if (!title || title === "未命名章节") return false;
  return Boolean(chapter.summary?.trim() || chapter.date?.trim());
}

export function isIndexableCharacter(character: {
  summary?: string | null;
  name?: string | null;
  hasSubjectRelation?: boolean;
}): boolean {
  const name = character.name?.trim();
  if (!name || name === "未命名角色") return false;
  return Boolean(character.summary?.trim() || character.hasSubjectRelation);
}

export function isIndexablePerson(person: {
  summary?: string | null;
  name?: string | null;
  hasSubjectRelation?: boolean;
}): boolean {
  const name = person.name?.trim();
  if (!name || name === "未命名人物") return false;
  return Boolean(person.summary?.trim() || person.hasSubjectRelation);
}

export function isIndexableCollectionList(list: { total: number; name?: string | null }): boolean {
  const name = list.name?.trim();
  if (!name || name === "未命名列表") return false;
  return list.total >= 3;
}

export function isIndexableRanking(
  ranking: {
    itemCount: number;
    year: number;
    season: Season;
  },
  now: Date = new Date(),
): boolean {
  if (ranking.itemCount <= 0) return false;
  if (ranking.year < RANKINGS_MIN_YEAR) return false;
  if (isFutureSeason(ranking.year, ranking.season, now)) return false;
  return true;
}

export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WEEKDAY_SLUGS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type WeekdaySlug = (typeof WEEKDAY_SLUGS)[number];
export const WEEKDAY_BY_SLUG: Record<WeekdaySlug, IsoWeekday> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};
export const WEEKDAY_SLUG_BY_ISO: Record<IsoWeekday, WeekdaySlug> = {
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
  7: "sunday",
};
export const WEEKDAY_LABELS: Record<IsoWeekday, string> = {
  1: "星期一",
  2: "星期二",
  3: "星期三",
  4: "星期四",
  5: "星期五",
  6: "星期六",
  7: "星期日",
};

export interface ScheduleItem {
  id: number;
  title: string;
  imageUrl: string | null;
  score: number | null;
}

export interface ScheduleDay {
  weekday: IsoWeekday;
  items: ScheduleItem[];
}

export interface ScheduleResponse {
  days: ScheduleDay[];
  fetchedAt?: string;
}

export interface SourceMetadata {
  url: string;
  fetchedAt: string;
}

export type ChapterType = "本篇" | "特别篇" | "OP" | "ED" | "PV" | "MAD" | "其他";

export interface ChapterSummary {
  id: number;
  type: ChapterType;
  sequence: number | null;
  title: string;
  date: string | null;
  duration: string | null;
}

export interface ChapterPage {
  total: number;
  limit: number;
  offset: number;
  data: ChapterSummary[];
  fetchedAt?: string;
}

export interface BroadcastChapter {
  sequence: number;
  date: string;
}

export interface SubjectBroadcast {
  chapters: BroadcastChapter[];
  completeAfter: string | null;
}

export type BroadcastDisplay =
  | {
      kind: "upcoming";
      date: string;
      detailText: string;
      progressText: string;
    }
  | {
      kind: "completed";
      date: string;
      detailText: "已完结";
      progressText: "已完结";
    };

function dateValue(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function formatSequences(sequences: number[]): string {
  const sorted = [...new Set(sequences)].sort((left, right) => left - right);
  if (sorted.length === 1) return `${sorted[0]}`;
  const consecutiveIntegers = sorted.every(
    (sequence, index) =>
      Number.isInteger(sequence) && (index === 0 || sequence === (sorted[index - 1] ?? 0) + 1),
  );
  return consecutiveIntegers ? `${sorted[0]}–${sorted[sorted.length - 1]}` : sorted.join("、");
}

// today 为用户本地日期（YYYY-MM-DD）。
export function getBroadcastDisplay(
  broadcast: SubjectBroadcast | null,
  today: string | null,
): BroadcastDisplay | null {
  if (!broadcast || !today) return null;

  const nextDate = broadcast.chapters
    .filter((chapter) => chapter.date >= today)
    .map((chapter) => chapter.date)
    .sort()[0];
  if (nextDate) {
    const sequence = formatSequences(
      broadcast.chapters
        .filter((chapter) => chapter.date === nextDate)
        .map((chapter) => chapter.sequence),
    );
    const days = Math.round((dateValue(nextDate) - dateValue(today)) / 86_400_000);
    const relative = days === 0 ? "今天" : days === 1 ? "明天" : `${days} 天后`;
    return {
      kind: "upcoming",
      date: nextDate,
      detailText: `${relative} · 第 ${sequence} 话`,
      progressText: `${relative}播放第 ${sequence} 话`,
    };
  }

  if (broadcast.completeAfter && broadcast.completeAfter < today) {
    return {
      kind: "completed",
      date: broadcast.completeAfter,
      detailText: "已完结",
      progressText: "已完结",
    };
  }

  return null;
}

export interface ChapterSubject {
  id: number;
  title: string;
  type: SubjectType;
  nsfw: boolean;
  imageUrl: string | null;
}

export interface ChapterDetail extends ChapterSummary {
  subject: ChapterSubject;
  summary: string | null;
  fetchedAt?: string;
}

export interface SubjectDetail {
  id: number;
  title: string;
  type: SubjectType;
  originalTitle: string | null;
  platform: string | null;
  date: string | null;
  totalChapters: number | null;
  score: number | null;
  rank: number | null;
  scoreCount: number | null;
  nsfw: boolean;
  summary: string | null;
  tags: string[];
  imageUrl: string | null;
  broadcast: SubjectBroadcast | null;
  fetchedAt?: string;
}

export type PersonType = "个人" | "公司" | "组合";
export type CharacterType = "角色" | "机体" | "舰船" | "组织";
export type SubjectType = "书籍" | "动画" | "音乐" | "游戏" | "三次元" | "其他";

export const SUBJECT_TYPE_FILTER_VALUES = ["anime", "book", "game", "music", "real"] as const;
export type SubjectTypeFilter = (typeof SUBJECT_TYPE_FILTER_VALUES)[number];
export const SUBJECT_TYPE_FILTER_LABELS: Record<SubjectTypeFilter, string> = {
  anime: "动画",
  book: "书籍",
  game: "游戏",
  music: "音乐",
  real: "三次元",
};
export const SEARCH_KEYWORD_MAX_LENGTH = 64;
export const COLLECTION_LIST_NAME_MAX_LENGTH = 50;

export function isValidCollectionListName(name: string): boolean {
  const length = Array.from(name.trim()).length;
  return length >= 1 && length <= COLLECTION_LIST_NAME_MAX_LENGTH;
}

// 音乐与其他条目不记录进度；动画与三次元进度还可包含已完成章节数。
export function supportsProgress(type: SubjectType): boolean {
  return type !== "音乐" && type !== "其他";
}

export function supportsChapterProgress(type: SubjectType): boolean {
  return type === "动画" || type === "三次元";
}

export const DISCOVERY_PAGE_SIZE = 24;
export const RANKINGS_PAGE_SIZE = 24;
export const COLLECTION_PAGE_SIZE = 24;
export const RANKINGS_MIN_YEAR = 1980;
export const RANKINGS_MAX_ITEMS = 50;
export const SEASON_VALUES = ["winter", "spring", "summer", "autumn"] as const;
export type Season = (typeof SEASON_VALUES)[number];
export const SEASON_LABELS: Record<Season, string> = {
  winter: "冬季",
  spring: "春季",
  summer: "夏季",
  autumn: "秋季",
};
export const SEASON_MONTHS: Record<Season, readonly [number, number, number]> = {
  winter: [1, 2, 3],
  spring: [4, 5, 6],
  summer: [7, 8, 9],
  autumn: [10, 11, 12],
};

export function getSeasonForMonth(month: number): Season {
  if (month <= 3) return "winter";
  if (month <= 6) return "spring";
  if (month <= 9) return "summer";
  return "autumn";
}

// 本年度与当前季度按中国标准时间判定；中国不实行夏令时，固定偏移即可，也不依赖运行时的 Intl 时区数据。
const CHINA_STANDARD_TIME_OFFSET_MS = 8 * 3_600_000;

function toChinaStandardTime(now: Date): Date {
  return new Date(now.getTime() + CHINA_STANDARD_TIME_OFFSET_MS);
}

export function getCurrentYear(now: Date = new Date()): number {
  return toChinaStandardTime(now).getUTCFullYear();
}

export function getCurrentSeason(now: Date = new Date()): Season {
  return getSeasonForMonth(toChinaStandardTime(now).getUTCMonth() + 1);
}

export function isFutureSeason(year: number, season: Season, now: Date = new Date()): boolean {
  const currentYear = getCurrentYear(now);
  if (year > currentYear) return true;
  if (year < currentYear) return false;
  return SEASON_VALUES.indexOf(season) > SEASON_VALUES.indexOf(getCurrentSeason(now));
}

export interface SubjectSummary {
  id: number;
  title: string;
  type: Exclude<SubjectType, "其他">;
  imageUrl: string | null;
  score: number | null;
  rank: number | null;
  nsfw: boolean;
}

export interface Page<T> {
  page: number;
  pageSize: number;
  data: T[];
  hasPrevious: boolean;
  hasNext: boolean;
  total?: number;
  fetchedAt?: string;
}

export type SubjectPage = Page<SubjectSummary>;
export type RankingsPage = Page<SubjectSummary>;

export interface SessionSummary {
  user: {
    name: string;
    image: string | null;
  };
}

export interface MiniIdentityUser {
  name: string;
  image: string | null;
  editable: boolean;
  avatarReviewPending: boolean;
}

export interface MiniIdentitySession {
  token: string;
  expiresAt: string;
  user: MiniIdentityUser;
}

export interface MiniIdentityStatus {
  available: boolean;
  user: MiniIdentityUser | null;
}

export type MiniAccountLinkState =
  | "awaiting_source"
  | "awaiting_confirmation"
  | "complete"
  | "failed";

export interface MiniAccountLinkCredential {
  token: string;
  qrPayload: string;
  shortCode: string;
  expiresAt: string;
}

export interface MiniAccountLinkCounts {
  collections: number;
  progress: number;
  lists: number;
}

export interface MiniAccountLinkParty extends MiniAccountLinkCounts {
  name: string;
  image: string | null;
}

export interface MiniAccountLinkPreview {
  state: "awaiting_confirmation";
  source: MiniAccountLinkParty;
  target: MiniAccountLinkParty;
  previewVersion: string;
  expiresAt: string;
}

export interface MiniAccountLinkClaim {
  claimToken: string;
  preview: MiniAccountLinkPreview;
}

export interface MiniAccountLinkWebStatus {
  state: MiniAccountLinkState;
  expiresAt: string;
}

export interface MiniAccountLinkResult {
  state: "awaiting_confirmation" | "complete" | "failed";
  sessionToken?: string;
  expiresAt?: string;
  user?: MiniIdentityUser;
  message?: string;
}

export const PROGRESS_STAGE_VALUES = ["in_progress", "completed"] as const;
export type ProgressStage = (typeof PROGRESS_STAGE_VALUES)[number];

export interface SubjectProgress {
  stage: ProgressStage;
  completedChapters: number | null;
  totalChapters: number | null;
  updatedAt: string;
}

export interface ProgressItem {
  id: number;
  title: string;
  type: SubjectType;
  imageUrl: string | null;
  nsfw: boolean;
  stage: ProgressStage;
  completedChapters: number | null;
  totalChapters: number | null;
  progressUpdatedAt: string;
  collected: boolean;
  broadcast: SubjectBroadcast | null;
}

export type ProgressPage = Page<ProgressItem>;
export type CollectionPage = Page<CollectionItem>;

export interface CollectionItem {
  id: number;
  title: string;
  type: SubjectType;
  imageUrl: string | null;
  nsfw: boolean;
  collectedAt: string;
  progress: SubjectProgress | null;
}

export interface PersonalSubjectState {
  collected: boolean;
  listIds: string[];
  progress: SubjectProgress | null;
}

export interface CollectionList {
  id: string;
  name: string;
  isPublic: boolean;
  shareId: string;
  createdAt: string;
  updatedAt: string;
  count?: number;
}

export interface PersonalRecordCounts {
  collections: {
    all: number;
    unlisted: number;
  };
  progress: {
    all: number;
    in_progress: number;
    completed: number;
  };
}

export interface PublicCollectionListItem {
  id: number;
  title: string;
  type: SubjectType;
  imageUrl: string | null;
  nsfw: boolean;
}

export interface PublicCollectionListPage extends Page<PublicCollectionListItem> {
  name: string;
  ownerName: string;
  total: number;
  updatedAt: string;
}

const AUTH_RETURN_PATHS = [
  /^\/$/,
  /^\/collections$/,
  /^\/progress$/,
  /^\/subjects\/\d+(\/(chapters|characters|persons))?$/,
  /^\/chapters\/\d+$/,
  /^\/characters\/\d+$/,
  /^\/persons\/\d+$/,
];

export function isAllowedAuthReturnPath(pathname: string): boolean {
  return AUTH_RETURN_PATHS.some((pattern) => pattern.test(pathname));
}

export interface DiscoveryCharacterSummary {
  id: number;
  name: string;
  type: CharacterType;
  imageUrl: string | null;
  summary: string | null;
}

export interface DiscoveryPersonSummary {
  id: number;
  name: string;
  type: PersonType;
  careers: string[];
  imageUrl: string | null;
  summary: string | null;
}

export type CharacterPage = Page<DiscoveryCharacterSummary>;
export type PersonPage = Page<DiscoveryPersonSummary>;

export interface RelationGroup<T> {
  relation: string;
  items: T[];
}

export interface GroupedResponse<T> {
  total: number;
  groups: RelationGroup<T>[];
  fetchedAt?: string;
}

export interface PersonSummary {
  id: number;
  name: string;
  type: PersonType;
  careers: string[];
  chapters: string | null;
  imageUrl: string | null;
}

export interface PersonLink {
  id: number;
  name: string;
  type: PersonType;
}

export interface PersonDetail {
  id: number;
  name: string;
  type: PersonType;
  careers: string[];
  gender: string | null;
  birthday: string | null;
  bloodType: string | null;
  summary: string | null;
  imageUrl: string | null;
  fetchedAt?: string;
}

export interface CharacterSummary {
  id: number;
  name: string;
  type: CharacterType;
  imageUrl: string | null;
  actors: PersonLink[];
}

export interface CharacterDetail {
  id: number;
  name: string;
  type: CharacterType;
  gender: string | null;
  birthday: string | null;
  bloodType: string | null;
  summary: string | null;
  imageUrl: string | null;
  fetchedAt?: string;
}

export interface RelatedSubject {
  id: number;
  title: string;
  type: SubjectType;
  relation: string;
  chapters: string | null;
  imageUrl: string | null;
}

export interface SubjectContext {
  id: number;
  title: string;
  type: SubjectType;
}

export interface RelatedPerson {
  id: number;
  name: string;
  type: PersonType;
  relation: string;
  imageUrl: string | null;
  subject: SubjectContext;
}

export interface RelatedCharacter {
  id: number;
  name: string;
  type: CharacterType;
  relation: string;
  imageUrl: string | null;
  subject: SubjectContext;
}

export type SubjectPersonsResponse = GroupedResponse<PersonSummary>;
export type SubjectCharactersResponse = GroupedResponse<CharacterSummary>;
export type RelatedSubjectsResponse = GroupedResponse<RelatedSubject>;
export type RelatedPersonsResponse = GroupedResponse<RelatedPerson>;
export type RelatedCharactersResponse = GroupedResponse<RelatedCharacter>;
