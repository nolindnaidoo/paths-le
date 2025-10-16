export interface ExtractionResult {
	success: boolean;
	paths: readonly Path[];
	errors: readonly ParseError[];
}

export type ErrorCategory =
	| 'parsing'
	| 'format'
	| 'validation'
	| 'file-system'
	| 'configuration'
	| 'path-validation'
	| 'analysis'
	| 'performance'
	| 'unknown';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export type RecoveryAction =
	| 'retry'
	| 'fallback'
	| 'user-action'
	| 'skip'
	| 'abort'
	| 'none';

export interface PathsLeError {
	readonly category: ErrorCategory;
	readonly severity: ErrorSeverity;
	readonly message: string;
	readonly context?: string;
	readonly recoverable: boolean;
	readonly recoveryAction: RecoveryAction;
	readonly timestamp: number;
	readonly stack?: string;
	readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ParseError extends PathsLeError {
	readonly category: 'parsing' | 'format';
	readonly filepath?: string;
	readonly position?: {
		readonly line: number;
		readonly column: number;
	};
}

export interface Path {
	value: string;
	type: PathType;
	position: {
		line: number;
		column: number;
	};
	context: string;
}

export type PathType =
	| 'file'
	| 'directory'
	| 'relative'
	| 'absolute'
	| 'url'
	| 'unknown';

export interface AnalysisResult {
	count: number;
	unique: number;
	duplicates: number;
	types: Record<string, number>;
	validation?: ValidationAnalysis;
	patterns?: PatternAnalysis;
}

export interface ValidationAnalysis {
	valid: number;
	invalid: number;
	broken: number;
	inaccessible: number;
	permissions: Record<string, number>;
}

export interface PatternAnalysis {
	commonPatterns: CommonPattern[];
	depthDistribution: Record<string, number>;
	namingConventions: Record<string, number>;
	extensions: Record<string, number>;
}

export interface CommonPattern {
	pattern: string;
	count: number;
	percentage: number;
	examples: string[];
}

export interface ValidationResult {
	path: string;
	status: 'valid' | 'invalid' | 'broken' | 'inaccessible';
	exists?: boolean;
	permissions?: string;
	error?: string;
	resolvedPath?: string;
}

export type FileType =
	| 'json'
	| 'yaml'
	| 'javascript'
	| 'typescript'
	| 'html'
	| 'css'
	| 'log'
	| 'ini'
	| 'csv'
	| 'toml'
	| 'dotenv'
	| 'unknown';

export type OutputFormat = 'text' | 'json' | 'csv';

export interface PathResolutionConfig {
	readonly resolveSymlinks: boolean;
	readonly resolveWorkspaceRelative: boolean;
}

export interface ValidationConfig {
	readonly enabled: boolean;
	readonly checkExistence: boolean;
	readonly checkPermissions: boolean;
}

export interface Configuration {
	readonly copyToClipboardEnabled: boolean;
	readonly dedupeEnabled: boolean;
	readonly notificationsLevel: 'all' | 'important' | 'silent';
	readonly postProcessOpenInNewFile: boolean;
	readonly openResultsSideBySide: boolean;
	readonly safetyEnabled: boolean;
	readonly safetyFileSizeWarnBytes: number;
	readonly safetyLargeOutputLinesThreshold: number;
	readonly safetyManyDocumentsThreshold: number;
	readonly showParseErrors: boolean;
	readonly statusBarEnabled: boolean;
	readonly telemetryEnabled: boolean;
	readonly analysisEnabled: boolean;
	readonly analysisIncludeValidation: boolean;
	readonly analysisIncludePatterns: boolean;
	readonly validationEnabled: boolean;
	readonly validationCheckExistence: boolean;
	readonly validationCheckPermissions: boolean;
	readonly performanceEnabled: boolean;
	readonly performanceMaxDuration: number;
	readonly performanceMaxMemoryUsage: number;
	readonly performanceMaxCpuUsage: number;
	readonly performanceMinThroughput: number;
	readonly performanceMaxCacheSize: number;
	readonly keyboardShortcutsEnabled: boolean;
	readonly keyboardExtractShortcut: string;
	readonly keyboardValidateShortcut: string;
	readonly keyboardAnalyzeShortcut: string;
	readonly presetsEnabled: boolean;
	readonly defaultPreset:
		| 'minimal'
		| 'balanced'
		| 'comprehensive'
		| 'performance'
		| 'validation';
	readonly resolution?: PathResolutionConfig;
	readonly validation?: ValidationConfig;
}

// Re-export utility types for easier access
export type {
	ErrorHandler,
	ErrorLogger,
	ErrorNotifier,
} from './utils/errorHandling';
export type { Localizer } from './utils/localization';
export type {
	PerformanceMetrics,
	PerformanceMonitor,
	PerformanceThresholds,
} from './utils/performance';
