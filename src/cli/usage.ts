/**
 * The command line's help text and the flags it names.
 *
 * Word for word the Rust CLI's, because both install as `paths-le` and a
 * person reading `--help` cannot tell which one they have.
 * `scripts/check-cli-parity.ts` compares the two outputs, and `cli.test.ts`
 * holds FLAGS equal to the flags this text names.
 */

export const USAGE = `usage: paths-le [options] <file|dir>...
       paths-le [options] --stdin --format <format>
       paths-le mcp
       paths-le --version | --help

Finds every file and directory path in a document and reports whether it
still points at anything. One JSON report per line on stdout when it
is piped or redirected, human summary on stderr.

Options:
  --resolve            check the paths a generic scan found against the
                       filesystem too. A file no format extractor reads
                       is scanned as raw text, and those paths are
                       reported as written unless this is given.
  --no-resolve         report every path as written; skip the filesystem
                       entirely. No path can then be a finding.
  --root <dir>         the boundary a relative path may not escape
                       (default: the enclosing git repository, else the
                       directory argument, else the working directory)
  --deny-symlinks      treat a symlink as a finding too (it is
                       reported either way)
  --format <format>    force a format instead of inferring it from the
                       file name; required with --stdin. A name no
                       extractor answers to is scanned generically.
  --strict             exit 2 if any file could not be read, rather than
                       reporting it and carrying on
  --stdin              read one document from stdin
  --follow-symlinks    resolve through symlinks when walking a tree
                       (default: report the link, do not descend it)
  --hidden             walk hidden files and directories too
  --no-ignore          walk files that .gitignore excludes

Exit codes: 0 clear · 1 findings · 2 malformed question.
For a run over many files, the exit code is the worst outcome in it.`;

export const FLAGS: readonly string[] = Object.freeze([
	'--strict',
	'--resolve',
	'--no-resolve',
	'--root',
	'--deny-symlinks',
	'--format',
	'--stdin',
	'--follow-symlinks',
	'--hidden',
	'--no-ignore',
]);
