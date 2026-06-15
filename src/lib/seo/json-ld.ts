/**
 * JSON-LD（schema.org）结构化数据构造器。
 *
 * 设计原则：
 * - 只输出有数据的字段，避免 Google Rich Result Test 扫到空字段。
 * - 详情页 `@id` 使用 fragment（`#tvseries`、`#person`）便于多类型聚合。
 * - 把生成的对象交给 <script type="application/ld+json"> 渲染时统一 JSON.stringify。
 */

import type {
	Character,
	EpisodeDetail,
	PersonDetail,
	RelatedSubject,
	Subject,
} from "@/types";
import { SubjectType } from "@/types";
import { absoluteUrl, clampText, SITE_NAME, SITE_URL } from "./site";

type JsonLD = Record<string, unknown>;

/** 站点级 WebSite + SearchAction（出现在首页）。 */
export function websiteJsonLd(): JsonLD {
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		"@id": `${SITE_URL}/#website`,
		name: SITE_NAME,
		alternateName: ["Bangumi X", "番组计划镜像"],
		url: SITE_URL,
		inLanguage: "zh-Hans",
		description:
			"Bangumi 番组计划数据浏览站点，提供番剧、漫画、游戏、音乐条目检索与角色人物资料。",
		potentialAction: {
			"@type": "SearchAction",
			target: {
				"@type": "EntryPoint",
				urlTemplate: `${SITE_URL}/subjects?keyword={search_term_string}`,
			},
			"query-input": "required name=search_term_string",
		},
	};
}

export interface BreadcrumbItem {
	name: string;
	path: string;
}

/** 通用面包屑。 */
export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLD {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((it, i) => ({
			"@type": "ListItem",
			position: i + 1,
			name: it.name,
			item: absoluteUrl(it.path),
		})),
	};
}

/** 把 Subject 转为对应的 schema.org 类型字符串。 */
function schemaTypeForSubject(type: SubjectType): {
	type: string;
	additionalType?: string;
} {
	switch (type) {
		case SubjectType.Anime:
			return { type: "TVSeries" };
		case SubjectType.Book:
			return { type: "Book" };
		case SubjectType.Music:
			return { type: "MusicAlbum" };
		case SubjectType.Game:
			return { type: "VideoGame" };
		case SubjectType.Real:
			return { type: "TVSeries" };
		default:
			return { type: "CreativeWork" };
	}
}

/** 把 Subject 转为对应的 Open Graph type，与 schema.org @type 保持一致。 */
export function ogTypeForSubject(type: SubjectType): string {
	switch (type) {
		case SubjectType.Anime:
		case SubjectType.Real:
			return "video.tv_show";
		case SubjectType.Book:
			return "book";
		case SubjectType.Music:
			return "music.album";
		case SubjectType.Game:
			return "video.game";
		default:
			return "article";
	}
}

/** 详情页：番剧/书/游戏/音乐/三次元。 */
export function subjectJsonLd(subject: Subject): JsonLD {
	const path = `/subjects/${subject.id}`;
	const { type } = schemaTypeForSubject(subject.type);
	const image =
		subject.images?.large ||
		subject.images?.common ||
		subject.images?.medium ||
		undefined;

	const base: JsonLD = {
		"@context": "https://schema.org",
		"@type": type,
		"@id": `${absoluteUrl(path)}#${type.toLowerCase()}`,
		url: absoluteUrl(path),
		name: subject.name_cn || subject.name,
		inLanguage: "zh-Hans",
	};

	if (subject.name_cn && subject.name && subject.name_cn !== subject.name) {
		base.alternateName = [subject.name];
	}
	if (subject.summary) base.description = clampText(subject.summary, 500);
	if (image) base.image = image;
	if (subject.date) base.datePublished = subject.date;
	if (subject.platform) base.genre = subject.platform;
	if (subject.tags?.length) {
		base.keywords = subject.tags
			.slice(0, 12)
			.map((t) => t.name)
			.join(",");
	}

	if (subject.eps && subject.eps > 0 && type === "TVSeries") {
		base.numberOfEpisodes = subject.eps;
	}

	if (subject.rating?.score && subject.rating.total > 0) {
		base.aggregateRating = {
			"@type": "AggregateRating",
			ratingValue: subject.rating.score,
			ratingCount: subject.rating.total,
			bestRating: 10,
			worstRating: 1,
		};
	}

	return base;
}

/** 单集页 TVEpisode。需要 subject 上下文（可由 episode.subject_id 补一个 partOfSeries 引用）。 */
export function episodeJsonLd(
	episode: EpisodeDetail,
	subjectName?: string,
): JsonLD {
	const path = `/episodes/${episode.id}`;
	const subjectPath = `/subjects/${episode.subject_id}`;

	const base: JsonLD = {
		"@context": "https://schema.org",
		"@type": "TVEpisode",
		"@id": `${absoluteUrl(path)}#tvepisode`,
		url: absoluteUrl(path),
		name: episode.name_cn || episode.name || `第 ${episode.sort} 话`,
		episodeNumber: episode.sort,
		inLanguage: "zh-Hans",
		partOfSeries: {
			"@type": "TVSeries",
			"@id": `${absoluteUrl(subjectPath)}#tvseries`,
			url: absoluteUrl(subjectPath),
			...(subjectName ? { name: subjectName } : {}),
		},
	};

	if (episode.name && episode.name !== episode.name_cn) {
		base.alternateName = [episode.name];
	}
	if (episode.desc) base.description = clampText(episode.desc, 500);
	if (episode.airdate) base.datePublished = episode.airdate;
	if (episode.duration) base.duration = episode.duration;

	return base;
}

/** 角色页：Person + additionalType=FictionalCharacter（这是 Google 最能识别的写法）。 */
export function characterJsonLd(character: Character): JsonLD {
	const path = `/characters/${character.id}`;
	const image = character.images?.large || character.images?.medium;

	const base: JsonLD = {
		"@context": "https://schema.org",
		"@type": "Person",
		additionalType: "https://schema.org/FictionalCharacter",
		"@id": `${absoluteUrl(path)}#character`,
		url: absoluteUrl(path),
		name: character.name,
		inLanguage: "zh-Hans",
	};

	if (character.summary) base.description = clampText(character.summary, 500);
	if (image) base.image = image;
	if (character.gender) base.gender = character.gender;
	if (character.birth_year || character.birth_mon || character.birth_day) {
		const y = character.birth_year ?? "";
		const m = character.birth_mon
			? String(character.birth_mon).padStart(2, "0")
			: "01";
		const d = character.birth_day
			? String(character.birth_day).padStart(2, "0")
			: "01";
		if (y) base.birthDate = `${y}-${m}-${d}`;
	}

	return base;
}

/** 人物（声优、制作人等）。 */
export function personJsonLd(person: PersonDetail): JsonLD {
	const path = `/persons/${person.id}`;
	const image = person.images?.large || person.images?.medium;

	const base: JsonLD = {
		"@context": "https://schema.org",
		"@type": "Person",
		"@id": `${absoluteUrl(path)}#person`,
		url: absoluteUrl(path),
		name: person.name,
		inLanguage: "zh-Hans",
	};

	if (person.summary) base.description = clampText(person.summary, 500);
	if (image) base.image = image;
	if (person.gender) base.gender = person.gender;
	if (person.career?.length) {
		base.jobTitle = person.career.join(",");
	}
	if (person.birth_year) {
		const m = person.birth_mon
			? String(person.birth_mon).padStart(2, "0")
			: "01";
		const d = person.birth_day
			? String(person.birth_day).padStart(2, "0")
			: "01";
		base.birthDate = `${person.birth_year}-${m}-${d}`;
	}

	return base;
}

/** 把 RelatedSubject 数组转为 ItemList，作为补充结构化数据嵌在角色/人物详情页里。 */
export function relatedSubjectsItemList(
	subjects: RelatedSubject[],
	limit = 20,
): JsonLD | null {
	if (!subjects?.length) return null;
	return {
		"@context": "https://schema.org",
		"@type": "ItemList",
		itemListElement: subjects.slice(0, limit).map((s, i) => ({
			"@type": "ListItem",
			position: i + 1,
			url: absoluteUrl(`/subjects/${s.id}`),
			name: s.name_cn || s.name,
		})),
	};
}

/** 包装为 TanStack Router 能识别的 `<script type="application/ld+json">` scripts 项。 */
export function serializeJsonLd(data: JsonLD | JsonLD[]): {
	scripts: { type: "application/ld+json"; children: string }[];
} {
	return {
		scripts: [
			{
				type: "application/ld+json",
				children: JSON.stringify(Array.isArray(data) ? data : data),
			},
		],
	};
}
