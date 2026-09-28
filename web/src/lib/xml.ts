export interface SitemapItem {
  loc: string;
  lastmod?: string | null;
}

/* eslint-disable no-control-regex */
// XML 1.0 valid chars: #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
const INVALID_XML_CHARS = /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu;

export function escapeXml(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value).replace(INVALID_XML_CHARS, "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildSitemapIndex(sitemaps: SitemapItem[]): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const sitemap of sitemaps) {
    lines.push("  <sitemap>");
    lines.push(`    <loc>${escapeXml(sitemap.loc)}</loc>`);
    if (sitemap.lastmod) {
      lines.push(`    <lastmod>${escapeXml(sitemap.lastmod)}</lastmod>`);
    }
    lines.push("  </sitemap>");
  }

  lines.push("</sitemapindex>");
  return lines.join("\n");
}

export function buildUrlSet(urls: SitemapItem[]): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const item of urls) {
    lines.push("  <url>");
    lines.push(`    <loc>${escapeXml(item.loc)}</loc>`);
    if (item.lastmod) {
      lines.push(`    <lastmod>${escapeXml(item.lastmod)}</lastmod>`);
    }
    lines.push("  </url>");
  }

  lines.push("</urlset>");
  return lines.join("\n");
}

export function validateXmlWellFormedness(xml: string): { valid: boolean; error?: string } {
  let text = xml.trim();

  // Strip xml declaration if present
  if (text.startsWith("<?xml")) {
    const endDecl = text.indexOf("?>");
    if (endDecl === -1) {
      return { valid: false, error: "Unclosed XML declaration" };
    }
    text = text.slice(endDecl + 2).trim();
  }

  // Check for raw unescaped & (not followed by valid entity or character reference)
  const rawAmpMatch = text.match(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/);
  if (rawAmpMatch) {
    return { valid: false, error: `Unescaped '&' found in XML at index ${rawAmpMatch.index}` };
  }

  const stack: string[] = [];
  let rootFound = false;
  let rootClosed = false;

  const tagRegex = /<(\/)?([a-zA-Z_:][a-zA-Z0-9._:-]*)([^>]*?)(\/)?>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(text)) !== null) {
    const [fullTag, isClosing, tagName, , isSelfClosing] = match;

    // Check text between tags for illegal raw '<'
    const between = text.slice(lastIndex, match.index);
    if (between.includes("<")) {
      return { valid: false, error: "Raw '<' found in text content" };
    }
    lastIndex = match.index + fullTag.length;

    if (isClosing) {
      if (stack.length === 0) {
        return { valid: false, error: `Unexpected closing tag </${tagName}> without open tag` };
      }
      const top = stack.pop();
      if (top !== tagName) {
        return {
          valid: false,
          error: `Mismatched closing tag: expected </${top}>, got </${tagName}>`,
        };
      }
      if (stack.length === 0) {
        rootClosed = true;
      }
    } else if (isSelfClosing) {
      if (!rootFound) {
        rootFound = true;
        rootClosed = true;
      } else if (rootClosed) {
        return { valid: false, error: "Multiple root elements found" };
      }
    } else {
      if (rootClosed) {
        return { valid: false, error: "Multiple root elements found" };
      }
      rootFound = true;
      stack.push(tagName);
    }
  }

  const trailing = text.slice(lastIndex).trim();
  if (trailing.includes("<") || trailing.includes(">")) {
    return { valid: false, error: "Malformed XML tags in trailing content" };
  }

  if (stack.length > 0) {
    return { valid: false, error: `Unclosed tags: ${stack.join(", ")}` };
  }

  if (!rootFound) {
    return { valid: false, error: "No root element found" };
  }

  return { valid: true };
}
