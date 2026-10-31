/**
 * The `paths-le` npm binary: the Rust CLI's surface over the extension's
 * extraction engine. `paths-le mcp` serves the crate's two tools over stdio.
 */
import { name, version } from '../mcp/info';
import { TOOLS } from '../mcp/tools';
import { AUDIT_TOOL } from './auditTool';
import { serve } from './mcp';
import { crateOutput } from './output';
import { run } from './run';

async function readStdin(): Promise<Uint8Array> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
	return Buffer.concat(chunks);
}

function main(args: readonly string[]): void {
	const output = crateOutput(name);
	if (args[0] === 'mcp') {
		// The crate's server stops at the first reply it cannot write.
		process.stdout.once('error', () => output.exit(2, null));
		// A client that reads slowly fills the pipe; the next frame waits until
		// it drains, as the crate's blocking write waits it out. The write goes
		// through the shared output, so a failed pipe is the exit it decides.
		const writeReply = (line: string): Promise<void> | undefined =>
			output.stdout(line)
				? undefined
				: new Promise((resolve) => process.stdout.once('drain', resolve));
		serve(process.stdin, writeReply, { name, version }, [
			...TOOLS,
			AUDIT_TOOL,
		]).then((code) => output.exit(code, null));
		return;
	}
	run(args, {
		stdout: output.stdout,
		stderr: output.stderr,
		stdoutIsTerminal: process.stdout.isTTY === true,
		readStdin,
		cwd: process.cwd(),
		version,
	}).then((code) => output.exit(code, 'could not write the report'));
}

main(process.argv.slice(2));
