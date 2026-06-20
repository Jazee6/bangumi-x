import { useEffect, useState } from "react";

export function OfflineBanner() {
	const [offline, setOffline] = useState(!navigator.onLine);

	useEffect(() => {
		const goOffline = () => setOffline(true);
		const goOnline = () => {
			setOffline(false);
			window.location.reload();
		};

		window.addEventListener("offline", goOffline);
		window.addEventListener("online", goOnline);
		return () => {
			window.removeEventListener("offline", goOffline);
			window.removeEventListener("online", goOnline);
		};
	}, []);

	if (!offline) return null;

	return (
		<div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-yellow-500 px-4 py-1.5 text-sm font-medium text-yellow-950">
			当前处于离线状态
		</div>
	);
}
