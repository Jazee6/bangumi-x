import { CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "cn";

export function ErrorEmpty({
  title,
  message,
  retrying,
  onRetry,
  className,
}: {
  title: string;
  message: string;
  retrying: boolean;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <Empty variant="outline" className={cn("mt-6 min-h-72", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleAlert />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{message}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button type="button" variant="outline" disabled={retrying} onClick={onRetry}>
          {retrying && <Spinner />}
          重试
        </Button>
      </EmptyContent>
    </Empty>
  );
}
