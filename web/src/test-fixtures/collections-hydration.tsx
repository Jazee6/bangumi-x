import { mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ComponentType, type ReactNode } from "react";

let sessionState: { data?: { user: { name: string } }; isPending: boolean } = {
  data: undefined,
  isPending: true,
};

let routeComponent: ComponentType | undefined;

const passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>;
mock.module("@tanstack/react-query", () => ({
  useInfiniteQuery: () => ({
    data: undefined,
    isPending: true,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: () => Promise.resolve(),
  }),
  useMutation: () => ({
    isPending: false,
    mutate: () => undefined,
    mutateAsync: () => Promise.resolve(),
  }),
  useQuery: () => ({
    data: { data: [], collections: { all: 0, unlisted: 0 } },
    isPending: false,
    isError: false,
  }),
  useQueryClient: () => ({ invalidateQueries: () => Promise.resolve() }),
}));

mock.module("@tanstack/react-form", () => ({
  useForm: () => ({
    Field: ({ children }: { children: (field: unknown) => ReactNode }) =>
      children({
        name: "keyword",
        state: { value: "", meta: { isTouched: false, errors: [] } },
        handleBlur: () => undefined,
        handleChange: () => undefined,
      }),
    Subscribe: ({ children }: { children: (state: unknown) => ReactNode }) =>
      children({ isSubmitting: false, values: { keyword: "" } }),
    handleSubmit: () => Promise.resolve(),
    reset: () => undefined,
  }),
}));

mock.module("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => {
    routeComponent = options.component;
    return {
      useNavigate: () => () => Promise.resolve(),
      useSearch: () => ({}),
    };
  },
  stripSearchParams: () => ({}),
}));

mock.module("better-auth/react", () => ({
  createAuthClient: () => ({
    useSession: () => sessionState,
    signIn: { social: () => Promise.resolve({ error: null }) },
  }),
}));
mock.module("@/components/app-shell", () => ({ HeaderTitle: passthrough }));
mock.module("@/components/responsive-modal", () => ({
  ResponsiveModal: passthrough,
}));
mock.module("@/components/ui/alert-dialog", () => ({
  AlertDialog: passthrough,
  AlertDialogAction: passthrough,
  AlertDialogCancel: passthrough,
  AlertDialogContent: passthrough,
  AlertDialogDescription: passthrough,
  AlertDialogFooter: passthrough,
  AlertDialogHeader: passthrough,
  AlertDialogTitle: passthrough,
}));
mock.module("@/components/ui/button", () => ({
  Button: ({ children }: { children?: ReactNode }) => <button>{children}</button>,
}));
mock.module("@/components/ui/empty", () => ({
  Empty: passthrough,
  EmptyContent: passthrough,
  EmptyDescription: passthrough,
  EmptyHeader: passthrough,
  EmptyMedia: passthrough,
  EmptyTitle: passthrough,
}));
mock.module("@/components/ui/field", () => ({
  Field: passthrough,
  FieldError: () => null,
  FieldLabel: passthrough,
}));
mock.module("@/components/ui/input", () => ({ Input: () => <input /> }));
mock.module("@/components/ui/select", () => ({
  Select: passthrough,
  SelectContent: passthrough,
  SelectItem: passthrough,
  SelectTrigger: passthrough,
  SelectValue: passthrough,
}));
mock.module("@/components/ui/spinner", () => ({ Spinner: () => null }));
mock.module("@/components/ui/tabs", () => ({
  Tabs: passthrough,
  TabsList: passthrough,
  TabsTrigger: passthrough,
}));
mock.module("@/components/ui/toast", () => ({
  toast: { add: () => undefined },
}));
mock.module("@/features/collections/collection-list-form", () => ({
  CollectionListForm: () => null,
}));
mock.module("@/features/collections/collections-query", () => ({
  collectionListsQueryOptions: { queryKey: ["lists"] },
  createCollectionList: () => Promise.resolve(),
  deleteCollectionList: () => Promise.resolve(),
  personalRecordCountsQueryOptions: { queryKey: ["counts"] },
  personalRecordsQueryOptions: () => ({ queryKey: ["records"] }),
  renameCollectionList: () => Promise.resolve(),
  setCollectionListVisibility: () => Promise.resolve(),
}));
mock.module("@/features/collections/collections-view", () => ({
  CollectionsError: () => null,
  CollectionsLoading: () => <div>loading</div>,
  PersonalRecordsGrid: () => null,
}));
mock.module("@/features/collections/collections-search", () => ({
  DEFAULT_COLLECTIONS_SEARCH: {},
  updateCollectionsSearch: (_search: unknown, patch: unknown) => patch,
  validateCollectionsSearch: () => ({}),
}));

await import("../routes/_app/collections");

if (!routeComponent) throw new Error("Collections route component was not registered");

sessionState = { data: undefined, isPending: true };
const serverMarkup = renderToStaticMarkup(createElement(routeComponent));

sessionState = { data: { user: { name: "Alice" } }, isPending: false };
const firstClientMarkup = renderToStaticMarkup(createElement(routeComponent));

if (firstClientMarkup !== serverMarkup) {
  throw new Error(
    `Collections hydration markup differs.\nServer: ${serverMarkup}\nClient: ${firstClientMarkup}`,
  );
}
