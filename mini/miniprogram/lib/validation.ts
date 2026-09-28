import {
  COLLECTION_LIST_NAME_MAX_LENGTH,
  isValidCollectionListName,
  SEARCH_KEYWORD_MAX_LENGTH,
} from "share";

export function checkSearchKeyword(keyword: string): boolean {
  if (keyword.length <= SEARCH_KEYWORD_MAX_LENGTH) return true;
  wx.showToast({ title: `关键词不能超过 ${SEARCH_KEYWORD_MAX_LENGTH} 个字符`, icon: "none" });
  return false;
}

export function checkCollectionListName(name: string): boolean {
  if (isValidCollectionListName(name)) return true;
  wx.showToast({
    title: `列表名称需为 1 至 ${COLLECTION_LIST_NAME_MAX_LENGTH} 个字符`,
    icon: "none",
  });
  return false;
}
