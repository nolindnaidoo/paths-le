import * as vscode from 'vscode';
import type { PathsLeError } from '../types';
import { createEnhancedError } from './errorHandling';

export interface PerformanceMetrics {
	readonly duration: number;
	readonly memoryUsage: number;
	readonly cpuUsage: number;
	readonly throughput: number;
	readonly cacheHits: number;
	readonly cacheMisses: number;
	readonly startTime: number;
	readonly endTime: number;
}

export interface PerformanceThresholds {
	readonly maxDuration: number;
	readonly maxMemoryUsage: number;
	readonly maxCpuUsage: number;
	readonly minThroughput: number;
	readonly maxCacheSize: number;
}

export interface PerformanceTimer {
	readonly start: () => void;
	readonly end: () => PerformanceMetrics;
	readonly getElapsed: () => number;
	readonly isRunning: boolean;
}

export interface PerformanceMonitor {
	readonly startTimer: (name: string) => PerformanceTimer;
	readonly endTimer: (timer: PerformanceTimer) => PerformanceMetrics;
	readonly checkThresholds: (
		metrics: PerformanceMetrics,
	) => PerformanceCheckResult;
	readonly createProgressReporter: (
		title: string,
		cancellable?: boolean,
	) => ProgressReporter;
	readonly createCache: <K, V>(maxSize?: number) => PerformanceCache<K, V>;
	readonly getMetrics: () => readonly PerformanceMetrics[];
	readonly clearMetrics: () => void;
	readonly generateReport: () => string;
}

export interface PerformanceCheckResult {
	readonly passed: boolean;
	readonly warnings: readonly PerformanceWarning[];
	readonly errors: readonly PathsLeError[];
}

export interface PerformanceWarning {
	readonly type: 'duration' | 'memory' | 'cpu' | 'throughput' | 'cache';
	readonly message: string;
	readonly value: number;
	readonly threshold: number;
	readonly severity: 'warning' | 'error';
}

export interface ProgressReporter {
	readonly report: (message: string, increment?: number) => void;
	readonly done: () => void;
	readonly cancel: () => void;
}

export interface PerformanceCache<K, V> {
	readonly get: (key: K) => V | undefined;
	readonly set: (key: K, value: V) => void;
	readonly has: (key: K) => boolean;
	readonly delete: (key: K) => boolean;
	readonly clear: () => void;
	readonly size: number;
	readonly maxSize: number;
	readonly getStats: () => { hits: number; misses: number; hitRate: number };
}

export function createPerformanceMonitor(): PerformanceMonitor {
	const metrics: PerformanceMetrics[] = [];
	const timers = new Map<string, PerformanceTimer>();

	return Object.freeze({
		startTimer(name: string): PerformanceTimer {
			const timer = createTimer(name);
			timers.set(name, timer);
			return timer;
		},

		endTimer(timer: PerformanceTimer): PerformanceMetrics {
			const metrics = timer.end();
			this.metrics.push(metrics);
			return metrics;
		},

		checkThresholds(metrics: PerformanceMetrics): PerformanceCheckResult {
			const warnings: PerformanceWarning[] = [];
			const errors: PathsLeError[] = [];
			const thresholds = createDefaultThresholds();

			// Check duration
			if (metrics.duration > thresholds.maxDuration) {
				const warning: PerformanceWarning = {
					type: 'duration',
					message: `Duration ${formatDuration(metrics.duration)} exceeds threshold ${formatDuration(
						thresholds.maxDuration,
					)}`,
					value: metrics.duration,
					threshold: thresholds.maxDuration,
					severity: 'warning',
				};
				warnings.push(warning);
			}

			// Check memory usage
			if (metrics.memoryUsage > thresholds.maxMemoryUsage) {
				const warning: PerformanceWarning = {
					type: 'memory',
					message: `Memory usage ${formatBytes(
						metrics.memoryUsage,
					)} exceeds threshold ${formatBytes(thresholds.maxMemoryUsage)}`,
					value: metrics.memoryUsage,
					threshold: thresholds.maxMemoryUsage,
					severity: 'warning',
				};
				warnings.push(warning);
			}

			// Check CPU usage
			if (metrics.cpuUsage > thresholds.maxCpuUsage) {
				const warning: PerformanceWarning = {
					type: 'cpu',
					message: `CPU usage ${formatDuration(
						metrics.cpuUsage,
					)} exceeds threshold ${formatDuration(thresholds.maxCpuUsage)}`,
					value: metrics.cpuUsage,
					threshold: thresholds.maxCpuUsage,
					severity: 'warning',
				};
				warnings.push(warning);
			}

			// Check throughput
			if (metrics.throughput < thresholds.minThroughput) {
				const warning: PerformanceWarning = {
					type: 'throughput',
					message: `Throughput ${formatThroughput(
						metrics.throughput,
					)} below threshold ${formatThroughput(thresholds.minThroughput)}`,
					value: metrics.throughput,
					threshold: thresholds.minThroughput,
					severity: 'warning',
				};
				warnings.push(warning);
			}

			// Create performance error if thresholds severely exceeded
			if (metrics.duration > thresholds.maxDuration * 2) {
				errors.push(
					createEnhancedError(
						new Error(
							`Severe performance degradation: ${formatDuration(metrics.duration)}`,
						),
						'operational',
						{ metrics, thresholds },
						{
							severity: 'high',
							suggestion:
								'Consider optimizing the operation or increasing performance thresholds',
						},
					) as unknown as PathsLeError,
				);
			}

			return Object.freeze({
				passed: warnings.length === 0 && errors.length === 0,
				warnings: Object.freeze(warnings),
				errors: Object.freeze(errors),
			});
		},

		createProgressReporter(
			_title: string,
			cancellable: boolean = false,
		): ProgressReporter {
			let progress:
				| vscode.Progress<{ message?: string; increment?: number }>
				| undefined;
			let token: vscode.CancellationTokenSource | undefined;

			if (cancellable) {
				token = new vscode.CancellationTokenSource();
			}

			return Object.freeze({
				report(message: string, increment?: number): void {
					if (progress) {
						const progressReport: { message: string; increment?: number } = {
							message,
						};
						if (increment !== undefined) progressReport.increment = increment;
						progress.report(progressReport);
					}
				},

				done(): void {
					if (token) {
						token.dispose();
					}
				},

				cancel(): void {
					if (token) {
						token.cancel();
					}
				},
			});
		},

		createCache<K, V>(maxSize: number = 1000): PerformanceCache<K, V> {
			return createPerformanceCache<K, V>(maxSize);
		},

		getMetrics(): readonly PerformanceMetrics[] {
			return Object.freeze([...metrics]);
		},

		clearMetrics(): void {
			metrics.length = 0;
		},

		generateReport(): string {
			if (metrics.length === 0) {
				return 'No performance metrics available.';
			}

			const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
			const avgDuration = totalDuration / metrics.length;
			const totalMemory = metrics.reduce((sum, m) => sum + m.memoryUsage, 0);
			const avgMemory = totalMemory / metrics.length;
			const totalThroughput = metrics.reduce((sum, m) => sum + m.throughput, 0);
			const avgThroughput = totalThroughput / metrics.length;

			return `
Performance Report
==================

Summary:
- Total operations: ${metrics.length}
- Average duration: ${formatDuration(avgDuration)}
- Average memory usage: ${formatBytes(avgMemory)}
- Average throughput: ${formatThroughput(avgThroughput)}

Recent Operations:
${metrics
	.slice(-10)
	.map(
		(m, i) =>
			`${i + 1}. Duration: ${formatDuration(m.duration)}, Memory: ${formatBytes(
				m.memoryUsage,
			)}, Throughput: ${formatThroughput(m.throughput)}`,
	)
	.join('\n')}
			`.trim();
		},
	});
}

export function createPerformanceCache<K, V>(
	maxSize: number = 1000,
): PerformanceCache<K, V> {
	const cache = new Map<K, V>();
	let hits = 0;
	let misses = 0;

	return Object.freeze({
		get(key: K): V | undefined {
			if (cache.has(key)) {
				hits++;
				return cache.get(key);
			}
			misses++;
			return undefined;
		},

		set(key: K, value: V): void {
			if (cache.size >= maxSize) {
				// Remove oldest entry (simple LRU)
				const firstKey = cache.keys().next().value;
				if (firstKey !== undefined) {
					cache.delete(firstKey);
				}
			}
			cache.set(key, value);
		},

		has(key: K): boolean {
			return cache.has(key);
		},

		delete(key: K): boolean {
			return cache.delete(key);
		},

		clear(): void {
			cache.clear();
			hits = 0;
			misses = 0;
		},

		get size(): number {
			return cache.size;
		},

		get maxSize(): number {
			return maxSize;
		},

		getStats(): { hits: number; misses: number; hitRate: number } {
			const total = hits + misses;
			return {
				hits,
				misses,
				hitRate: total > 0 ? hits / total : 0,
			};
		},
	});
}

export function withProgress<T>(
	title: string,
	task: (progress: ProgressReporter) => Promise<T>,
	cancellable: boolean = false,
): Promise<T> {
	return new Promise((resolve, reject) => {
		vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title,
				cancellable,
			},
			async (_progress, token) => {
				try {
					const progressReporter = createProgressReporter(title, cancellable);

					if (token.isCancellationRequested) {
						progressReporter.cancel();
						reject(new Error('Operation cancelled'));
						return;
					}

					token.onCancellationRequested(() => {
						progressReporter.cancel();
					});

					const result = await task(progressReporter);
					progressReporter.done();
					resolve(result);
				} catch (error) {
					reject(error);
				}
			},
		);
	});
}

export function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
): Promise<T> {
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => {
			reject(new Error(`Operation timed out after ${timeoutMs}ms`));
		}, timeoutMs);

		promise
			.then((result) => {
				clearTimeout(timeout);
				resolve(result);
			})
			.catch((error) => {
				clearTimeout(timeout);
				reject(error);
			});
	});
}

export function withCancellation<T>(
	promise: Promise<T>,
	cancellationToken: vscode.CancellationToken,
): Promise<T> {
	return new Promise((resolve, reject) => {
		if (cancellationToken.isCancellationRequested) {
			reject(new Error('Operation cancelled'));
			return;
		}

		const cancellationListener = cancellationToken.onCancellationRequested(
			() => {
				reject(new Error('Operation cancelled'));
			},
		);

		promise
			.then((result) => {
				cancellationListener.dispose();
				resolve(result);
			})
			.catch((error) => {
				cancellationListener.dispose();
				reject(error);
			});
	});
}

export function withPerformanceMonitoring<T>(
	operation: () => Promise<T>,
	_operationName: string,
	expectedItems?: number,
): Promise<{
	result: T;
	metrics: PerformanceMetrics;
	check: PerformanceCheckResult;
}> {
	return new Promise((resolve, reject) => {
		const startTime = Date.now();
		const startMemory = process.memoryUsage().heapUsed;
		const _startCpu = process.cpuUsage();

		operation()
			.then((result) => {
				const endTime = Date.now();
				const endMemory = process.memoryUsage().heapUsed;
				const endCpu = process.cpuUsage();

				const duration = endTime - startTime;
				const memoryUsage = endMemory - startMemory;
				const cpuUsage = (endCpu.user + endCpu.system) / 1000; // Convert to milliseconds
				const throughput = expectedItems
					? (expectedItems / duration) * 1000
					: 0;

				const metrics: PerformanceMetrics = Object.freeze({
					duration,
					memoryUsage,
					cpuUsage,
					throughput,
					cacheHits: 0,
					cacheMisses: 0,
					startTime,
					endTime,
				});

				const monitor = createPerformanceMonitor();
				const check = monitor.checkThresholds(metrics);

				resolve({ result, metrics, check });
			})
			.catch((error) => {
				reject(error);
			});
	});
}

export function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export function formatDuration(milliseconds: number): string {
	if (milliseconds < 1000) {
		return `${milliseconds}ms`;
	}

	const seconds = milliseconds / 1000;
	if (seconds < 60) {
		return `${seconds.toFixed(2)}s`;
	}

	const minutes = seconds / 60;
	if (minutes < 60) {
		return `${minutes.toFixed(2)}m`;
	}

	const hours = minutes / 60;
	return `${hours.toFixed(2)}h`;
}

export function formatThroughput(throughput: number): string {
	if (throughput < 1000) {
		return `${throughput.toFixed(0)} items/s`;
	}

	const k = throughput / 1000;
	if (k < 1000) {
		return `${k.toFixed(1)}K items/s`;
	}

	const m = k / 1000;
	return `${m.toFixed(1)}M items/s`;
}

export function getCpuUsage(): number | undefined {
	try {
		const usage = process.cpuUsage();
		return (usage.user + usage.system) / 1000; // Convert to milliseconds
	} catch {
		return undefined;
	}
}

export function createDefaultThresholds(): PerformanceThresholds {
	return Object.freeze({
		maxDuration: 5000, // 5 seconds
		maxMemoryUsage: 100 * 1024 * 1024, // 100MB
		maxCpuUsage: 1000, // 1 second
		minThroughput: 1000, // 1000 items per second
		maxCacheSize: 1000, // 1000 entries
	});
}

export function createPerformanceReport(metrics: PerformanceMetrics): string {
	return `
Performance Metrics
==================

Duration: ${formatDuration(metrics.duration)}
Memory Usage: ${formatBytes(metrics.memoryUsage)}
CPU Usage: ${formatDuration(metrics.cpuUsage)}
Throughput: ${formatThroughput(metrics.throughput)}
Cache Hits: ${metrics.cacheHits}
Cache Misses: ${metrics.cacheMisses}
Hit Rate: ${
		metrics.cacheHits + metrics.cacheMisses > 0
			? (
					(metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) *
					100
				).toFixed(2)
			: '0'
	}%
	`.trim();
}

export function generatePerformanceReport(
	metrics: PerformanceMetrics[],
): string {
	if (metrics.length === 0) {
		return 'No performance metrics available.';
	}

	const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
	const avgDuration = totalDuration / metrics.length;
	const totalMemory = metrics.reduce((sum, m) => sum + m.memoryUsage, 0);
	const avgMemory = totalMemory / metrics.length;
	const totalThroughput = metrics.reduce((sum, m) => sum + m.throughput, 0);
	const avgThroughput = totalThroughput / metrics.length;

	return `
Performance Report
==================

Summary:
- Total operations: ${metrics.length}
- Average duration: ${formatDuration(avgDuration)}
- Average memory usage: ${formatBytes(avgMemory)}
- Average throughput: ${formatThroughput(avgThroughput)}

Recent Operations:
${metrics
	.slice(-10)
	.map(
		(m, i) =>
			`${i + 1}. Duration: ${formatDuration(m.duration)}, Memory: ${formatBytes(
				m.memoryUsage,
			)}, Throughput: ${formatThroughput(m.throughput)}`,
	)
	.join('\n')}
	`.trim();
}

function createTimer(_name: string): PerformanceTimer {
	let startTime: number | undefined;
	let endTime: number | undefined;
	let startMemory: number | undefined;
	let endMemory: number | undefined;
	let startCpu: NodeJS.CpuUsage | undefined;
	let endCpu: NodeJS.CpuUsage | undefined;

	return Object.freeze({
		start(): void {
			startTime = Date.now();
			startMemory = process.memoryUsage().heapUsed;
			startCpu = process.cpuUsage();
		},

		end(): PerformanceMetrics {
			if (!startTime) {
				throw new Error('Timer not started');
			}

			endTime = Date.now();
			endMemory = process.memoryUsage().heapUsed;
			endCpu = process.cpuUsage();

			const duration = endTime - startTime;
			const memoryUsage = endMemory - (startMemory || 0);
			const cpuUsage =
				startCpu && endCpu
					? (endCpu.user + endCpu.system - startCpu.user - startCpu.system) /
						1000
					: 0;
			const throughput = 0; // Will be calculated by caller

			return Object.freeze({
				duration,
				memoryUsage,
				cpuUsage,
				throughput,
				cacheHits: 0,
				cacheMisses: 0,
				startTime,
				endTime,
			});
		},

		getElapsed(): number {
			if (!startTime) {
				return 0;
			}
			return Date.now() - startTime;
		},

		get isRunning(): boolean {
			return startTime !== undefined && endTime === undefined;
		},
	});
}

function createProgressReporter(
	_title: string,
	cancellable: boolean,
): ProgressReporter {
	let progress:
		| vscode.Progress<{ message?: string; increment?: number }>
		| undefined;
	let token: vscode.CancellationTokenSource | undefined;

	if (cancellable) {
		token = new vscode.CancellationTokenSource();
	}

	return Object.freeze({
		report(message: string, increment?: number): void {
			if (progress) {
				const progressReport: { message: string; increment?: number } = {
					message,
				};
				if (increment !== undefined) progressReport.increment = increment;
				progress.report(progressReport);
			}
		},

		done(): void {
			if (token) {
				token.dispose();
			}
		},

		cancel(): void {
			if (token) {
				token.cancel();
			}
		},
	});
}
