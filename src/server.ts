import * as fmprpc from 'framed-msgpack-rpc'
import {Protocol, ProtocolUniqueID, newProtocolUniqueID, Exportable} from './protocol'

export type Transport = fmprpc.Transport

export class Handler {
  xprt: Transport
  constructor(xprt: Transport) {
    this.xprt = xprt
  }
}

export type Newable<T> = {new (...args: any[]): T}

function cookProt(p: Protocol): fmprpc.Protocol {
  const ret: fmprpc.Protocol = {}
  p.methods.forEach((v, k) => {
    ret[k] = (arg: any, res: fmprpc.Result) => {
      v.handler(arg)
        .then((r: any) => {
          res.result(r)
        })
        .catch((e: any) => {
          const werr = p.errorWrapper(e)?.export()
          res.error(werr)
        })
    }
  })
  return ret
}

export class ErrMethodNotFound extends Error {
  protocol: ProtocolUniqueID
  method: number
  constructor(program: ProtocolUniqueID | string, method: number) {
    super(`method not found: ${newProtocolUniqueID(program).value}.${method}`)
    this.protocol = newProtocolUniqueID(program)
    this.method = method
  }
}

export class ErrProtocolNotFound extends Error {
  protocol: ProtocolUniqueID
  constructor(program: ProtocolUniqueID | string) {
    super(`program not found: ${program}`)
    this.protocol = newProtocolUniqueID(program)
  }
}

export class Server<T extends Handler> {
  listener: fmprpc.Listener
  port: number | undefined
  protocols: ((handler: T) => Protocol)[]
  klass: Newable<T>
  errorWrapper?: (e: Error | null) => Exportable
  constructor(
    opts: {
      port?: number | undefined
      host: string | undefined
      path: string | undefined
      nullLog?: boolean
      errorWrapper?: (e: Error | null) => Exportable
    },
    protocols: ((handler: T) => Protocol)[],
    klass: Newable<T>,
  ) {
    if (protocols.length === 0) {
      throw new Error('no protocols')
    }
    this.protocols = protocols
    this.port = opts.port
    this.listener = new fmprpc.Listener({
      port: opts.port,
      host: opts.host,
      path: opts.path,
      TransportClass: undefined,
      log_obj: opts.nullLog ? fmprpc.nullLogger : undefined,
      tls_opts: undefined,
      hooks: undefined,
      dbgr: undefined,
      connect_timeout: undefined,
      got_new_connection_hook: (xprt: Transport) => {
        this.gotNewConnection(xprt)
      },
    })
    this.klass = klass
    this.errorWrapper = opts.errorWrapper
  }

  listen(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.listener.listen((err: any) => {
        if (err) {
          reject(err)
        } else {
          this.port = this.listener.get_port()
          resolve()
        }
      })
    })
  }

  protected makeNewHandler(xprt: Transport): T {
    return new this.klass(xprt)
  }

  private gotNewConnection(xprt: Transport) {
    const h = this.makeNewHandler(xprt)
    const protocols = this.protocols.map((p) => p(h))

    if (protocols.length === 0) {
      throw new Error('no protocols')
    }

    const errorWrapper = this.errorWrapper || protocols[0].errorWrapper
    xprt.set_error_wrapper((e: Error) => {
      const we = errorWrapper(e)
      const ret = we ? we.export() : undefined
      return ret
    })

    xprt.set_method_not_found_error_maker((p, m) => new ErrMethodNotFound(p, m))
    xprt.set_program_not_found_error_maker((p) => new ErrProtocolNotFound(p))

    protocols.forEach((prot) => {
      const cooked = cookProt(prot)
      xprt.add_program(prot.id.export() + '', cooked)
    })
  }

  stop(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.listener.close((err: any) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }
}
