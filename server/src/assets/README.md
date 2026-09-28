# Bundled font subset

`noto-sans-sc-brand.ttf` is a small fallback subset of Noto Sans SC used only when the runtime Google Fonts subset request fails. It contains the static Bangumi X brand-card characters; entity cards fall back to that static public text rather than sending private or unsupported content.

`noto-sans-sc-mini-brand.ttf` is a separate two-character subset for the Mini share-card label「番迹」, so the label remains legible even if font fetching fails. It is obtained from Google Fonts' Noto Sans SC (weight 700).

Noto Sans CJK is licensed under the SIL Open Font License 1.1: <https://github.com/notofonts/noto-cjk/blob/main/LICENSE>.
