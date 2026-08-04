/**
 * Measure real extraction throughput. Run with `bun run benchmark`.
 *
 * Numbers are machine-specific, so the host is recorded alongside them and
 * they are never asserted in CI — a benchmark that gates a build just fails on
 * a slower runner. The point is a reproducible figure, not a pass/fail.
 *
 * Inputs are generated rather than checked in so the sizes are explicit and
 * the corpus cannot silently drift from what the numbers claim.
 */
import { cpus, totalmem } from 'node:os';
import { extractPaths } from '../src/extraction/extract';

interface Case {
	readonly label: string;
	readonly languageId: string;
	readonly build: () => string;
}

const CASES: readonly Case[] = [
	{
		label: 'TypeScript imports',
		languageId: 'typescript',
		build: () =>
			Array.from(
				{ length: 20_000 },
				(_, i) =>
					`import { thing${i} } from './modules/feature-${i % 97}/index';\nconst asset${i} = require('../assets/img/${i}.png');`,
			).join('\n'),
	},
	{
		label: 'JSON config',
		languageId: 'json',
		build: () =>
			JSON.stringify(
				{
					files: Array.from({ length: 40_000 }, (_, i) => `./src/gen/file-${i}.ts`),
					out: './dist/bundle.js',
				},
				null,
				2,
			),
	},
	{
		label: 'HTML document',
		languageId: 'html',
		build: () =>
			`<!doctype html><html><body>\n${Array.from(
				{ length: 20_000 },
				(_, i) =>
					`<img src="./img/${i}.png"><a href="../pages/${i}.html">p${i}</a>`,
			).join('\n')}\n</body></html>`,
	},
	{
		label: 'CSS stylesheet',
		languageId: 'css',
		build: () =>
			Array.from(
				{ length: 20_000 },
				(_, i) =>
					`.c${i} { background: url("./img/bg-${i}.png"); }\n@import "./partials/p${i}.css";`,
			).join('\n'),
	},
	{
		label: 'CSV data',
		languageId: 'csv',
		build: () =>
			`path,size\n${Array.from(
				{ length: 60_000 },
				(_, i) => `./data/export/chunk-${i}.csv,${i * 7}`,
			).join('\n')}`,
	},
];

const WARMUP = 2;
const RUNS = 7;

function median(xs: readonly number[]): number {
	const s = [...xs].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

async function main(): Promise<void> {
	const results: Array<Record<string, unknown>> = [];

	for (const c of CASES) {
		const content = c.build();
		const bytes = Buffer.byteLength(content, 'utf8');

		for (let i = 0; i < WARMUP; i++) await extractPaths(content, c.languageId);

		const durations: number[] = [];
		let count = 0;
		for (let i = 0; i < RUNS; i++) {
			const t0 = performance.now();
			const r = await extractPaths(content, c.languageId);
			durations.push(performance.now() - t0);
			count = r.paths.length;
		}

		const ms = median(durations);
		results.push({
			label: c.label,
			bytes,
			lines: content.split('\n').length,
			extracted: count,
			ms: Number(ms.toFixed(2)),
			perSecond: count > 0 ? Math.round(count / (ms / 1000)) : null,
			mbPerSecond: Number((bytes / 1_048_576 / (ms / 1000)).toFixed(1)),
		});
		console.log(
			`${c.label.padEnd(20)} ${(bytes / 1_048_576).toFixed(2)} MB  ${String(count).padStart(7)} paths  ${ms.toFixed(2)} ms`,
		);
	}

	const cpu = cpus()[0]?.model ?? 'unknown CPU';
	const out = {
		host: `${cpu}, ${Math.round(totalmem() / 1_073_741_824)} GB RAM, Node ${process.versions.node}`,
		runs: RUNS,
		results,
	};
	await Bun.write('benchmark-results.json', `${JSON.stringify(out, null, 2)}\n`);
	console.log('\nwrote benchmark-results.json');
}

await main();
