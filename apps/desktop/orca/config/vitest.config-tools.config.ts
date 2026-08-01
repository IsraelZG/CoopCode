import { mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config'

export default mergeConfig(baseConfig, {
  test: {
    include: [
      'config/scripts/**/*.test.ts',
      'config/scripts/**/*.test.mjs',
      'tools/**/*.test.mjs'
    ]
  }
})
