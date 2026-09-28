import type { GroupedResponse } from "share";

import { RelationCollectionSkeleton } from "@/components/content-skeletons";
import { RelationEmpty } from "@/components/empty-states";
import { ErrorEmpty } from "@/components/error-empty";
interface CollectionStateProps<T> {
  data: GroupedResponse<T> | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  error: Error | null;
  label: string;
  loadingVariant?: "poster" | "entity";
  onRetry: () => void;
  children: (data: GroupedResponse<T>) => React.ReactNode;
}

export function CollectionState<T>({
  data,
  isPending,
  isError,
  isFetching,
  error,
  label,
  loadingVariant = "entity",
  onRetry,
  children,
}: CollectionStateProps<T>) {
  if (isPending) {
    return <CollectionLoading variant={loadingVariant} />;
  }
  if (isError || !data) {
    return (
      <ErrorEmpty
        title={`${label}加载失败`}
        message={error?.message ?? `${label}暂时无法加载，请稍后重试。`}
        retrying={isFetching}
        onRetry={onRetry}
        className="mt-0 min-h-48"
      />
    );
  }
  if (data.total === 0) {
    return <RelationEmpty label={label} />;
  }
  return children(data);
}

export function CollectionLoading({ variant = "entity" }: { variant?: "poster" | "entity" }) {
  return <RelationCollectionSkeleton variant={variant} />;
}
