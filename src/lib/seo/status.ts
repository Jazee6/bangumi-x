/**
 * Isomorphic 的 setResponseStatus(404) 包装。
 *
 * notFoundComponent 在 SSR 与客户端导航时都会执行，但 setResponseStatus
 * 是服务端 API，直接 import 会让客户端 bundle 被 import-protection 阻止。
 */
import { createIsomorphicFn } from "@tanstack/react-start";

export const setNotFoundStatus = createIsomorphicFn()
	.client(() => {
		// no-op on the client; TanStack Router 通过 notFoundComponent 渲染
	})
	.server(async () => {
		const { setResponseStatus } = await import("@tanstack/react-start/server");
		setResponseStatus(404);
	});
