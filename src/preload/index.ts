import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('booth', {
  saveSession: (input: { eventName: string; photos: string[]; strip: string; printSheet: string; printLayout: { id: 'single-4x6' | 'two-up-4x6'; width: number; height: number; copiesPerSheet: number }; templateId: string; slotAssignments: Record<string, string> }) => ipcRenderer.invoke('storage:save-session', input),
  listWorkspaces: () => ipcRenderer.invoke('storage:list-workspaces'),
  saveWorkspace: (workspace: unknown) => ipcRenderer.invoke('storage:save-workspace', workspace),
  deleteWorkspace: (id: string) => ipcRenderer.invoke('storage:delete-workspace', id),
  loadSettings: () => ipcRenderer.invoke('storage:load-settings'),
  saveSettings: (value: unknown) => ipcRenderer.invoke('storage:save-settings', value),
  exportImage: (input: { eventName: string; dataUrl: string }) => ipcRenderer.invoke('output:export-image', input),
  listPrinters: () => ipcRenderer.invoke('printer:list'),
  printImage: (input: { printerName: string; dataUrl: string; width: number; height: number; ppi: number; profile: import('../shared/printProfile').PrinterProfile }) => ipcRenderer.invoke('printer:print-image', input),
  driveConnect: () => ipcRenderer.invoke('drive:connect'),
  driveImportOAuthFile: () => ipcRenderer.invoke('drive:import-oauth-file'),
  driveStatus: () => ipcRenderer.invoke('drive:status'),
  driveQueueFrame: (job: unknown) => ipcRenderer.invoke('drive:queue-frame', job),
  drivePrepareFrame: (job: { sessionId: string; sessionName: string; frameId: string; frameName: string; shareFrame: boolean }) => ipcRenderer.invoke('drive:prepare-frame', job),
  driveProcessQueue: () => ipcRenderer.invoke('drive:process-queue'),
  driveFrameLink: (sessionId: string, frameId: string) => ipcRenderer.invoke('drive:frame-link', sessionId, frameId),
  driveSessionFolder: (sessionId: string) => ipcRenderer.invoke('drive:session-folder', sessionId),
  driveSessionLink: (sessionId: string) => ipcRenderer.invoke('drive:session-link', sessionId),
  driveSetSessionSharing: (sessionId: string, enabled: boolean) => ipcRenderer.invoke('drive:session-sharing', sessionId, enabled),
  driveOpenFolder: (url: string) => ipcRenderer.invoke('drive:open-folder', url),
  driveQueueDeletion: (sessionId: string, frameId?: string) => ipcRenderer.invoke('drive:queue-deletion', sessionId, frameId)
})
