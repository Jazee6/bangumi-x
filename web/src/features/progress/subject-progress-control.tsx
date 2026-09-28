import { useQuery } from "@tanstack/react-query";
import { CircleAlert, LogIn } from "lucide-react";

import { supportsProgress } from "share";
import type { SubjectType } from "share";

import { useLogin } from "@/components/sign-in";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { personalSubjectStateQueryOptions } from "@/features/collections/collections-query";
import { useHydratedSession } from "@/lib/auth-client";
import { ProgressControl } from "./progress-control";

export function SubjectDetailProgressControl({
  subjectId,
  title,
  type,
  totalChapters,
}: {
  subjectId: number;
  title: string;
  type: SubjectType;
  totalChapters: number | null;
}) {
  const { data: session, isPending: sessionPending } = useHydratedSession();
  const { loggingIn, login } = useLogin();
  const state = useQuery({
    ...personalSubjectStateQueryOptions(subjectId.toString()),
    enabled: Boolean(session && supportsProgress(type)),
  });

  if (!supportsProgress(type)) return null;
  if (sessionPending) return <Skeleton shape="control" className="h-9 w-28" />;
  if (!session) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled={loggingIn}
        onClick={() => void login(`/subjects/${subjectId}`)}
      >
        {loggingIn ? <Spinner /> : <LogIn />}
        {loggingIn ? "登录中" : "记录进度"}
      </Button>
    );
  }
  if (state.isPending) return <Skeleton shape="control" className="h-9 w-28" />;
  if (state.isError) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled={state.isFetching}
        onClick={() => void state.refetch()}
      >
        {state.isFetching ? <Spinner /> : <CircleAlert />}
        进度加载失败，重试
      </Button>
    );
  }
  return (
    <ProgressControl
      subjectId={subjectId}
      title={title}
      type={type}
      progress={state.data?.progress ?? null}
      totalChapters={totalChapters ?? state.data?.progress?.totalChapters ?? null}
    />
  );
}
