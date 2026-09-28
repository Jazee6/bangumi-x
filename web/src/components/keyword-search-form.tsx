import { useForm } from "@tanstack/react-form";
import { Search, X } from "lucide-react";
import { SEARCH_KEYWORD_MAX_LENGTH } from "share";
import * as v from "valibot";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

function keywordSchema(allowEmpty: boolean) {
  return v.object({
    keyword: v.pipe(
      v.string(),
      v.trim(),
      v.check((value) => allowEmpty || value.length > 0, "请输入搜索关键词"),
      v.maxLength(SEARCH_KEYWORD_MAX_LENGTH, `关键词不能超过 ${SEARCH_KEYWORD_MAX_LENGTH} 个字符`),
    ),
  });
}

interface KeywordSearchFormProps {
  keyword?: string;
  searching: boolean;
  label: string;
  placeholder: string;
  // 允许提交空关键词，用于从搜索回到默认浏览。
  allowEmpty?: boolean;
  className?: string;
  onSubmit: (keyword: string) => void | Promise<void>;
  onClear?: () => void;
}

// 关键词随 URL 变化时重新挂载，让输入框回到当前搜索条件。
export function KeywordSearchForm(props: KeywordSearchFormProps) {
  return <KeywordSearchFormContent key={props.keyword ?? ""} {...props} />;
}

function KeywordSearchFormContent({
  keyword,
  searching,
  label,
  placeholder,
  allowEmpty = false,
  className,
  onSubmit,
  onClear,
}: KeywordSearchFormProps) {
  const form = useForm({
    defaultValues: { keyword: keyword ?? "" },
    validators: { onSubmit: keywordSchema(allowEmpty) },
    onSubmit: async ({ value }) => onSubmit(value.keyword.trim()),
  });

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="keyword">
        {(field) => {
          const invalid = field.state.meta.isTouched && !field.state.meta.isValid;
          return (
            <Field data-invalid={invalid}>
              <FieldLabel htmlFor={field.name} className="sr-only">
                {label}
              </FieldLabel>
              <div className="flex gap-2">
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  placeholder={placeholder}
                  maxLength={SEARCH_KEYWORD_MAX_LENGTH + 1}
                  aria-invalid={invalid}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                <Button type="submit" disabled={searching} className="shrink-0">
                  {searching ? <Spinner /> : <Search />}
                  搜索
                </Button>
                {keyword && onClear && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="清除搜索"
                    onClick={onClear}
                  >
                    <X />
                  </Button>
                )}
              </div>
              {invalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          );
        }}
      </form.Field>
    </form>
  );
}
