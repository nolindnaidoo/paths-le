import * as vscode from 'vscode'

export function registerSortCommand(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand('paths-le.postProcess.sort', async () => {
    const editor = vscode.window.activeTextEditor
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found')
      return
    }

    // Prompt user for sort order
    const sortOrder = await vscode.window.showQuickPick(
      [
        { label: 'Alphabetical (A → Z)', value: 'asc' },
        { label: 'Alphabetical (Z → A)', value: 'desc' },
        { label: 'By Length (Short → Long)', value: 'length-asc' },
        { label: 'By Length (Long → Short)', value: 'length-desc' },
      ],
      { placeHolder: 'Select sort order' },
    )

    if (!sortOrder) {
      return // User cancelled
    }

    try {
      const document = editor.document
      const text = document.getText()
      const lines = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

      let sorted: string[]
      if (sortOrder.value === 'length-asc' || sortOrder.value === 'length-desc') {
        sorted = [...lines].sort((a, b) => {
          return sortOrder.value === 'length-asc' ? a.length - b.length : b.length - a.length
        })
      } else {
        sorted = [...lines].sort((a, b) => {
          return sortOrder.value === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
        })
      }

      // Replace document content
      const edit = new vscode.WorkspaceEdit()
      edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), sorted.join('\n'))
      await vscode.workspace.applyEdit(edit)

      vscode.window.showInformationMessage(`Sorted ${sorted.length} paths (${sortOrder.label})`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred'
      vscode.window.showErrorMessage(`Sorting failed: ${message}`)
    }
  })

  context.subscriptions.push(command)
}
