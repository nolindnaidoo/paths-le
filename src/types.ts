export interface ExtractionResult {
	readonly success: boolean;
	readonly paths: readonly Path[];
	readonly errors: readonly ParseError[];
}

export interface ParseError {
	/**
	 * There was a `format` category too, for one message: the
	 * unsupported-format refusal. The generic scan replaced that refusal, so
	 * nothing produces it on either frontend any more — and a variant no code
	 * path can reach is a claim the code does not back.
	 */
	readonly category: 'parsing';
	readonly severity: 'info' | 'warning' | 'error';
	readonly message: string;
	readonly context?: string;
	readonly recoverable: boolean;
	readonly recoveryAction: 'retry' | 'skip' | 'none';
	readonly timestamp: number;
	readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface Path {
	readonly value: string;
	readonly type: PathType;
	readonly position: {
		readonly line: number;
		readonly column: number;
	};
	readonly context: string;
}

export type PathType = 'file' | 'relative' | 'absolute' | 'url' | 'unknown';

export type FileType =
	| 'json'
	| 'javascript'
	| 'typescript'
	| 'html'
	| 'css'
	| 'csv'
	| 'toml'
	| 'dotenv'
	| 'yaml'
	/** Read by the generic text scan rather than by a parser. */
	| 'unknown';

export interface PathResolutionConfig {
	readonly resolveSymlinks: boolean;
	readonly resolveWorkspaceRelative: boolean;
}

export interface Configuration {
	readonly copyToClipboardEnabled: boolean;
	readonly notificationsLevel: 'all' | 'important' | 'silent';
	readonly postProcessOpenInNewFile: boolean;
	readonly openResultsSideBySide: boolean;
	readonly safetyEnabled: boolean;
	readonly safetyFileSizeWarnBytes: number;
	readonly safetyLargeOutputLinesThreshold: number;
	readonly statusBarEnabled: boolean;
	readonly telemetryEnabled: boolean;
	readonly resolution: PathResolutionConfig;
}
