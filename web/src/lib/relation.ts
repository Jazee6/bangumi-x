export const characterRelationOrder = ["主角", "配角", "客串", "其他"];

export const personRelationOrder = [
  "原作",
  "导演",
  "总导演",
  "副导演",
  "系列构成",
  "脚本",
  "分镜",
  "演出",
  "人物设定",
  "总作画监督",
  "作画监督",
  "原画",
  "音乐",
  "主题歌演出",
  "动画制作",
  "制作",
  "其他",
];

export function getRelationScore(relation: string, order: string[]) {
  const index = order.indexOf(relation);
  return index === -1 ? order.length : index;
}
