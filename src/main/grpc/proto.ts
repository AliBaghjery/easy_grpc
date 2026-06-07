import * as protoLoader from '@grpc/proto-loader'
import * as grpc from '@grpc/grpc-js'
import * as protobuf from 'protobufjs'
import { readdirSync, statSync, existsSync } from 'fs'
import { join, resolve, extname, dirname } from 'path'
import type { IpcMain, Dialog } from 'electron'
import type { LoadedProto, ProtoService, ProtoMethod, ProtoField, GrpcProject } from '../../shared/types'
import { IPC } from '../../shared/types'

export const protoCache = new Map<string, grpc.GrpcObject>()

// ─── File collection ──────────────────────────────────────────────────────────

function collectProtoFiles(dirPath: string): string[] {
  const result: string[] = []
  for (const entry of readdirSync(dirPath)) {
    const full = join(dirPath, entry)
    if (statSync(full).isDirectory()) {
      result.push(...collectProtoFiles(full))
    } else if (extname(entry) === '.proto') {
      result.push(full)
    }
  }
  return result
}

// ─── Field extraction via protobufjs (proper Type API) ────────────────────────

function extractFieldsFromType(type: protobuf.Type, depth = 0): ProtoField[] {
  if (depth > 8) return []
  return type.fieldsArray.map((f) => {
    const field: ProtoField = {
      name: f.name,
      type: f.resolvedType?.name ?? f.type,
      repeated: f.repeated,
      required: f.required
    }
    if (f.resolvedType instanceof protobuf.Type) {
      field.fields = extractFieldsFromType(f.resolvedType, depth + 1)
    }
    if (f.resolvedType instanceof protobuf.Enum) {
      field.enumValues = Object.keys(f.resolvedType.values)
    }
    return field
  })
}

function extractServicesFromRoot(root: protobuf.Root): ProtoService[] {
  const services: ProtoService[] = []

  function walk(ns: protobuf.ReflectionObject): void {
    if (ns instanceof protobuf.Service) {
      const methods: ProtoMethod[] = ns.methodsArray.map((method) => {
        try { method.resolve() } catch { /* unresolved — skip */ }
        const reqType = method.resolvedRequestType
        return {
          name: method.name,
          requestType: reqType?.name ?? method.requestType,
          responseType: method.resolvedResponseType?.name ?? method.responseType,
          clientStreaming: method.requestStream ?? false,
          serverStreaming: method.responseStream ?? false,
          requestSchema: {},
          responseSchema: {},
          requestFields: reqType instanceof protobuf.Type
            ? extractFieldsFromType(reqType)
            : []
        }
      })
      services.push({
        name: ns.name,
        fullName: ns.fullName.replace(/^\./, ''),
        methods
      })
    }

    if ('nestedArray' in ns && Array.isArray((ns as protobuf.Namespace).nestedArray)) {
      for (const child of (ns as protobuf.Namespace).nestedArray) {
        walk(child)
      }
    }
  }

  walk(root)
  return services
}

// ─── Load from file / folder ─────────────────────────────────────────────────

async function loadFromFiles(project: GrpcProject): Promise<LoadedProto> {
  const { protoSource } = project
  let protoFiles: string[] = []

  if (protoSource.type === 'file') {
    protoFiles = [resolve(protoSource.path)]
  } else if (protoSource.type === 'folder') {
    protoFiles = collectProtoFiles(resolve(protoSource.path))
  }

  if (protoFiles.length === 0) {
    return { projectId: project.id, services: [], error: 'No .proto files found' }
  }

  const parentDir = protoSource.type === 'folder'
    ? resolve(protoSource.path, '..')
    : resolve(protoSource.path, '..')
  const selfDir = resolve(protoSource.type === 'folder' ? protoSource.path : dirname(protoSource.path))
  const includeDirs = [parentDir, selfDir]

  // ① proto-loader: needed for grpc.loadPackageDefinition (making actual calls)
  const packageDef = await protoLoader.load(protoFiles, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs
  })
  const grpcObj = grpc.loadPackageDefinition(packageDef)
  protoCache.set(project.id, grpcObj)

  // ② protobufjs: load the same files to get proper Type objects with real fieldsArray
  const pbRoot = new protobuf.Root()
  pbRoot.resolvePath = (_origin: string, target: string): string => {
    if (existsSync(target)) return target
    for (const dir of includeDirs) {
      const candidate = resolve(dir, target)
      if (existsSync(candidate)) return candidate
    }
    return target
  }
  await pbRoot.load(protoFiles, { keepCase: true })
  pbRoot.resolveAll()

  const services = extractServicesFromRoot(pbRoot)
  return { projectId: project.id, services }
}

// ─── Load via server reflection ───────────────────────────────────────────────

const REFLECTION_SYSTEM_SERVICES = [
  'grpc.reflection.v1alpha.ServerReflection',
  'grpc.reflection.v1.ServerReflection'
]

function buildReflectionFields(root: protobuf.Root, typeName: string, depth = 0): ProtoField[] {
  if (depth > 8) return []
  try {
    const msgType = root.lookupType(typeName)
    msgType.resolveAll()
    return msgType.fieldsArray.map((f) => {
      const field: ProtoField = {
        name: f.name,
        type: f.resolvedType?.name ?? f.type,
        repeated: f.repeated,
        required: f.required
      }
      if (f.resolvedType instanceof protobuf.Type) {
        field.fields = extractFieldsFromType(f.resolvedType, depth + 1)
      }
      if (f.resolvedType instanceof protobuf.Enum) {
        field.enumValues = Object.keys(f.resolvedType.values)
      }
      return field
    })
  } catch {
    return []
  }
}

async function loadFromReflection(project: GrpcProject): Promise<LoadedProto> {
  const grpcReflection = await import('grpc-reflection-js')
  const address = `${project.host}:${project.port}`
  const creds = project.useTls
    ? grpc.credentials.createSsl()
    : grpc.credentials.createInsecure()

  const client = new grpcReflection.Client(address, creds)

  try {
    const serviceNames: string[] = await client.listServices()
    const services: ProtoService[] = []

    for (const serviceName of serviceNames) {
      if (REFLECTION_SYSTEM_SERVICES.includes(serviceName)) continue
      try {
        const root: protobuf.Root = await client.fileContainingSymbol(serviceName)
        root.resolveAll()

        const svc = root.lookupService(serviceName)
        const methods: ProtoMethod[] = svc.methodsArray.map((method) => {
          try { method.resolve() } catch { /* skip */ }
          return {
            name: method.name,
            requestType: (method.requestType as string).split('.').pop() ?? method.requestType as string,
            responseType: (method.responseType as string).split('.').pop() ?? method.responseType as string,
            clientStreaming: method.requestStream ?? false,
            serverStreaming: method.responseStream ?? false,
            requestSchema: {},
            responseSchema: {},
            requestFields: buildReflectionFields(root, method.requestType as string)
          }
        })

        const nameParts = serviceName.split('.')
        services.push({ name: nameParts[nameParts.length - 1], fullName: serviceName, methods })
      } catch {
        const nameParts = serviceName.split('.')
        services.push({ name: nameParts[nameParts.length - 1], fullName: serviceName, methods: [] })
      }
    }

    return { projectId: project.id, services }
  } catch (err) {
    return {
      projectId: project.id,
      services: [],
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

export function registerProtoHandlers(ipcMain: IpcMain, dialog: Dialog): void {
  ipcMain.handle(IPC.PROTO_PICK_FILE, async (event) => {
    const win = event.sender.getOwnerBrowserWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: 'Select .proto file',
      filters: [{ name: 'Protocol Buffers', extensions: ['proto'] }],
      properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC.PROTO_PICK_FOLDER, async (event) => {
    const win = event.sender.getOwnerBrowserWindow()
    const result = await dialog.showOpenDialog(win!, {
      title: 'Select proto folder',
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC.PROTO_LOAD, async (_event, project: GrpcProject): Promise<LoadedProto> => {
    try {
      if (project.protoSource.type === 'reflection') {
        return await loadFromReflection(project)
      }
      return await loadFromFiles(project)
    } catch (err) {
      return {
        projectId: project.id,
        services: [],
        error: err instanceof Error ? err.message : String(err)
      }
    }
  })
}
