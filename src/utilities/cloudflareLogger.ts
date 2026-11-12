const LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const

/**
 * JSON logger for the Worker. Supports pino's `child(bindings, { msgPrefix })`, which plugins use (the MCP plugin
 * calls `payload.logger.child(...)` and then sets the child's `level`). A child only writes messages at or above its
 * `level`; the root logger writes every message, as before.
 */
export const createCloudflareLogger = ({
  bindings = {},
  msgPrefix = '',
  respectLevel = false,
}: { bindings?: object; msgPrefix?: string; respectLevel?: boolean } = {}) => {
  const logger = {
    level: process.env.PAYLOAD_LOG_LEVEL || 'info',
    child: (childBindings: object = {}, options?: { msgPrefix?: string }) =>
      createCloudflareLogger({
        bindings: { ...bindings, ...childBindings },
        msgPrefix: msgPrefix + (options?.msgPrefix ?? ''),
        respectLevel: true,
      }),
    silent: () => { },
  }
  const createLog =
    (level: (typeof LOG_LEVELS)[number], fn: typeof console.log) => (objOrMsg: object | string, msg?: string) => {
      if (
        respectLevel &&
        (logger.level === 'silent' ||
          LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(logger.level as (typeof LOG_LEVELS)[number]))
      ) {
        return
      }
      const fields =
        typeof objOrMsg === 'string'
          ? { msg: objOrMsg }
          : { ...objOrMsg, msg: msg ?? (objOrMsg as { msg?: string }).msg }
      fn(JSON.stringify({ level, ...bindings, ...fields, msg: fields.msg === undefined ? undefined : msgPrefix + fields.msg }))
    }
  return Object.assign(logger, {
    trace: createLog('trace', console.debug),
    debug: createLog('debug', console.debug),
    info: createLog('info', console.log),
    warn: createLog('warn', console.warn),
    error: createLog('error', console.error),
    fatal: createLog('fatal', console.error),
  })
}
