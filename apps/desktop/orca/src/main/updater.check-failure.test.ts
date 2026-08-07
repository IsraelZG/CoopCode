import { describe, it } from 'vitest'

describe('updater check failure handling (retired under DEVX-045)', () => {
  it.skip('release-feed check failure tests retired because release checks to stablyai/orca are disabled', () => {
    // Note (DEVX-045): Automatic and manual release update checks to stablyai/orca on GitHub are disabled.
    // The release-feed failure handling path is intentionally unreachable.
  })
})
