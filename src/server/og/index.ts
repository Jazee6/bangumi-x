/**
 * OG 渲染管线主入口。串起：
 *   bgmFetch 数据 → 拉封面 → 拼字符串 → 拉字体 → satori → resvg
 *
 * 三档降级：
 *   1. 完整：封面 + 文字
 *   2. 仅文字：封面 fetch 失败时去掉封面节点重试
 *   3. 抛错：satori / resvg 失败 → 由 handler 兜底成 302 og-default.png
 */
import { Resvg } from "@resvg/resvg-wasm";
import satori from "satori/standalone";
import { bgmFetch, BgmHttpError } from "@/server/utils";
import type {
	Character,
	EpisodeDetail,
	PersonDetail,
	RelatedSubject,
	Subject,
} from "@/types";
import { loadCoverDataUri } from "./cover";
import { loadOgFonts } from "./fonts";
import {
	CharacterCard,
	collectCardText,
	EpisodeCard,
	PersonCard,
	SubjectCard,
} from "./template";
import { initOgWasm } from "./wasm";

export type OgType = "subject" | "character" | "person" | "episode";

export interface RenderInput {
	type: OgType;
	id: number;
}

export interface RenderResult {
	svg: string;
	png: Uint8Array;
}

const SATORI_OPTS = { width: 1200, height: 630 } as const;

/**
 * 给定 type/id，返回 SVG 与 PNG。debug=true 时只算到 SVG，跳过 resvg 节省时间。
 */
export async function renderOg(
	input: RenderInput,
	opts: { debug?: boolean } = {},
): Promise<RenderResult> {
	await initOgWasm();

	const card = await buildCard(input);

	// 把所有可能渲染的字符串拼起来给字体子集。
	const text = collectCardText(...card.textParts);
	const fonts = await loadOgFonts(text);

	const svg = await satori(card.element, {
		...SATORI_OPTS,
		fonts,
	});

	if (opts.debug) {
		// 跳过 resvg；返回空 PNG 占位。
		return { svg, png: new Uint8Array() };
	}

	const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
	const png = resvg.render().asPng();
	return { svg, png };
}

// ─── 各类型数据组装 ─────────────────────────────────────

interface BuiltCard {
	element: import("react").ReactElement;
	textParts: Array<string | undefined>;
}

async function buildCard(input: RenderInput): Promise<BuiltCard> {
	switch (input.type) {
		case "subject":
			return buildSubjectCard(input.id);
		case "character":
			return buildCharacterCard(input.id);
		case "person":
			return buildPersonCard(input.id);
		case "episode":
			return buildEpisodeCard(input.id);
		default: {
			const _exhaustive: never = input.type;
			throw new Error(`unknown og type: ${_exhaustive as string}`);
		}
	}
}

async function buildSubjectCard(id: number): Promise<BuiltCard> {
	const subject = await fetch404<Subject>(`/v0/subjects/${id}`);
	const coverUrl =
		subject.images?.large || subject.images?.common || subject.images?.medium;
	const cover = coverUrl ? await tryLoadCover(coverUrl) : undefined;
	return {
		element: SubjectCard({ subject, cover }),
		textParts: [
			subject.name,
			subject.name_cn,
			subject.platform,
			subject.summary,
			subject.date,
		],
	};
}

async function buildCharacterCard(id: number): Promise<BuiltCard> {
	const [character, subjects] = await Promise.all([
		fetch404<Character>(`/v0/characters/${id}`),
		bgmFetch<RelatedSubject[]>(`/v0/characters/${id}/subjects`, {
			cacheTtl: 600,
		}).catch(() => [] as RelatedSubject[]),
	]);
	const coverUrl = character.images?.large || character.images?.medium;
	const cover = coverUrl ? await tryLoadCover(coverUrl) : undefined;
	return {
		element: CharacterCard({ character, cover, subjects }),
		textParts: [
			character.name,
			character.summary,
			...subjects.slice(0, 2).flatMap((s) => [s.name, s.name_cn]),
		],
	};
}

async function buildPersonCard(id: number): Promise<BuiltCard> {
	const [person, subjects] = await Promise.all([
		fetch404<PersonDetail>(`/v0/persons/${id}`),
		bgmFetch<RelatedSubject[]>(`/v0/persons/${id}/subjects`, {
			cacheTtl: 600,
		}).catch(() => [] as RelatedSubject[]),
	]);
	const coverUrl = person.images?.large || person.images?.medium;
	const cover = coverUrl ? await tryLoadCover(coverUrl) : undefined;
	return {
		element: PersonCard({ person, cover, subjects }),
		textParts: [
			person.name,
			person.summary,
			...subjects.slice(0, 2).flatMap((s) => [s.name, s.name_cn]),
		],
	};
}

async function buildEpisodeCard(id: number): Promise<BuiltCard> {
	const episode = await fetch404<EpisodeDetail>(`/v0/episodes/${id}`);
	let subject: Subject | null = null;
	try {
		subject = await fetch404<Subject>(`/v0/subjects/${episode.subject_id}`);
	} catch {
		subject = null;
	}
	const coverUrl =
		subject?.images?.large || subject?.images?.common || subject?.images?.medium;
	const cover = coverUrl ? await tryLoadCover(coverUrl) : undefined;
	return {
		element: EpisodeCard({ episode, subject, cover }),
		textParts: [
			episode.name,
			episode.name_cn,
			episode.desc,
			episode.airdate,
			episode.duration,
			subject?.name,
			subject?.name_cn,
		],
	};
}

// ─── helpers ────────────────────────────────────────────

/**
 * 上游 404 时抛 NotFoundError 让 handler 区分（404 → 上游真没这条目，
 * 兜底为 302）。其他错误向上抛。
 */
async function fetch404<T>(path: string): Promise<T> {
	try {
		return await bgmFetch<T>(path, { cacheTtl: 3600 });
	} catch (err) {
		if (err instanceof BgmHttpError && err.status === 404) {
			throw new NotFoundError(path);
		}
		throw err;
	}
}

export class NotFoundError extends Error {
	constructor(path: string) {
		super(`og resource not found: ${path}`);
		this.name = "NotFoundError";
	}
}

async function tryLoadCover(url: string): Promise<string | undefined> {
	try {
		return await loadCoverDataUri(url);
	} catch (err) {
		console.warn("[og] cover load failed, falling back to text-only", err);
		return undefined;
	}
}
