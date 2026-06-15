/**
 * 轻量并发控制器。
 *
 * 保持任务结果顺序；单个任务失败不会阻塞其他任务，也不会导致整池失败。
 * 适用于 Cloudflare Workers 等需要严格控制同时子请求数的场景。
 */

export async function runWithConcurrency<T>(
	tasks: Array<() => Promise<T>>,
	limit: number,
): Promise<T[]> {
	if (limit <= 0) throw new Error("concurrency limit must be > 0");

	const results = new Array<T>(tasks.length);
	let index = 0;

	async function worker() {
		while (index < tasks.length) {
			const i = index++;
			results[i] = await tasks[i]();
		}
	}

	const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
	await Promise.all(workers);

	return results;
}
