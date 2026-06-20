/**
 * Service Worker 注册 + 更新提示。
 *
 * 流程：检测到新 SW 安装就绪（且当前已有 controller）时弹 toast，
 * 用户点「刷新」→ 给等待中的 SW 发 SKIP_WAITING → controllerchange → 重载页面。
 * 首次安装（无 controller）静默，不打扰。
 */
import { toast } from "sonner";

export function registerSW(): void {
	if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
		return;
	}

	let refreshing = false;
	navigator.serviceWorker.addEventListener("controllerchange", () => {
		if (refreshing) return;
		refreshing = true;
		window.location.reload();
	});

	navigator.serviceWorker
		.register("/sw.js")
		.then((reg) => {
			reg.addEventListener("updatefound", () => {
				const installing = reg.installing;
				if (!installing) return;
				installing.addEventListener("statechange", () => {
					if (
						installing.state === "installed" &&
						navigator.serviceWorker.controller
					) {
						toast.info("已更新到新版本，刷新后生效。", {
							action: {
								label: "刷新",
								onClick: () =>
									navigator.serviceWorker.controller?.postMessage({
										type: "SKIP_WAITING",
									}),
							},
							duration: Infinity,
						});
					}
				});
			});
		})
		.catch((err) => {
			console.warn("[pwa] sw register failed", err);
		});
}
