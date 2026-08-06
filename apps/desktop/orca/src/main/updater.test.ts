/* eslint-disable max-lines */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  appMock,
  browserWindowMock,
  nativeUpdaterMock,
  autoUpdaterMock,
  isMock,
  killAllPtyMock,
  powerMonitorOnMock
} = vi.hoisted(() => {
  const appEventHandlers = new Map<string, ((...args: unknown[]) => void)[]>()
  const eventHandlers = new Map<string, ((...args: unknown[]) => void)[]>()

  const appOn = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    const handlers = appEventHandlers.get(event) ?? []
    handlers.push(handler)
    appEventHandlers.set(event, handlers)
    return appMock
  })

  const appEmit = (event: string, ...args: unknown[]) => {
    for (const handler of appEventHandlers.get(event) ?? []) {
      handler(...args)
    }
  }

  const on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    const handlers = eventHandlers.get(event) ?? []
    handlers.push(handler)
    eventHandlers.set(event, handlers)
    return autoUpdaterMock
  })

  const emit = (event: string, ...args: unknown[]) => {
    for (const handler of eventHandlers.get(event) ?? []) {
      handler(...args)
    }
  }

  const reset = () => {
    appEventHandlers.clear()
    appOn.mockClear()
    eventHandlers.clear()
    on.mockClear()
    autoUpdaterMock.checkForUpdates.mockReset().mockResolvedValue(null)
    autoUpdaterMock.downloadUpdate.mockReset()
    autoUpdaterMock.quitAndInstall.mockReset()
    autoUpdaterMock.setFeedURL.mockClear()
    autoUpdaterMock.updateConfigPath = undefined
    autoUpdaterMock.allowPrerelease = false
    autoUpdaterMock.allowDowngrade = false
    autoUpdaterMock.disableDifferentialDownload = false
    autoUpdaterMock.autoRunAppAfterInstall = true
    delete (autoUpdaterMock as Record<string, unknown>).verifyUpdateCodeSignature
  }

  const autoUpdaterMock = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    autoRunAppAfterInstall: true,
    allowPrerelease: false,
    allowDowngrade: false,
    disableDifferentialDownload: false,
    on,
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    setFeedURL: vi.fn(),
    updateConfigPath: undefined as string | undefined,
    emit,
    reset
  }

  return {
    appMock: {
      isPackaged: true,
      getVersion: vi.fn(() => '1.0.51'),
      on: appOn,
      emit: appEmit,
      quit: vi.fn()
    },
    browserWindowMock: {
      getAllWindows: vi.fn(() => [])
    },
    nativeUpdaterMock: {
      on: vi.fn()
    },
    autoUpdaterMock,
    isMock: { dev: false },
    killAllPtyMock: vi.fn(),
    powerMonitorOnMock: vi.fn()
  }
})

vi.mock('electron', () => ({
  app: appMock,
  BrowserWindow: browserWindowMock,
  autoUpdater: nativeUpdaterMock,
  powerMonitor: { on: powerMonitorOnMock },
  net: { fetch: vi.fn() }
}))

vi.mock('electron-updater', () => ({
  autoUpdater: autoUpdaterMock
}))

vi.mock('./electron-updater-loader', () => ({
  loadElectronAutoUpdater: () => autoUpdaterMock
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: isMock
}))

vi.mock('./ipc/pty', () => ({
  killAllPty: killAllPtyMock
}))

const { fetchChangelogMock } = vi.hoisted(() => ({
  fetchChangelogMock: vi.fn()
}))

vi.mock('./updater-changelog', () => ({
  fetchChangelog: fetchChangelogMock
}))

const { fetchNudgeMock, shouldApplyNudgeMock } = vi.hoisted(() => ({
  fetchNudgeMock: vi.fn(),
  shouldApplyNudgeMock: vi.fn()
}))

vi.mock('./updater-nudge', () => ({
  fetchNudge: fetchNudgeMock,
  shouldApplyNudge: shouldApplyNudgeMock
}))

const { armExitWatchdogMock, disarmExitWatchdogMock } = vi.hoisted(() => ({
  armExitWatchdogMock: vi.fn(),
  disarmExitWatchdogMock: vi.fn()
}))

vi.mock('./update-install-exit-watchdog', () => ({
  armUpdateInstallExitWatchdog: armExitWatchdogMock,
  disarmUpdateInstallExitWatchdog: disarmExitWatchdogMock
}))

const { fetchNewerReleaseTagsMock } = vi.hoisted(() => ({
  fetchNewerReleaseTagsMock: vi.fn()
}))

const { chooseLocalBuildMock, startLocalBuildFeedMock, closeLocalBuildFeedMock } = vi.hoisted(
  () => ({
    chooseLocalBuildMock: vi.fn(),
    startLocalBuildFeedMock: vi.fn(),
    closeLocalBuildFeedMock: vi.fn()
  })
)

vi.mock('./updater-prerelease-feed', () => ({
  fetchNewerReleaseTagsWithReadiness: async (...args: unknown[]) => {
    const result = await fetchNewerReleaseTagsMock(...args)
    return Array.isArray(result)
      ? { tags: result, state: result.length > 0 ? 'ready' : 'no-newer' }
      : result
  },
  getReleaseDownloadUrl: (tag: string) =>
    `https://github.com/stablyai/orca/releases/download/${tag}`
}))

vi.mock('./local-builds/local-build-switch', () => ({
  chooseLocalBuild: chooseLocalBuildMock
}))

vi.mock('./local-builds/local-build-feed-server', () => ({
  startLocalBuildFeed: startLocalBuildFeedMock
}))

describe('updater', () => {
  beforeEach(() => {
    vi.resetModules()
    autoUpdaterMock.reset()
    nativeUpdaterMock.on.mockReset()
    browserWindowMock.getAllWindows.mockReset()
    browserWindowMock.getAllWindows.mockReturnValue([])
    appMock.getVersion.mockReset()
    appMock.getVersion.mockReturnValue('1.0.51')
    appMock.quit.mockReset()
    appMock.isPackaged = true
    isMock.dev = false
    killAllPtyMock.mockReset()
    armExitWatchdogMock.mockReset()
    disarmExitWatchdogMock.mockReset()
    powerMonitorOnMock.mockReset()
    fetchNudgeMock.mockReset().mockResolvedValue(null)
    shouldApplyNudgeMock.mockReset().mockReturnValue(false)
    fetchChangelogMock.mockReset().mockResolvedValue(null)
    fetchNewerReleaseTagsMock.mockReset().mockResolvedValue([])
    chooseLocalBuildMock.mockReset()
    closeLocalBuildFeedMock.mockReset()
    startLocalBuildFeedMock.mockReset().mockResolvedValue({
      url: 'http://127.0.0.1:1234/token/',
      close: closeLocalBuildFeedMock
    })
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('does not load or configure electron-updater during dev setup', async () => {
    isMock.dev = true
    const mainWindow = { webContents: { send: vi.fn() } }

    const { setupAutoUpdater } = await import('./updater')

    setupAutoUpdater(mainWindow as never)

    // Why: E2E dev-mode launches use a default app version that makes electron-updater throw during module load.
    expect(autoUpdaterMock.updateConfigPath).toBeUndefined()
    expect(autoUpdaterMock.setFeedURL).not.toHaveBeenCalled()
    expect(autoUpdaterMock.checkForUpdates).not.toHaveBeenCalled()
    expect(powerMonitorOnMock).not.toHaveBeenCalled()
  })

  it.runIf(process.platform === 'darwin')(
    'allows a validated local build to downgrade through the normal updater lifecycle',
    async () => {
      chooseLocalBuildMock.mockResolvedValue({
        version: '0.9.0-local.1',
        manifestContent: 'version: 0.9.0-local.1',
        artifacts: new Map()
      })
      autoUpdaterMock.checkForUpdates.mockImplementation(() => {
        autoUpdaterMock.emit('checking-for-update')
        autoUpdaterMock.emit('update-available', { version: '0.9.0-local.1' })
        return Promise.resolve(undefined)
      })
      const send = vi.fn()
      const { setupAutoUpdater, checkForUpdatesFromMenu } = await import('./updater')
      setupAutoUpdater({ webContents: { send } } as never, {
        getLastUpdateCheckAt: () => Date.now()
      })

      checkForUpdatesFromMenu({ localBuild: true })

      await vi.waitFor(() => {
        expect(autoUpdaterMock.checkForUpdates).toHaveBeenCalledTimes(1)
      })
      expect(autoUpdaterMock.allowDowngrade).toBe(true)
      expect(autoUpdaterMock.disableDifferentialDownload).toBe(true)
      expect(autoUpdaterMock.setFeedURL).toHaveBeenLastCalledWith({
        provider: 'generic',
        url: 'http://127.0.0.1:1234/token/'
      })
      await vi.waitFor(() => {
        expect(send).toHaveBeenCalledWith(
          'updater:status',
          expect.objectContaining({
            state: 'available',
            version: '0.9.0-local.1',
            source: 'local'
          })
        )
      })

      setupAutoUpdater({ webContents: { send } } as never, {
        getLastUpdateCheckAt: () => Date.now()
      })
      expect(autoUpdaterMock.setFeedURL).toHaveBeenLastCalledWith({
        provider: 'generic',
        url: 'http://127.0.0.1:1234/token/'
      })
      expect(autoUpdaterMock.allowDowngrade).toBe(true)

      autoUpdaterMock.checkForUpdates.mockResolvedValue(undefined)
      checkForUpdatesFromMenu()
      await vi.waitFor(() => {
        expect(autoUpdaterMock.checkForUpdates).toHaveBeenCalledTimes(2)
      })
      expect(closeLocalBuildFeedMock).toHaveBeenCalledTimes(1)
      expect(autoUpdaterMock.allowDowngrade).toBe(false)
      expect(autoUpdaterMock.disableDifferentialDownload).toBe(false)
    }
  )

  it.runIf(process.platform === 'darwin')(
    'restores ordinary release checks after local build selection fails',
    async () => {
      chooseLocalBuildMock.mockRejectedValue(new Error('invalid local build'))
      const send = vi.fn()
      const { setupAutoUpdater, checkForUpdates, checkForUpdatesFromMenu } =
        await import('./updater')
      setupAutoUpdater({ webContents: { send } } as never, {
        getLastUpdateCheckAt: () => Date.now()
      })

      checkForUpdatesFromMenu({ localBuild: true })
      await vi.waitFor(() => {
        expect(send).toHaveBeenCalledWith('updater:status', {
          state: 'error',
          message: 'invalid local build',
          userInitiated: true,
          source: 'local'
        })
      })

      checkForUpdates()
      await vi.waitFor(() => {
        expect(send).toHaveBeenCalledWith('updater:status', {
          state: 'not-available'
        })
      })
      expect(autoUpdaterMock.allowDowngrade).toBe(false)
      expect(autoUpdaterMock.disableDifferentialDownload).toBe(false)
      expect(autoUpdaterMock.setFeedURL).not.toHaveBeenCalledWith({
        provider: 'generic',
        url: 'https://github.com/stablyai/orca/releases/latest/download'
      })
    }
  )

  it.runIf(process.platform === 'darwin')(
    'restores ordinary release checks after a local build is unavailable',
    async () => {
      chooseLocalBuildMock.mockResolvedValue({
        version: '0.9.0-local.1',
        manifestContent: 'version: 0.9.0-local.1',
        artifacts: new Map()
      })
      autoUpdaterMock.checkForUpdates.mockImplementationOnce(() => {
        autoUpdaterMock.emit('checking-for-update')
        autoUpdaterMock.emit('update-not-available')
        return Promise.resolve(undefined)
      })
      const send = vi.fn()
      const { setupAutoUpdater, checkForUpdates, checkForUpdatesFromMenu } =
        await import('./updater')
      setupAutoUpdater({ webContents: { send } } as never, {
        getLastUpdateCheckAt: () => Date.now()
      })

      checkForUpdatesFromMenu({ localBuild: true })
      await vi.waitFor(() => {
        expect(closeLocalBuildFeedMock).toHaveBeenCalledTimes(1)
      })
      expect(send).toHaveBeenCalledWith('updater:status', {
        state: 'not-available',
        userInitiated: true,
        source: 'local'
      })
      expect(autoUpdaterMock.allowDowngrade).toBe(false)
      expect(autoUpdaterMock.disableDifferentialDownload).toBe(false)

      checkForUpdates()
      await vi.waitFor(() => {
        expect(send).toHaveBeenCalledWith('updater:status', {
          state: 'not-available'
        })
      })
      expect(autoUpdaterMock.setFeedURL).not.toHaveBeenCalledWith({
        provider: 'generic',
        url: 'https://github.com/stablyai/orca/releases/latest/download'
      })
    }
  )

  it.runIf(process.platform === 'darwin')(
    'restores ordinary release checks after a local updater failure',
    async () => {
      chooseLocalBuildMock.mockResolvedValue({
        version: '0.9.0-local.1',
        manifestContent: 'version: 0.9.0-local.1',
        artifacts: new Map()
      })
      autoUpdaterMock.checkForUpdates.mockRejectedValueOnce(new Error('local feed failed'))
      const send = vi.fn()
      const { setupAutoUpdater, checkForUpdates, checkForUpdatesFromMenu } =
        await import('./updater')
      setupAutoUpdater({ webContents: { send } } as never, {
        getLastUpdateCheckAt: () => Date.now()
      })

      checkForUpdatesFromMenu({ localBuild: true })
      await vi.waitFor(() => {
        expect(send).toHaveBeenCalledWith('updater:status', {
          state: 'error',
          message: 'local feed failed',
          userInitiated: true,
          source: 'local'
        })
      })
      expect(closeLocalBuildFeedMock).toHaveBeenCalledTimes(1)
      expect(autoUpdaterMock.allowDowngrade).toBe(false)
      expect(autoUpdaterMock.disableDifferentialDownload).toBe(false)

      checkForUpdates()
      await vi.waitFor(() => {
        expect(send).toHaveBeenCalledWith('updater:status', {
          state: 'not-available'
        })
      })
      expect(autoUpdaterMock.setFeedURL).not.toHaveBeenCalledWith({
        provider: 'generic',
      })
    }
  )

  it('reports automatic: false and updater-unavailable on packaged builds (DEVX-045)', async () => {
    const { getRemoteServerUpdateSupport } = await import('./updater')
    expect(getRemoteServerUpdateSupport()).toEqual({
      installMode: 'interactive',
      automatic: false,
      reason: 'updater-unavailable'
    })
  })

  it('does not schedule automatic update check timers or phone home at startup (DEVX-045)', async () => {
    vi.useFakeTimers()
    const mainWindow = { webContents: { send: vi.fn() } }
    const { setupAutoUpdater } = await import('./updater')

    setupAutoUpdater(mainWindow as never, {
      getLastUpdateCheckAt: () => Date.now() - 30 * 24 * 60 * 60 * 1000
    })

    expect(autoUpdaterMock.setFeedURL).not.toHaveBeenCalled()
    expect(autoUpdaterMock.checkForUpdates).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(30 * 24 * 60 * 60 * 1000)
    expect(autoUpdaterMock.checkForUpdates).not.toHaveBeenCalled()
  })

  it('returns not-available for manual release update check without phoning home (DEVX-045)', async () => {
    const send = vi.fn()
    const mainWindow = { webContents: { send } }
    const { setupAutoUpdater, checkForUpdatesFromMenu } = await import('./updater')

    setupAutoUpdater(mainWindow as never)
    checkForUpdatesFromMenu()

    expect(send).toHaveBeenCalledWith('updater:status', {
      state: 'not-available',
      userInitiated: true
    })
    expect(autoUpdaterMock.setFeedURL).not.toHaveBeenCalled()
    expect(autoUpdaterMock.checkForUpdates).not.toHaveBeenCalled()
  })

  it('returns not-available for background release update check without phoning home (DEVX-045)', async () => {
    const send = vi.fn()
    const mainWindow = { webContents: { send } }
    const { setupAutoUpdater, checkForUpdates } = await import('./updater')

    setupAutoUpdater(mainWindow as never)
    checkForUpdates()

    expect(send).toHaveBeenCalledWith('updater:status', {
      state: 'not-available'
})
    expect(autoUpdaterMock.setFeedURL).not.toHaveBeenCalled()
    expect(autoUpdaterMock.checkForUpdates).not.toHaveBeenCalled()
  })

  it('surfaces an accepted download retry before electron-updater emits download progress', async () => {
    vi.stubGlobal('process', { ...process, platform: 'darwin' })
    chooseLocalBuildMock.mockResolvedValue({
      version: '1.0.61-local',
      manifestContent: 'version: 1.0.61-local',
      artifacts: new Map()
    })
    autoUpdaterMock.checkForUpdates.mockImplementation(() => {
      autoUpdaterMock.emit('checking-for-update')
      autoUpdaterMock.emit('update-available', { version: '1.0.61-local' })
      return Promise.resolve(undefined)
    })
    autoUpdaterMock.downloadUpdate.mockImplementation(() => new Promise(() => {}))
    const sendMock = vi.fn()
    const mainWindow = { webContents: { send: sendMock } }

    const { setupAutoUpdater, checkForUpdatesFromMenu, downloadUpdate } = await import('./updater')

    setupAutoUpdater(mainWindow as never, { getLastUpdateCheckAt: () => Date.now() })
    checkForUpdatesFromMenu({ localBuild: true })

    await vi.waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith('updater:status', expect.objectContaining({
        state: 'available',
        version: '1.0.61-local'
      }))
    })

    downloadUpdate()

    expect(sendMock).toHaveBeenCalledWith('updater:status', expect.objectContaining({
      state: 'downloading',
      percent: 0,
      version: '1.0.61-local'
    }))

    downloadUpdate()
    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalledTimes(1)
  })

  it('defers quitAndInstall through the shared main-process entrypoint', async () => {
    vi.useFakeTimers()

    const mainWindow = { webContents: { send: vi.fn() } }
    const { setupAutoUpdater, quitAndInstall } = await import('./updater')

    setupAutoUpdater(mainWindow as never)
    quitAndInstall()

    expect(autoUpdaterMock.quitAndInstall).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(99)
    expect(autoUpdaterMock.quitAndInstall).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalledTimes(1)
    expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalledWith(false, true)
  })

  it('runs pre-quit cleanup before local PTY cleanup during update install', async () => {
    vi.useFakeTimers()

    const onBeforeQuit = vi.fn()
    const mainWindow = { webContents: { send: vi.fn() } }
    const { setupAutoUpdater, quitAndInstall } = await import('./updater')

    setupAutoUpdater(mainWindow as never, { onBeforeQuit })
    quitAndInstall()

    await vi.advanceTimersByTimeAsync(100)

    expect(onBeforeQuit).toHaveBeenCalledTimes(1)
    expect(killAllPtyMock).toHaveBeenCalledTimes(1)
    expect(onBeforeQuit.mock.invocationCallOrder[0]).toBeLessThan(
      killAllPtyMock.mock.invocationCallOrder[0]
    )
  })

  it('ignores duplicate quitAndInstall requests while the shared delay is pending', async () => {
    vi.useFakeTimers()

    const mainWindow = { webContents: { send: vi.fn() } }
    const { setupAutoUpdater, quitAndInstall } = await import('./updater')

    setupAutoUpdater(mainWindow as never)
    quitAndInstall()
    quitAndInstall()

    await vi.advanceTimersByTimeAsync(100)

    expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalledTimes(1)
  })

  it('ignores duplicate quitAndInstall requests while async pre-quit cleanup is running', async () => {
    vi.useFakeTimers()

    let finishCleanup!: () => void
    const onBeforeQuit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishCleanup = resolve
        })
    )
    const mainWindow = { webContents: { send: vi.fn() } }
    const { setupAutoUpdater, quitAndInstall } = await import('./updater')

    setupAutoUpdater(mainWindow as never, { onBeforeQuit })
    quitAndInstall()

    await vi.advanceTimersByTimeAsync(100)

    expect(onBeforeQuit).toHaveBeenCalledTimes(1)
    expect(autoUpdaterMock.quitAndInstall).not.toHaveBeenCalled()

    quitAndInstall()
    finishCleanup()
    await vi.advanceTimersByTimeAsync(0)

    expect(onBeforeQuit).toHaveBeenCalledTimes(1)
    expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalledTimes(1)
  })

  it('recovers quit-for-update state on sync quitAndInstall error event without killing PTYs', async () => {
    vi.useFakeTimers()

    autoUpdaterMock.quitAndInstall.mockImplementation(() => {
      autoUpdaterMock.emit(
        'error',
        new Error("No update filepath provided, can't quit and install")
      )
    })

    const sendMock = vi.fn()
    const mainWindow = { webContents: { send: sendMock } }
    const { setupAutoUpdater, quitAndInstall, isQuittingForUpdate } = await import('./updater')

    setupAutoUpdater(mainWindow as never)
    quitAndInstall()

    await vi.advanceTimersByTimeAsync(100)

    expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalledTimes(1)
    expect(isQuittingForUpdate()).toBe(false)
    expect(killAllPtyMock).not.toHaveBeenCalled()
    expect(sendMock).toHaveBeenCalledWith(
      'updater:status',
      expect.objectContaining({
        state: 'error',
        message: 'Could not restart to install the update. Quit and reopen Orca, then try again.'
      })
    )
  })

  it('does not recover quit-for-update state from late errors after install commit', async () => {
    const sendMock = vi.fn()
    const mainWindow = { webContents: { send: sendMock } }

    const { setupAutoUpdater, quitAndInstall, isQuittingForUpdate } =
      await import('./updater')

    setupAutoUpdater(mainWindow as never, { getLastUpdateCheckAt: () => Date.now() })
    autoUpdaterMock.emit('update-available', { version: '1.0.61' })
    autoUpdaterMock.emit('update-downloaded', { version: '1.0.61' })

    if (process.platform === 'darwin') {
      const nativeDownloadedHandler = nativeUpdaterMock.on.mock.calls.find(
        ([eventName]) => eventName === 'update-downloaded'
      )?.[1] as (() => void) | undefined
      nativeDownloadedHandler?.()
    }

    quitAndInstall()
    await vi.waitFor(() => {
      expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalledTimes(1)
    })
    expect(killAllPtyMock).toHaveBeenCalledTimes(1)
    expect(isQuittingForUpdate()).toBe(true)

    sendMock.mockClear()
    autoUpdaterMock.emit('error', new Error('late post-commit install error'))

    expect(isQuittingForUpdate()).toBe(true)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('arms the forced-exit watchdog once the install commits', async () => {
    const sendMock = vi.fn()
    const mainWindow = { webContents: { send: sendMock } }

    const { setupAutoUpdater, quitAndInstall } = await import('./updater')

    setupAutoUpdater(mainWindow as never, { getLastUpdateCheckAt: () => Date.now() })
    autoUpdaterMock.emit('update-available', { version: '1.0.61' })
    autoUpdaterMock.emit('update-downloaded', { version: '1.0.61' })

    if (process.platform === 'darwin') {
      const nativeDownloadedHandler = nativeUpdaterMock.on.mock.calls.find(
        ([eventName]) => eventName === 'update-downloaded'
      )?.[1] as (() => void) | undefined
      nativeDownloadedHandler?.()
    }

    expect(armExitWatchdogMock).not.toHaveBeenCalled()

    quitAndInstall()
    await vi.waitFor(() => {
      expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalledTimes(1)
    })

    expect(armExitWatchdogMock).toHaveBeenCalledTimes(1)
  })

  it('disarms the forced-exit watchdog when sync install error recovery keeps the app open', async () => {
    vi.useFakeTimers()

    autoUpdaterMock.quitAndInstall.mockImplementation(() => {
      autoUpdaterMock.emit(
        'error',
        new Error("No update filepath provided, can't quit and install")
      )
    })

    const mainWindow = { webContents: { send: vi.fn() } }
    const { setupAutoUpdater, quitAndInstall, isQuittingForUpdate } = await import('./updater')

    setupAutoUpdater(mainWindow as never)
    quitAndInstall()

    await vi.advanceTimersByTimeAsync(100)

    expect(isQuittingForUpdate()).toBe(false)
    expect(armExitWatchdogMock).not.toHaveBeenCalled()
    expect(disarmExitWatchdogMock).toHaveBeenCalled()
  })

  it('does not treat pre-native autoUpdater errors as quitAndInstall recovery', async () => {
    vi.useFakeTimers()

    let finishCleanup!: () => void
    const onBeforeQuit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishCleanup = resolve
        })
    )
    const sendMock = vi.fn()
    const mainWindow = { webContents: { send: sendMock } }
    const { setupAutoUpdater, quitAndInstall, isQuittingForUpdate } = await import('./updater')

    setupAutoUpdater(mainWindow as never, {
      onBeforeQuit,
      getLastUpdateCheckAt: () => Date.now()
    })
    quitAndInstall()
    await vi.advanceTimersByTimeAsync(100)

    expect(onBeforeQuit).toHaveBeenCalledTimes(1)
    expect(autoUpdaterMock.quitAndInstall).not.toHaveBeenCalled()
    expect(isQuittingForUpdate()).toBe(true)

    sendMock.mockClear()
    autoUpdaterMock.emit('error', new Error('pre-native concurrent error'))

    expect(isQuittingForUpdate()).toBe(true)
    expect(sendMock).not.toHaveBeenCalled()

    finishCleanup()
    await vi.advanceTimersByTimeAsync(0)

    expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalledTimes(1)
    expect(isQuittingForUpdate()).toBe(true)
  })

  it('does not disable Windows Authenticode verification on win32', async () => {
    vi.stubGlobal('process', { ...process, platform: 'win32' })

    const { setupAutoUpdater } = await import('./updater')

    const sendMock = vi.fn()
    const mainWindow = { webContents: { send: sendMock } }

    setupAutoUpdater(mainWindow as never)

    expect((autoUpdaterMock as Record<string, unknown>).verifyUpdateCodeSignature).toBeUndefined()
  })
})
