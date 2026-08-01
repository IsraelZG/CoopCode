import { ipcMain } from 'electron'
import { listOpenCodeSessions } from '../opencode-sdk/client'

export function registerOpenCodeSdkHandlers(): void {
  ipcMain.handle('opencodeSdk:listSessions', () => listOpenCodeSessions())
}
