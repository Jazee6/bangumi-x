import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export function NotFoundPage() {
  return (
    <section className="flex flex-1 p-4 sm:p-6">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>页面不存在</EmptyTitle>
          <EmptyDescription>你访问的页面可能已被移除，或地址有误。</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button nativeButton={false} render={<Link to="/" />}>
            返回首页
          </Button>
        </EmptyContent>
      </Empty>
    </section>
  );
}
