export interface Encoder {
  encode(arg0: any): void
}
export interface Decoder {
  decoder(): any
}

export class VariantError extends Error {
  constructor(msg: string) {
    super(msg)
  }
}
export class ImportError extends Error {
  constructor(msg: string) {
    super(msg)
  }
}

export type encoder = (arg0: any) => Uint8Array
export type decoder = (arg0: Uint8Array) => any

export interface Decoder {
  decode(): any
}

export function cropBlob(b: Uint8Array, n: number | null | undefined): Uint8Array {
  if (n === null || n === undefined || b.length === n) {
    return b
  }
  if (b.length > n) {
    return b.slice(0, n)
  }
  const ret = new Uint8Array(n)
  ret.set(b)
  return ret
}

const uint32max = 0x100000000
const int32max = 0x80000000
const int32min = -1 * int32max

export type Brand<K, T> = K & {__brand: T}

export abstract class Exportable {
  abstract export(): any
}

export abstract class Cryptoable extends Exportable {
  abstract id(): TypeUniqueID
}

export class Uint64 implements Exportable {
  value: bigint
  constructor(v: bigint | string | number | Uint64) {
    if (v instanceof Uint64) {
      this.value = v.value
    } else {
      this.value = BigInt(v)
    }
    if (this.value < BigInt(0)) {
      throw new ImportError('cannot import negative number as uint64')
    }
  }
  export(): bigint | number {
    const v = this.value
    return v >= BigInt(uint32max) ? v : Number(v)
  }
}

export type ProtocolUniqueID = Brand<Uint64, 'ProtocolUniqueID'>
export type TypeUniqueID = Brand<Uint64, 'TypeUniqueID'>
export type MethodID = Brand<number, 'MethodID'>

export function newProtocolUniqueID(v: Uint64 | bigint | string | number): ProtocolUniqueID {
  return new Uint64(v) as ProtocolUniqueID
}

export function newMethodID(v: number): MethodID {
  return v as MethodID
}

export class exporters {
  static int(a: bigint): any {
    return a >= BigInt(int32min) && a <= BigInt(int32max) ? Number(a) : a
  }
  static uint(a: bigint): any {
    return a >= BigInt(uint32max) ? a : Number(a)
  }
}

export class importers {
  static int(a: any): bigint {
    switch (typeof a) {
      case 'number':
        return BigInt(a)
      case 'bigint':
        return a
      default:
        throw new ImportError(`cannot convert field to int`)
    }
  }

  static uint(a: any): bigint {
    const negerr = new ImportError("can't import negative number as uint")
    switch (typeof a) {
      case 'number':
        if (a < 0) {
          throw negerr
        }
        return BigInt(a)
      case 'bigint':
        if (a < BigInt(0)) {
          throw negerr
        }
        return a
      default:
        throw new ImportError(`cannot convert field to uint`)
    }
  }
  static string(a: any): string {
    const t = typeof a
    if (t !== 'string') {
      throw new ImportError(`cannot import string field, wrong type given (${t})`)
    }
    return a as string
  }

  static bool(a: any): boolean {
    const t = typeof a
    if (t !== 'boolean') {
      throw new ImportError(`cannot import boolean field, wrong type given (${t})`)
    }
    return a as boolean
  }

  static blob(a: any): Uint8Array {
    if (!(a instanceof Uint8Array)) {
      throw new ImportError('expected a Uint8Array for decoded blob')
    }
    return Buffer.from(a)
  }

  static enum(a: any, d: {[s: number]: string}): number {
    if (typeof a !== 'number') {
      throw new ImportError('exepcted a number type in enum')
    }
    const ret = a as number
    if (d[ret] === undefined) {
      throw new ImportError(`enum value ${ret} is out of range`)
    }
    return ret
  }
}

export class FixedBuffer implements Exportable {
  b: Uint8Array
  c: number
  constructor(b: Uint8Array) {
    this.b = b
    this.c = b.length
  }
  export(): any {
    if (this.b.length > this.c) {
      return this.b.slice(0, this.c)
    }
    const ret = new Uint8Array(this.c)
    ret.set(this.b)
    return ret
  }
  static import(a: any, c: number): FixedBuffer {
    if (!(a instanceof Uint8Array)) {
      throw new ImportError('expected a Uint8Array for decoded blob')
    }
    if (a.length != c) {
      throw new ImportError(`execpted blob of length ${a.length} but got ${c}`)
    }
    return new FixedBuffer(a)
  }
  buf(): Buffer {
    return Buffer.from(this.b)
  }
}

export function extend(v: any[], n: number): any[] {
  while (v.length < n) {
    v.push(null)
  }
  return v
}

export type ErrorUnwrapper = (e: any) => Error | null

export interface ClientInterface {
  call(protocol: ProtocolUniqueID, method: MethodID, arg: any[], eu: ErrorUnwrapper): Promise<any>
}

export type MethodDescription = {
  handler: (arg: any[]) => Promise<any>
  name: string
}

export type Protocol = {
  name: string
  id: ProtocolUniqueID
  methods: Map<MethodID, MethodDescription>
  errorWrapper: (err: Error | null) => Exportable
}
