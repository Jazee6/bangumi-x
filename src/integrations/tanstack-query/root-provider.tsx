import { QueryClient } from "@tanstack/react-query";

const STALE_TIME = 5 * 60 * 1000; // 5 分钟
const GC_TIME = 10 * 60 * 1000; // 10 分钟

export function getContext() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: STALE_TIME,
				gcTime: GC_TIME,
				refetchOnWindowFocus: false,
				refetchOnReconnect: false,
			},
		},
	});

	return {
		queryClient,
	};
}
export default function TanstackQueryProvider() {}
