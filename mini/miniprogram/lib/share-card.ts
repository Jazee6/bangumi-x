// 好友分享卡片为 5:4，竖版封面直接使用会被裁掉大半，因此在客户端离屏合成：左侧封面，右侧名称与要点。
// 合成失败或超过三秒时，微信沿用默认参数里的封面。朋友圈缩略图是方形，仍直接用封面。

export interface ShareCardContent {
  title: string;
  imageUrl: string;
  /** 名称下方的要点，如条目类型、评分与放送信息。 */
  lines: string[];
}

interface FriendShare {
  title: string;
  path: string;
  imageUrl: string;
}

// 类型定义落后于 2d 离屏 Canvas 的实际接口，这里只声明用到的部分。
interface CardImage {
  width: number;
  height: number;
  src: string;
  onload: () => void;
  onerror: (error: unknown) => void;
}

interface CardContext {
  fillStyle: string;
  font: string;
  textBaseline: "top" | "bottom";
  fillRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  drawImage(
    image: CardImage,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
}

interface CardCanvas {
  getContext(type: "2d"): CardContext;
  createImage(): CardImage;
}

function createCanvas(options: { type: "2d"; width: number; height: number }) {
  return (wx.createOffscreenCanvas as unknown as (value: typeof options) => CardCanvas)(options);
}

const WIDTH = 1000;
const HEIGHT = 800;
const COVER_WIDTH = (HEIGHT * 2) / 3;
const PADDING = 48;
const TEXT_LEFT = COVER_WIDTH + PADDING;
const TEXT_WIDTH = WIDTH - TEXT_LEFT - PADDING;
// 与 app.wxss 浅色主题的 --background、--foreground、--muted-foreground 一致。
const COLORS = { background: "#ffffff", foreground: "#0a0a0a", muted: "#737373" };
const TITLE_FONT = { size: 52, lineHeight: 68, maxLines: 4 };
const LINE_FONT = { size: 34, lineHeight: 48, maxLines: 2 };
const BRAND = "番迹";

/** 按字符折行（中日文无空格），超出行数时末行以省略号结尾。 */
export function wrapText(
  text: string,
  maxWidth: number,
  maxLines: number,
  measure: (value: string) => number,
): string[] {
  const lines: string[] = [];
  let current = "";
  for (const char of Array.from(text)) {
    if (!current || measure(current + char) <= maxWidth) {
      current += char;
      continue;
    }
    if (lines.length === maxLines - 1) {
      let last = current;
      while (last && measure(`${last}…`) > maxWidth) last = Array.from(last).slice(0, -1).join("");
      lines.push(`${last}…`);
      return lines;
    }
    lines.push(current);
    current = char.trim() ? char : "";
  }
  if (current) lines.push(current);
  return lines;
}

function loadImage(canvas: CardCanvas, src: string) {
  return new Promise<CardImage>((resolve, reject) => {
    const image = canvas.createImage();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function toTempFile(canvas: CardCanvas) {
  return new Promise<string>((resolve, reject) => {
    wx.canvasToTempFilePath({
      canvas: canvas as unknown as WechatMiniprogram.Component.TrivialInstance,
      destWidth: WIDTH / 2,
      destHeight: HEIGHT / 2,
      fileType: "jpg",
      quality: 0.9,
      success: (result) => resolve(result.tempFilePath),
      fail: reject,
    });
  });
}

async function renderShareCard({ title, imageUrl, lines }: ShareCardContent): Promise<string> {
  const canvas = createCanvas({ type: "2d", width: WIDTH, height: HEIGHT });
  const context = canvas.getContext("2d");
  const cover = await loadImage(canvas, imageUrl);

  context.fillStyle = COLORS.background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  // 居中裁切为 2:3，与详情页封面比例一致。
  const scale = Math.max(COVER_WIDTH / cover.width, HEIGHT / cover.height);
  const sourceWidth = COVER_WIDTH / scale;
  const sourceHeight = HEIGHT / scale;
  context.drawImage(
    cover,
    (cover.width - sourceWidth) / 2,
    (cover.height - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    0,
    0,
    COVER_WIDTH,
    HEIGHT,
  );

  context.textBaseline = "top";
  const measure = (value: string) => context.measureText(value).width;
  let y = PADDING;
  context.fillStyle = COLORS.foreground;
  context.font = `bold ${TITLE_FONT.size}px sans-serif`;
  for (const line of wrapText(title, TEXT_WIDTH, TITLE_FONT.maxLines, measure)) {
    context.fillText(line, TEXT_LEFT, y);
    y += TITLE_FONT.lineHeight;
  }

  y += PADDING / 2;
  context.fillStyle = COLORS.muted;
  context.font = `${LINE_FONT.size}px sans-serif`;
  for (const text of lines) {
    for (const line of wrapText(text, TEXT_WIDTH, LINE_FONT.maxLines, measure)) {
      context.fillText(line, TEXT_LEFT, y);
      y += LINE_FONT.lineHeight;
    }
  }

  context.textBaseline = "bottom";
  context.fillText(BRAND, WIDTH - PADDING - measure(BRAND), HEIGHT - PADDING);
  return toTempFile(canvas);
}

const rendered = new Map<string, Promise<string>>();

// 同一内容只合成一次；失败的结果不缓存，下次分享时重试。
function cardImage(card: ShareCardContent) {
  const key = JSON.stringify(card);
  let image = rendered.get(key);
  if (!image) {
    image = renderShareCard(card);
    rendered.set(key, image);
    image.catch(() => rendered.delete(key));
  }
  return image;
}

/** 详情加载后预先合成，分享时通常已就绪，不必在三秒内现场下载封面。 */
export function prepareShareCard(card: ShareCardContent) {
  if (card.imageUrl) cardImage(card).catch(() => undefined);
}

/** 有封面时附上合成卡片的 promise。 */
export function withShareCard(share: FriendShare, card: ShareCardContent) {
  if (!card.imageUrl) return share;
  const image = cardImage(card);
  return {
    ...share,
    promise: image.then(
      (imageUrl) => ({ ...share, imageUrl }),
      () => share,
    ),
  };
}
