import { FileText, PackageOpen } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export function RelationEmpty({ label }: { label: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PackageOpen />
        </EmptyMedia>
        <EmptyTitle>暂无{label}</EmptyTitle>
        <EmptyDescription>这里还没有可浏览的{label}。</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function SummaryEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileText />
        </EmptyMedia>
        <EmptyTitle>暂无简介</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}
