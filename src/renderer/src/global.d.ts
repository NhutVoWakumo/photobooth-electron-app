interface SaveSessionInput {
  eventName: string
  photos: string[]
  strip: string
  printSheet: string
  printLayout: {
    id: 'single-4x6' | 'two-up-4x6'
    width: number
    height: number
    copiesPerSheet: number
  }
  templateId: string
  slotAssignments: Record<string, string>
}

interface Window {
  booth?: {
    saveSession: (input: SaveSessionInput) => Promise<{ outputPath: string; printSheetPath: string; sessionPath: string }>
    listWorkspaces: () => Promise<import('./types').BoothSession[]>
    saveWorkspace: (workspace: import('./types').BoothSession) => Promise<void>
    deleteWorkspace: (id: string) => Promise<void>
    loadSettings: () => Promise<unknown | null>
    saveSettings: (settings: unknown) => Promise<void>
    exportImage: (input: { eventName: string; dataUrl: string }) => Promise<{ outputPath: string }>
  }
}
