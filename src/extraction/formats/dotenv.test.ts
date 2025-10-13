import { describe, expect, it } from 'vitest';
import { extractFromDotenv } from './dotenv';

describe('extractFromDotenv', () => {
	it('should extract paths from simple .env file', () => {
		const content = `CONFIG_PATH=/etc/app/config.env
LOG_PATH=./logs/app.log
DATA_PATH=C:\\data\\app.db`;

		const result = extractFromDotenv(content);
		expect(result).toHaveLength(3);
		expect(result[0]?.value).toBe('/etc/app/config.env');
		expect(result[1]?.value).toBe('./logs/app.log');
		expect(result[2]?.value).toBe('C:\\data\\app.db');
	});

	it('should extract paths from quoted values', () => {
		const content = `CONFIG_PATH="/home/user/.config/app.env"
LOG_PATH='./logs/app.log'
DATA_PATH="C:\\\\data\\\\app.db"`;

		const result = extractFromDotenv(content);
		expect(result).toHaveLength(3);
		expect(result[0]?.value).toBe('/home/user/.config/app.env');
		expect(result[1]?.value).toBe('./logs/app.log');
		expect(result[2]?.value).toBe('C:\\data\\app.db');
	});

	it('should skip comments and empty lines', () => {
		const content = `# Configuration paths
CONFIG_PATH=/etc/app/config.env
# Log paths
LOG_PATH=./logs/app.log

# Data paths
DATA_PATH=C:\\data\\app.db`;

		const result = extractFromDotenv(content);
		expect(result).toHaveLength(3);
		expect(result[0]?.value).toBe('/etc/app/config.env');
		expect(result[1]?.value).toBe('./logs/app.log');
		expect(result[2]?.value).toBe('C:\\data\\app.db');
	});

	it('should handle empty content', () => {
		const result = extractFromDotenv('');
		expect(result).toHaveLength(0);
	});

	it('should handle content with only comments', () => {
		const content = `# This is a comment
# Another comment`;
		const result = extractFromDotenv(content);
		expect(result).toHaveLength(0);
	});

	it('should include position information', () => {
		const content = `CONFIG_PATH=/etc/app/config.env
LOG_PATH=./logs/app.log`;

		const result = extractFromDotenv(content);
		expect(result[0]?.position).toEqual({
			line: 1,
			column: 12, // After "CONFIG_PATH="
		});
		expect(result[1]?.position).toEqual({
			line: 2,
			column: 9, // After "LOG_PATH="
		});
	});

	it('should include context information', () => {
		const content = `CONFIG_PATH=/etc/app/config.env`;

		const result = extractFromDotenv(content);
		expect(result[0]?.context).toBe('Environment variable: CONFIG_PATH');
	});

	it('should classify path types correctly', () => {
		const content = `ABSOLUTE_PATH=/etc/app/config.env
RELATIVE_PATH=./logs/app.log
WINDOWS_PATH=C:\\data\\app.db
URL_PATH=https://api.example.com/v1/data`;

		const result = extractFromDotenv(content);
		expect(result[0]?.type).toBe('absolute');
		expect(result[1]?.type).toBe('relative');
		expect(result[2]?.type).toBe('absolute');
		expect(result[3]?.type).toBe('url');
	});

	it('should extract paths from variable names that look like paths', () => {
		const content = `"/etc/app/config.env"=value
"./logs/app.log"=another value`;

		const result = extractFromDotenv(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('/etc/app/config.env');
		expect(result[1]?.value).toBe('./logs/app.log');
		expect(result[0]?.context).toBe('Environment variable name');
		expect(result[1]?.context).toBe('Environment variable name');
	});

	it('should handle mixed quoted and unquoted values', () => {
		const content = `CONFIG_PATH="/etc/app/config.env"
LOG_PATH=./logs/app.log
DATA_PATH='C:\\\\data\\\\app.db'`;

		const result = extractFromDotenv(content);
		expect(result).toHaveLength(3);
		expect(result[0]?.value).toBe('/etc/app/config.env');
		expect(result[1]?.value).toBe('./logs/app.log');
		expect(result[2]?.value).toBe('C:\\data\\app.db');
	});

	it('should handle values with spaces', () => {
		const content = `CONFIG_PATH="/etc/app/config with spaces.env"
LOG_PATH=./logs/app with spaces.log`;

		const result = extractFromDotenv(content);
		expect(result).toHaveLength(2);
		expect(result[0]?.value).toBe('/etc/app/config with spaces.env');
		expect(result[1]?.value).toBe('./logs/app with spaces.log');
	});
});
