import { useForm } from "@tanstack/react-form";
import { Plus, Save } from "lucide-react";
import { COLLECTION_LIST_NAME_MAX_LENGTH } from "share";
import * as v from "valibot";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "cn";

const LIST_NAME_SCHEMA = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.minLength(1, "请输入列表名称"),
    v.maxLength(
      COLLECTION_LIST_NAME_MAX_LENGTH,
      `列表名称不能超过 ${COLLECTION_LIST_NAME_MAX_LENGTH} 个字符`,
    ),
  ),
});

interface CollectionListFormProps {
  initialName?: string;
  pending: boolean;
  mode: "create" | "rename";
  onSubmit: (name: string) => Promise<void>;
  onCancel?: () => void;
  footer?: React.ReactNode;
  className?: string;
}

// 列表名称从外部变化时重新挂载，让输入框回到最新名称。
export function CollectionListForm(props: CollectionListFormProps) {
  return <CollectionListFormContent key={props.initialName ?? ""} {...props} />;
}

function CollectionListFormContent({
  initialName = "",
  pending,
  mode,
  onSubmit,
  onCancel,
  footer,
  className,
}: CollectionListFormProps) {
  const form = useForm({
    defaultValues: { name: initialName },
    validators: { onSubmit: LIST_NAME_SCHEMA },
    onSubmit: async ({ value }) => {
      try {
        await onSubmit(value.name.trim());
        if (mode === "create") form.reset({ name: "" });
      } catch {
        // The mutation reports the failure through toast while the form preserves its input.
      }
    },
  });

  return (
    <form
      className={cn("flex flex-col gap-2", className)}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => {
          const invalid = field.state.meta.isTouched && !field.state.meta.isValid;
          return (
            <Field data-invalid={invalid}>
              <FieldLabel htmlFor={`${mode}-${field.name}`} className="sr-only">
                收藏列表名称
              </FieldLabel>
              <Input
                id={`${mode}-${field.name}`}
                name={field.name}
                value={field.state.value}
                placeholder={mode === "create" ? "新列表名称" : "列表名称"}
                maxLength={COLLECTION_LIST_NAME_MAX_LENGTH + 1}
                aria-invalid={invalid}
                disabled={pending}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              {invalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          );
        }}
      </form.Field>
      {footer ?? (
        <div className="flex justify-end gap-2">
          <Button type="submit" size="sm" disabled={pending} className="shrink-0">
            {pending ? <Spinner /> : mode === "create" ? <Plus /> : <Save />}
            {pending ? "保存中" : mode === "create" ? "新建" : "保存"}
          </Button>
          {onCancel && (
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onCancel}>
              取消
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
