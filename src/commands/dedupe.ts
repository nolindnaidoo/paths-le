import * as vscode from 'vscode'

export function registerDedupeCommand(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand(
    'paths-le.postProcess.dedupe',
    async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) {
        vscode.window.showWarningMessage('No active editor found')
        return
      }

      try {
        const document = editor.document
        const text = document.getText()
        const lines = text.split('\n').map((line) => line.trim())

        // Dedupe while preserving order
        const seen = new Set<string>()
        const deduped = lines.filter((line) => {
          if (line === '' || seen.has(line)) {
            return false
          }
          seen.add(line)
          return true
        })

        // Replace document content
        const edit = new vscode.WorkspaceEdit()
        edit.replace(
          document.uri,
          new vscode.Range(0, 0, document.lineCount, 0),
          deduped.join('\n'),
        )
        await vscode.workspace.applyEdit(edit)

        const removedCount = lines.length - deduped.length
        vscode.window.showInformationMessage(
          `Removed ${removedCount} duplicate paths (${deduped.length} remaining)`,
        )
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error occurred'
        vscode.window.showErrorMessage(`Deduplication failed: ${message}`)
      }
    },
  )

  context.subscriptions.push(command)
}

