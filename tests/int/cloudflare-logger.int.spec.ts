// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createCloudflareLogger } from '@/utilities/cloudflareLogger'

/* The Worker's JSON logger (src/utilities/cloudflareLogger.ts), used as Payload's logger on Cloudflare. */

const lines = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.map(([line]) => JSON.parse(line as string))

describe('Cloudflare logger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('root logger: same JSON lines as before (string, object, object + message), every level written', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const logger = createCloudflareLogger()

    logger.info('hello')
    logger.info({ a: 1 }, 'with fields')
    logger.info({ a: 2, msg: 'own msg' })
    logger.debug('written even below the default level')

    expect(log.mock.calls.map(([line]) => line)).toEqual([
      '{"level":"info","msg":"hello"}',
      '{"level":"info","a":1,"msg":"with fields"}',
      '{"level":"info","a":2,"msg":"own msg"}',
    ])
    expect(lines(debug)).toEqual([{ level: 'debug', msg: 'written even below the default level' }])
  })

  it('child(): adds bindings and the message prefix (what the MCP plugin calls)', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const child = createCloudflareLogger().child({ plugin: 'mcp' }, { msgPrefix: '[plugin-mcp] ' })

    child.error({ err: 'boom' }, 'failed')
    child.error('plain')

    expect(lines(error)).toEqual([
      { err: 'boom', level: 'error', msg: '[plugin-mcp] failed', plugin: 'mcp' },
      { level: 'error', msg: '[plugin-mcp] plain', plugin: 'mcp' },
    ])
  })

  it('child(): only writes at or above its level (the MCP plugin sets "warn")', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const root = createCloudflareLogger()
    const child = root.child({ plugin: 'mcp' })
    child.level = 'warn'

    child.info('hidden')
    child.warn('shown')
    root.info('root still writes info')

    expect(lines(warn)).toEqual([{ level: 'warn', msg: 'shown', plugin: 'mcp' }])
    expect(lines(log)).toEqual([{ level: 'info', msg: 'root still writes info' }])
  })

  it('child of a child keeps both bindings and prefixes; "silent" writes nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const grandchild = createCloudflareLogger().child({ a: 1 }, { msgPrefix: '[a] ' }).child({ b: 2 }, { msgPrefix: '[b] ' })

    grandchild.warn('x')
    grandchild.level = 'silent'
    grandchild.warn('y')

    expect(lines(warn)).toEqual([{ a: 1, b: 2, level: 'warn', msg: '[a] [b] x' }])
  })
})
