import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import { resolve } from 'path'
import { readdirSync, statSync } from 'fs'
import { extname, join } from 'path'
// protoLoader used by loadPackageForProject (file/folder mode)
import type { IpcMain } from 'electron'
import type { GrpcCallRequest, GrpcCallResponse, GrpcProject } from '../../shared/types'
import { IPC } from '../../shared/types'

// Active call registry for cancellation
const activeCalls = new Map<string, grpc.ClientUnaryCall | grpc.ClientReadableStream<unknown>>()

function flattenMetadata(meta: grpc.Metadata): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, val] of Object.entries(meta.getMap())) {
    result[key] = Buffer.isBuffer(val) ? val.toString('base64') : String(val)
  }
  return result
}

function buildCredentials(project: GrpcProject): grpc.ChannelCredentials {
  if (!project.useTls) return grpc.credentials.createInsecure()
  if (project.tlsCertPath) {
    const { readFileSync } = require('fs')
    const rootCert = readFileSync(project.tlsCertPath)
    return grpc.credentials.createSsl(rootCert)
  }
  return grpc.credentials.createSsl()
}

function buildMetadata(entries: GrpcCallRequest['metadata']): grpc.Metadata {
  const meta = new grpc.Metadata()
  for (const entry of entries) {
    if (entry.enabled && entry.key.trim()) {
      meta.add(entry.key.trim(), entry.value)
    }
  }
  return meta
}

function collectProtoFiles(dirPath: string): string[] {
  const result: string[] = []
  const entries = readdirSync(dirPath)
  for (const entry of entries) {
    const full = join(dirPath, entry)
    if (statSync(full).isDirectory()) {
      result.push(...collectProtoFiles(full))
    } else if (extname(entry) === '.proto') {
      result.push(full)
    }
  }
  return result
}

async function loadPackageForProject(project: GrpcProject): Promise<protoLoader.PackageDefinition> {
  const { protoSource } = project
  let protoFiles: string[] = []
  let includeDirs: string[] = []

  if (protoSource.type === 'file') {
    const absPath = resolve(protoSource.path)
    protoFiles = [absPath]
    includeDirs = [resolve(protoSource.path, '..')]
  } else if (protoSource.type === 'folder') {
    const absDir = resolve(protoSource.path)
    protoFiles = collectProtoFiles(absDir)
    // Include both the parent dir (so "Protos/Shared.proto" style imports work)
    // and the folder itself (so bare "Shared.proto" imports also work)
    includeDirs = [resolve(absDir, '..'), absDir]
  }

  return protoLoader.load(protoFiles, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs
  })
}

// Cache loaded package definitions per project
const packageDefCache = new Map<string, protoLoader.PackageDefinition>()

async function getServiceClient(
  project: GrpcProject,
  fullServiceName: string
): Promise<grpc.Client> {
  let packageDef = packageDefCache.get(project.id)
  if (!packageDef) {
    packageDef = await loadPackageForProject(project)
    packageDefCache.set(project.id, packageDef)
  }

  const grpcObj = grpc.loadPackageDefinition(packageDef)
  const address = `${project.host}:${project.port}`
  const credentials = buildCredentials(project)

  // Navigate nested package path (e.g. "com.example.GreetService")
  const parts = fullServiceName.split('.')
  let current: grpc.GrpcObject | grpc.ServiceClientConstructor | grpc.ProtobufTypeDefinition = grpcObj
  for (const part of parts) {
    if (typeof current === 'object' && current !== null && part in (current as grpc.GrpcObject)) {
      current = (current as grpc.GrpcObject)[part]
    } else {
      throw new Error(`Service "${fullServiceName}" not found in proto definitions`)
    }
  }

  const ServiceClient = current as grpc.ServiceClientConstructor
  return new ServiceClient(address, credentials)
}

export function registerGrpcHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC.GRPC_INVOKE, async (event, req: GrpcCallRequest & { project: GrpcProject }): Promise<GrpcCallResponse> => {
    const { callId, project, serviceName, methodName, payload, metadata, timeoutMs = 30000 } = req
    const start = Date.now()

    // For reflection-based projects, call via dynamic stub
    if (project.protoSource.type === 'reflection') {
      return invokeViaReflection(event, project, serviceName, methodName, payload, metadata, timeoutMs, callId, start)
    }

    try {
      const client = await getServiceClient(project, serviceName)
      const grpcMeta = buildMetadata(metadata)

      return new Promise<GrpcCallResponse>((resolveCall) => {
        const deadline = new Date(Date.now() + timeoutMs)
        let headers: Record<string, string> = {}
        let trailers: Record<string, string> = {}

        const call = (client as unknown as Record<string, Function>)[methodName](
          payload,
          grpcMeta,
          { deadline },
          (err: grpc.ServiceError | null, response: unknown) => {
            activeCalls.delete(callId)
            const durationMs = Date.now() - start
            if (err) {
              if (err.metadata) trailers = { ...trailers, ...flattenMetadata(err.metadata) }
              resolveCall({
                status: 'error',
                error: err.message,
                grpcStatusCode: err.code,
                grpcStatusMessage: err.details,
                durationMs,
                headers,
                trailers
              })
            } else {
              resolveCall({
                status: 'success',
                data: response,
                durationMs,
                headers,
                trailers
              })
            }
          }
        ) as grpc.ClientUnaryCall

        call.on('metadata', (meta: grpc.Metadata) => {
          headers = flattenMetadata(meta)
        })

        call.on('status', (status: grpc.StatusObject) => {
          if (status.metadata) trailers = flattenMetadata(status.metadata)
        })

        activeCalls.set(callId, call)
      })
    } catch (err) {
      return {
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start
      }
    }
  })

  ipcMain.handle(IPC.GRPC_CANCEL, (_event, callId: string) => {
    const call = activeCalls.get(callId)
    if (call) {
      call.cancel()
      activeCalls.delete(callId)
    }
    return { cancelled: true }
  })
}

async function invokeViaReflection(
  _event: Electron.IpcMainInvokeEvent,
  project: GrpcProject,
  serviceName: string,
  methodName: string,
  payload: Record<string, unknown>,
  metadata: GrpcCallRequest['metadata'],
  timeoutMs: number,
  callId: string,
  start: number
): Promise<GrpcCallResponse> {
  try {
    const grpcReflection = await import('grpc-reflection-js')
    const { Root } = await import('protobufjs')
    const address = `${project.host}:${project.port}`
    const creds = project.useTls ? grpc.credentials.createSsl() : grpc.credentials.createInsecure()

    const reflectionClient = new grpcReflection.Client(address, creds)

    // fileContainingSymbol returns a protobufjs Root
    const root: import('protobufjs').Root = await reflectionClient.fileContainingSymbol(serviceName)

    // Look up the service and target method in the Root
    const svc = root.lookupService(serviceName)
    const methodDesc = svc.methods[methodName]
    if (!methodDesc) {
      return {
        status: 'error',
        error: `Method "${methodName}" not found in service "${serviceName}"`,
        durationMs: Date.now() - start
      }
    }

    // Resolve type references so requestType/responseType are populated
    methodDesc.resolve()
    const RequestType = root.lookupType(methodDesc.requestType)
    const ResponseType = root.lookupType(methodDesc.responseType)

    // Build a minimal gRPC service definition using protobufjs for serialization
    const serviceDefinition: grpc.ServiceDefinition = {
      [methodName]: {
        path: `/${serviceName}/${methodName}`,
        requestStream: methodDesc.requestStream ?? false,
        responseStream: methodDesc.responseStream ?? false,
        requestSerialize: (msg: unknown) =>
          Buffer.from(RequestType.encode(RequestType.fromObject(msg as Record<string, unknown>)).finish()),
        requestDeserialize: (buf: Buffer) =>
          ResponseType.decode(buf).toJSON(),
        responseSerialize: (msg: unknown) =>
          Buffer.from(ResponseType.encode(ResponseType.fromObject(msg as Record<string, unknown>)).finish()),
        responseDeserialize: (buf: Buffer) =>
          ResponseType.decode(buf).toJSON()
      }
    }

    const ClientConstructor = grpc.makeGenericClientConstructor(serviceDefinition, serviceName, {})
    const client = new ClientConstructor(address, creds)
    const grpcMeta = buildMetadata(metadata)
    const deadline = new Date(Date.now() + timeoutMs)

    return new Promise<GrpcCallResponse>((resolveCall) => {
      let headers: Record<string, string> = {}
      let trailers: Record<string, string> = {}

      const call = (client as unknown as Record<string, Function>)[methodName](
        payload,
        grpcMeta,
        { deadline },
        (err: grpc.ServiceError | null, response: unknown) => {
          activeCalls.delete(callId)
          const durationMs = Date.now() - start
          if (err) {
            if (err.metadata) trailers = { ...trailers, ...flattenMetadata(err.metadata) }
            resolveCall({
              status: 'error',
              error: err.message,
              grpcStatusCode: err.code,
              grpcStatusMessage: err.details,
              durationMs,
              headers,
              trailers
            })
          } else {
            resolveCall({ status: 'success', data: response, durationMs, headers, trailers })
          }
        }
      ) as grpc.ClientUnaryCall

      call.on('metadata', (meta: grpc.Metadata) => {
        headers = flattenMetadata(meta)
      })

      call.on('status', (status: grpc.StatusObject) => {
        if (status.metadata) trailers = flattenMetadata(status.metadata)
      })

      activeCalls.set(callId, call)
    })
  } catch (err) {
    return {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start
    }
  }
}
