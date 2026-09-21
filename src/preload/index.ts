import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('booth', {
  saveSession: (input: { eventName: string; photos: string[]; strip: string; printSheet: string; printLayout: { id: 'single-4x6' | 'two-up-4x6'; width: number; height: number; copiesPerSheet: number }; templateId: string; slotAssignments: Record<string, string> }) => ipcRenderer.invoke('storage:save-session', input),
  listWorkspaces: () => ipcRenderer.invoke('storage:list-workspaces'),
  saveWorkspace: (workspace: unknown) => ipcRenderer.invoke('storage:save-workspace', workspace),
  deleteWorkspace: (id: string) => ipcRenderer.invoke('storage:delete-workspace', id),
  exportImage: (input: { eventName: string; dataUrl: string }) => ipcRenderer.invoke('output:export-image', input)
})
