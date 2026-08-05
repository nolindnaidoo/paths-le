export interface ExtractionResult {
	readonly success: boolean;
	readonly paths: readonly Path[];
	readonly errors: readonly ParseError[];
}

export interface ParseError {
	readonly category: 'parsing' | 'format';
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
