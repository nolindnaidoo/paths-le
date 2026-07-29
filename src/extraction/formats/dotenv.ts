import type { Path } from '../../types';
import { classifyPathType, isPathLike } from '../heuristics';

/**
 * Extract paths from .env files: values of KEY=VALUE assignments, plus
 * keys that themselves look like paths. Line-based on purpose — dotenv
 * is a line-oriented format. Columns are 1-based offsets into the raw
 * (untrimmed) line and point at the value/key itself.
 */
export function extractFromDotenv(content: string): Path[] {
	if (content.trim().length === 0) return [];

	const lines = content.split('\n');
	const paths: Path[] = [];

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const rawLine = lines[lineIndex] ?? '';
		const line = rawLine.trim();

		if (line.startsWith('#') || line.length === 0) continue;

		const match = line.match(/^(["']?)([^=]+?)\1=(.*)$/);
		if (!match) continue;

		const quotedKey = match[1] ?? '';
		const key = (match[2] ?? '').trim();
		const rawValue = match[3] ?? '';
		if (!key || !rawValue) continue;

		const cleanValue = rawValue
			.replace(/^["']|["']$/g, '')
			.trim()
			.replace(/\\\\/g, '\\');

		if (cleanValue && isPathLike(cleanValue)) {
			paths.push({
				value: cleanValue,
				type: classifyPathType(cleanValue),
				position: {
					line: lineIndex + 1,
					column: columnOf(rawLine, cleanValue, rawValue),
				},
				context: `Environment variable: ${key}`,
			});
		}

		if (isPathLike(key)) {
			paths.push({
				value: key,
				type: classifyPathType(key),
				position: {
					line: lineIndex + 1,
					column:
						rawLine.indexOf(quotedKey ? `${quotedKey}${key}` : key) +
						1 +
						(quotedKey ? 1 : 0),
				},
				context: 'Environment variable name',
			});
		}
	}

	return paths;
}

/**
 * 1-based column of the extracted value within the raw line. Falls back
 * to the raw value position when unescaping changed the text.
 */
function columnOf(
	rawLine: string,
	cleanValue: string,
	rawValue: string,
): number {
	const direct = rawLine.indexOf(cleanValue);
	if (direct !== -1) return direct + 1;
	const raw = rawLine.indexOf(rawValue);
	if (raw !== -1) return raw + 1;
	return rawLine.indexOf('=') + 2;
}
