import * as fmprpc from 'framed-msgpack-rpc'
import {ClientInterface, MethodID, ProtocolUniqueID, ErrorUnwrapper} from './protocol'

export abstract class ConnOpts {
  abstract opts(): fmprpc.TransportOpts
}

export class NetConnOpts implements ConnOpts {
  host: string
  port: number
  nullLog: boolean
  constructor(host: string, port: number, opts: {nullLog?: boolean} = {}) {
    this.host = host
    this.port = port
    this.nullLog = !!opts.nullLog
  }
  opts() {
    return {
      port: this.port,
      host: this.host,
      path: undefined,
      log_obj: this.nullLog ? fmprpc.nullLogger : undefined,
    }
  }
}

export class UnixConnOpts implements ConnOpts {
  path: string
  nullLog: boolean
  constructor(path: string, opts: {nullLog?: boolean} = {}) {
    this.path = path
    this.nullLog = !!opts.nullLog
  }
  opts() {
    return {
      port: undefined,
      host: undefined,
      path: this.path,
      log_obj: this.nullLog ? fmprpc.nullLogger : undefined,
    }
  }
}

export class Client implements ClientInterface {
  co: ConnOpts

  private xprt: fmprpc.Transport | undefined
  private cli: fmprpc.Client | undefined

  constructor(co: ConnOpts, eu?: ErrorUnwrapper) {
    this.co = co
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const xprt = new fmprpc.RobustTransport(this.co.opts(), {})
      xprt.connect((err: any) => {
        if (err) {
          reject(err)
        } else {
          this.xprt = xprt
          resolve()
        }
      })
    })
  }

  close(): void {
    this.xprt?.close()
  }

  call(protocol: ProtocolUniqueID, method: MethodID, args: any[], eu: ErrorUnwrapper): Promise<any> {
    const xprt = this.xprt
    if (xprt === undefined) {
      throw new Error('not connected')
    }
    return new Promise((resolve, reject) => {
      xprt.invoke(
        {
          program: protocol.export(),
          method: method,
          args: args,
        },
        (err: any, res: any) => {
          if (err) {
            reject(eu(err))
          } else {
            resolve(res)
          }
        },
      )
    })
  }
}
