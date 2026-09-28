import { useEffect, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Ellipsis, ListChecks, Minus, Plus, Trash2 } from "lucide-react";
import * as v from "valibot";

import { supportsChapterProgress, supportsProgress } from "share";
import type { SubjectProgress, SubjectType } from "share";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import {
  applyOptimisticProgress,
  clearProgress,
  restoreProgressCaches,
  saveProgress,
  syncProgressCaches,
  type ProgressUpdate,
} from "./progress-query";

const CHAPTERS_SCHEMA = v.object({
  completedChapters: v.pipe(
    v.string(),
    v.trim(),
    v.regex(/^\d+$/, "请输入非负整数"),
    v.transform(Number),
    v.safeInteger("章节数不能超过安全整数范围"),
    v.minValue(0, "章节数不能小于 0"),
  ),
});

export function ProgressControl({
  subjectId,
  title,
  type,
  progress,
  totalChapters,
  compact = false,
}: {
  subjectId: number;
  title: string;
  type: SubjectType;
  progress: SubjectProgress | null;
  totalChapters: number | null;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const [confirmingClear, setConfirmingClear] = useState(false);
  const currentChapters = progress?.completedChapters ?? 0;
  const chapterProgress = supportsChapterProgress(type);
  const knownTotal = totalChapters !== null && totalChapters > 0 ? totalChapters : null;
  const updateMutation = useMutation({
    mutationFn: (update: ProgressUpdate) => saveProgress(subjectId, update),
    onMutate: async (update) => ({
      previous: progress,
      snapshot: await applyOptimisticProgress(queryClient, subjectId, update),
    }),
    onSuccess: async (result, _update, context) => {
      await syncProgressCaches(queryClient, subjectId, context.previous, result.progress);
      toast.add({ title: "进度已更新", type: "success" });
    },
    onError: (error, _update, context) => {
      if (context) restoreProgressCaches(queryClient, context.snapshot);
      toast.add({ title: error.message, type: "error", priority: "high" });
    },
  });
  const clearMutation = useMutation({
    mutationFn: () => clearProgress(subjectId),
    onSuccess: async () => {
      await syncProgressCaches(queryClient, subjectId, progress, null);
      setConfirmingClear(false);
      toast.add({ title: "进度已清除", type: "success" });
    },
    onError: (error) => toast.add({ title: error.message, type: "error", priority: "high" }),
  });
  const pending = updateMutation.isPending || clearMutation.isPending;
  const form = useForm({
    defaultValues: { completedChapters: currentChapters.toString() },
    validators: { onSubmit: CHAPTERS_SCHEMA },
    onSubmit: async ({ value }) => {
      try {
        await updateMutation.mutateAsync({ completedChapters: Number(value.completedChapters) });
      } catch {
        // Mutation errors are displayed through the shared toast.
      }
    },
  });

  useEffect(() => {
    form.reset({ completedChapters: currentChapters.toString() });
  }, [currentChapters, form]);

  if (!supportsProgress(type)) return null;

  if (!progress) {
    return (
      <Button
        type="button"
        size={compact ? "sm" : "default"}
        variant="outline"
        disabled={pending}
        onClick={() =>
          updateMutation.mutate({
            stage: "in_progress",
            ...(chapterProgress ? { completedChapters: 0 } : {}),
          })
        }
      >
        {pending ? <Spinner /> : <ListChecks />}
        {pending ? "记录中" : "记录进度"}
      </Button>
    );
  }

  const canReturnToOngoing =
    progress.stage !== "completed" || knownTotal === null || currentChapters < knownTotal;
  const stageAction =
    progress.stage === "in_progress"
      ? { stage: "completed" as const, label: "完成", ariaLabel: "标记已完成", icon: CircleCheck }
      : { stage: "in_progress" as const, label: "恢复", ariaLabel: "恢复进行中", icon: ListChecks };
  const StageIcon = stageAction.icon;

  return (
    <div
      className={
        compact
          ? "mt-auto flex min-w-0 flex-wrap items-start gap-2"
          : "flex min-w-0 flex-wrap items-start gap-2"
      }
    >
      {chapterProgress && (
        <form
          className="min-w-0"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="completedChapters">
            {(field) => {
              const invalid = field.state.meta.isTouched && !field.state.meta.isValid;
              const inputValue = field.state.value.trim();
              const parsedValue = Number(inputValue);
              const chapterValue =
                /^\d+$/.test(inputValue) && Number.isSafeInteger(parsedValue) ? parsedValue : null;
              const step = (delta: number) => {
                if (chapterValue === null) return;
                const nextValue = chapterValue + delta;
                if (knownTotal !== null && delta > 0 && nextValue > knownTotal) return;
                field.handleChange(nextValue.toString());
                updateMutation.mutate({ completedChapters: nextValue });
              };

              return (
                <Field data-invalid={invalid} spacing="compact" className="w-auto">
                  <FieldLabel htmlFor={`progress-${subjectId}`} className="sr-only">
                    已完成章节数
                  </FieldLabel>
                  <ButtonGroup>
                    <Button
                      type="button"
                      size={compact ? "icon-sm" : "icon"}
                      variant="outline"
                      aria-label="减少一章"
                      disabled={pending || chapterValue === null || chapterValue === 0}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => step(-1)}
                    >
                      <Minus />
                    </Button>
                    <Input
                      id={`progress-${subjectId}`}
                      name={field.name}
                      value={field.state.value}
                      inputMode="numeric"
                      aria-invalid={invalid}
                      disabled={pending}
                      variant="progress"
                      size={compact ? "compact" : "default"}
                      className="-ml-px w-12 text-center"
                      onBlur={(event) => {
                        field.handleBlur();
                        if (event.currentTarget.value.trim() !== currentChapters.toString()) {
                          void form.handleSubmit();
                        }
                      }}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                    {knownTotal !== null && (
                      <ButtonGroupText variant="progress">/ {knownTotal}</ButtonGroupText>
                    )}
                    <Button
                      type="button"
                      size={compact ? "icon-sm" : "icon"}
                      variant="outline"
                      aria-label="增加一章"
                      disabled={
                        pending ||
                        chapterValue === null ||
                        chapterValue === Number.MAX_SAFE_INTEGER ||
                        (knownTotal !== null && chapterValue >= knownTotal)
                      }
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => step(1)}
                    >
                      <Plus />
                    </Button>
                  </ButtonGroup>
                  {invalid && <FieldError className="max-w-64" errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          </form.Field>
        </form>
      )}
      {compact && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={stageAction.ariaLabel}
          disabled={pending || !canReturnToOngoing}
          title={!canReturnToOngoing ? "请先减少已完成章节数" : undefined}
          onClick={() => updateMutation.mutate({ stage: stageAction.stage })}
        >
          {updateMutation.isPending ? <Spinner /> : <StageIcon />}
          {stageAction.label}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              size={compact ? "icon-sm" : "icon"}
              variant="ghost"
              aria-label="更多进度操作"
              disabled={pending}
            />
          }
        >
          <Ellipsis />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-32">
          {!compact && (
            <DropdownMenuItem
              className="whitespace-nowrap"
              disabled={pending || !canReturnToOngoing}
              title={!canReturnToOngoing ? "请先减少已完成章节数" : undefined}
              onClick={() => updateMutation.mutate({ stage: stageAction.stage })}
            >
              {updateMutation.isPending ? <Spinner /> : <StageIcon />}
              {stageAction.ariaLabel}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmingClear(true)}>
            <Trash2 />
            清除进度
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmingClear} onOpenChange={setConfirmingClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清除“{title}”的进度？</AlertDialogTitle>
            <AlertDialogDescription>
              该条目的进度记录将被删除，收藏记录不会受到影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end">
            <AlertDialogCancel disabled={clearMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={clearMutation.isPending}
              onClick={() => clearMutation.mutate()}
            >
              {clearMutation.isPending && <Spinner />}
              {clearMutation.isPending ? "清除中" : "确认清除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
