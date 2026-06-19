/**
 * OG 卡片 JSX 模板。返回 React element 直接喂 satori。
 *
 * 注意 satori 的 CSS 限制：只支持 flex/绝对像素/纯色背景/borderRadius/box-shadow，
 * 不支持 grid / filter / position:sticky / transform 链等；color/font 必须是平铺值。
 *
 * 布局：1200×630，左封面（360×504, 5:7 与封面比例最接近）右信息栏。
 */
import type { ReactElement } from "react";
import {
	BloodTypeLabel,
	CareerLabel,
	type Character,
	type EpisodeDetail,
	type PersonDetail,
	type RelatedSubject,
	type Subject,
	SubjectType,
	SubjectTypeLabel,
} from "@/types";

const W = 1200;
const H = 630;
const PAD = 60;
const COVER_W = 360;
const COVER_H = 504;

// 配色：dark mode 风的品牌色卡。和站点 dark theme 接近。
const BG = "#0F1115";
const FG = "#F5F5F4";
const FG_MUTED = "#A1A1AA";
const ACCENT = "#FF7F50"; // bangumi 站常见的橙色
const CHIP_BG = "#1F2228";
const CHIP_FG = "#E5E5E5";

const FONT_STACK = '"Noto Sans SC", "Noto Sans JP", sans-serif';

interface Frame {
	cover?: string; // base64 data URI; undefined 时降级
	titleMain: string;
	titleSub?: string;
	chips: string[];
	subline?: string;
	summary?: string;
}

function FrameView({
	cover,
	titleMain,
	titleSub,
	chips,
	subline,
	summary,
}: Frame): ReactElement {
	return (
		<div
			style={{
				width: W,
				height: H,
				display: "flex",
				flexDirection: "column",
				backgroundColor: BG,
				color: FG,
				fontFamily: FONT_STACK,
				padding: PAD,
				position: "relative",
			}}
		>
			{/* 顶部主体：封面 + 信息 */}
			<div style={{ display: "flex", flex: 1, gap: 48 }}>
				{cover ? (
					// biome-ignore lint/a11y/useAltText: satori 渲染至 SVG 不需要 a11y alt
					<img
						src={cover}
						width={COVER_W}
						height={COVER_H}
						style={{
							width: COVER_W,
							height: COVER_H,
							borderRadius: 16,
							objectFit: "cover",
							flexShrink: 0,
						}}
					/>
				) : (
					<div
						style={{
							width: COVER_W,
							height: COVER_H,
							borderRadius: 16,
							backgroundColor: CHIP_BG,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: FG_MUTED,
							fontSize: 40,
							flexShrink: 0,
						}}
					>
						bangumi-x
					</div>
				)}

				<div
					style={{
						flex: 1,
						display: "flex",
						flexDirection: "column",
						minWidth: 0,
					}}
				>
					<div
						style={{
							fontSize: 56,
							fontWeight: 700,
							lineHeight: 1.15,
							color: FG,
							// satori 不支持 -webkit-line-clamp，用上限高度 + overflow:hidden 模拟。
							maxHeight: 56 * 1.15 * 2,
							overflow: "hidden",
							display: "flex",
						}}
					>
						{titleMain}
					</div>
					{titleSub && (
						<div
							style={{
								marginTop: 8,
								fontSize: 26,
								color: FG_MUTED,
								maxHeight: 26 * 1.3,
								overflow: "hidden",
								display: "flex",
							}}
						>
							{titleSub}
						</div>
					)}

					<div
						style={{
							marginTop: 24,
							display: "flex",
							flexWrap: "wrap",
							gap: 10,
						}}
					>
						{chips.map((chip) => (
							<div
								key={chip}
								style={{
									fontSize: 22,
									color: CHIP_FG,
									backgroundColor: CHIP_BG,
									borderRadius: 999,
									padding: "6px 16px",
									display: "flex",
								}}
							>
								{chip}
							</div>
						))}
					</div>

					{subline && (
						<div
							style={{
								marginTop: 18,
								fontSize: 22,
								color: FG_MUTED,
								maxHeight: 22 * 1.4,
								overflow: "hidden",
								display: "flex",
							}}
						>
							{subline}
						</div>
					)}

					{summary && (
						<div
							style={{
								marginTop: 18,
								fontSize: 20,
								color: FG_MUTED,
								lineHeight: 1.5,
								maxHeight: 20 * 1.5 * 3,
								overflow: "hidden",
								display: "flex",
							}}
						>
							{summary}
						</div>
					)}
				</div>
			</div>

			{/* 底部品牌脚标 */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					fontSize: 22,
					color: FG_MUTED,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
					<div
						style={{
							width: 12,
							height: 12,
							borderRadius: 999,
							backgroundColor: ACCENT,
						}}
					/>
					<div style={{ color: FG, fontWeight: 700, fontSize: 24 }}>
						Bangumi X
					</div>
					<div style={{ color: FG_MUTED }}>· bgmx.jaze.top</div>
				</div>
			</div>
		</div>
	);
}

// ─── 各类型卡片 ─────────────────────────────────────────

export function SubjectCard({
	subject,
	cover,
}: {
	subject: Subject;
	cover?: string;
}): ReactElement {
	const titleMain = subject.name_cn || subject.name;
	const titleSub =
		subject.name && subject.name !== titleMain ? subject.name : undefined;

	const chips: string[] = [];
	if (subject.rating?.score && subject.rating.total > 0) {
		chips.push(`★ ${subject.rating.score.toFixed(1)}`);
	}
	const typeLabel = SubjectTypeLabel[subject.type];
	if (typeLabel) chips.push(typeLabel);
	if (subject.eps && subject.eps > 0) chips.push(`${subject.eps} 话`);
	if (subject.date) chips.push(subject.date);
	if (subject.platform && subject.type !== SubjectType.Real) {
		chips.push(subject.platform);
	}

	const summary = clamp(subject.summary, 110);

	return (
		<FrameView
			cover={cover}
			titleMain={titleMain}
			titleSub={titleSub}
			chips={chips}
			summary={summary}
		/>
	);
}

export function CharacterCard({
	character,
	cover,
	subjects,
}: {
	character: Character;
	cover?: string;
	subjects: RelatedSubject[];
}): ReactElement {
	const chips: string[] = [];
	if (character.gender) chips.push(character.gender);
	if (character.blood_type) {
		chips.push(`${BloodTypeLabel[character.blood_type] ?? ""}型`);
	}
	const birth = formatBirth(
		character.birth_year,
		character.birth_mon,
		character.birth_day,
	);
	if (birth) chips.push(birth);

	const series = subjects
		.slice(0, 2)
		.map((s) => s.name_cn || s.name)
		.filter(Boolean);
	const subline = series.length
		? `登场作品 · ${series.join(" / ")}`
		: undefined;

	return (
		<FrameView
			cover={cover}
			titleMain={character.name}
			chips={chips}
			subline={subline}
			summary={clamp(character.summary, 110)}
		/>
	);
}

export function PersonCard({
	person,
	cover,
	subjects,
}: {
	person: PersonDetail;
	cover?: string;
	subjects: RelatedSubject[];
}): ReactElement {
	const careers =
		person.career?.map((c) => CareerLabel[c] ?? c).filter(Boolean) ?? [];
	const chips: string[] = [];
	if (careers.length) chips.push(careers.join(" · "));
	if (person.gender) chips.push(person.gender);
	const birth = formatBirth(
		person.birth_year,
		person.birth_mon,
		person.birth_day,
	);
	if (birth) chips.push(birth);

	const series = subjects
		.slice(0, 2)
		.map((s) => s.name_cn || s.name)
		.filter(Boolean);
	const subline = series.length ? `代表作 · ${series.join(" / ")}` : undefined;

	return (
		<FrameView
			cover={cover}
			titleMain={person.name}
			chips={chips}
			subline={subline}
			summary={clamp(person.summary, 110)}
		/>
	);
}

export function EpisodeCard({
	episode,
	subject,
	cover,
}: {
	episode: EpisodeDetail;
	subject: Subject | null;
	cover?: string;
}): ReactElement {
	const epName = episode.name_cn || episode.name || `第 ${episode.sort} 话`;
	const titleMain = `第 ${episode.sort} 话 ${epName}`;
	const titleSub = subject ? subject.name_cn || subject.name : undefined;

	const chips: string[] = [];
	if (episode.airdate) chips.push(`首播 ${episode.airdate}`);
	if (episode.duration) chips.push(episode.duration);

	return (
		<FrameView
			cover={cover}
			titleMain={titleMain}
			titleSub={titleSub}
			chips={chips}
			summary={clamp(episode.desc, 110)}
		/>
	);
}

// ─── helpers ───────────────────────────────────────────

function clamp(
	input: string | undefined | null,
	max: number,
): string | undefined {
	if (!input) return undefined;
	const cleaned = input.replace(/\s+/g, " ").trim();
	if (!cleaned) return undefined;
	if (cleaned.length <= max) return cleaned;
	return `${cleaned.slice(0, max - 1)}…`;
}

function formatBirth(
	year?: number,
	mon?: number,
	day?: number,
): string | undefined {
	if (!year && !mon && !day) return undefined;
	const y = year ? `${year}年` : "";
	const m = mon ? `${mon}月` : "";
	const d = day ? `${day}日` : "";
	return `${y}${m}${d}`;
}

/**
 * 把卡片里所有可能渲染的字符串汇总，给字体子集化用。
 * 包括品牌脚标，避免缺字。
 *
 * ⚠️ 必须覆盖 chips 中出现的所有静态文字（类型标签、职业标签等），
 * 否则 satori 找不到字形会渲染成 □。
 */
export function collectCardText(...parts: Array<string | undefined>): string {
	return [
		...parts,
		// 品牌
		"Bangumi X",
		"bgmx.jaze.top",
		// 评分 / 数字
		"★",
		"0123456789.",
		// 条目类型标签
		"书籍",
		"动画",
		"音乐",
		"游戏",
		"三次元",
		// 人物职业标签
		"制作人",
		"漫画家",
		"音乐人",
		"声优",
		"作家",
		"绘师",
		"演员",
		// 血型
		"型",
		// 生日
		"年",
		"月",
		"日",
		// 其他静态 chip 文字
		"登场作品",
		"代表作",
		"首播",
		"第",
		"话",
		"·",
		"/",
	]
		.filter((s): s is string => Boolean(s))
		.join("");
}
