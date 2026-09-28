import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { SubjectTypeFilter } from "share";

import { DiscoveryControls } from "@/features/discovery/discovery-view";

function renderControls(type: SubjectTypeFilter) {
  return renderToStaticMarkup(
    <DiscoveryControls
      tab="subjects"
      type={type}
      onTabChange={() => undefined}
      onTypeChange={() => undefined}
    />,
  );
}

test.each([
  ["anime", "lucide-clapperboard"],
  ["book", "lucide-book-open"],
] as const)("the %s type value displays its aligned icon", (type, iconClass) => {
  const markup = renderControls(type);
  const valueMarkup = markup.match(/<span data-slot="select-value".*?<\/span>/)?.[0];

  expect(valueMarkup).toContain(iconClass);
  expect(valueMarkup).toContain('class="flex items-center gap-2"');
});
