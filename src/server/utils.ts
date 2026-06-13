import pkg from "../../package.json";

const BASE_URL = "https://bgmapi.anibt.net";
const USER_AGENT = `Jazee6/bangumi/${pkg.version}(https://github.com/Jazee6/bangumi)`;

export async function bgmFetch<T = unknown>(
	path: string,
	init?: RequestInit,
): Promise<T> {
	const res = await fetch(`${BASE_URL}${path}`, {
		...init,
		headers: {
			"User-Agent": USER_AGENT,
			...init?.headers,
		},
	});

	if (!res.ok) {
		throw new Error(
			`Bangumi API error: ${res.status} ${res.statusText} (${path})`,
		);
	}

	return (await res.json()) as Promise<T>;
}
