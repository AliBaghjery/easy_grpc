export type ProtoSourceType = 'file' | 'folder' | 'reflection'

export interface ProtoSource {
  type: ProtoSourceType
  /** Absolute path(s) for file/folder, or host:port for reflection */
  path: string
}

export interface GrpcMetadataEntry {
  key: string
  value: string
  enabled: boolean
}

export interface GrpcProject {
  id: string
  name: string
  host: string
  port: number
  useTls: boolean
  /** Path to TLS cert file (optional) */
  tlsCertPath?: string
  protoSource: ProtoSource
  metadata: GrpcMetadataEntry[]
  createdAt: string
  updatedAt: string
}

export interface ProtoMethod {
  name: string
  requestType: string
  responseType: string
  clientStreaming: boolean
  serverStreaming: boolean
  /** JSON schema of the request message */
  requestSchema: Record<string, unknown>
  /** JSON schema of the response message */
  responseSchema: Record<string, unknown>
  /** Human-readable field list */
  requestFields: ProtoField[]
}

export interface ProtoField {
  name: string
  type: string
  repeated: boolean
  required: boolean
  fields?: ProtoField[]
  enumValues?: string[]
}

export interface ProtoService {
  name: string
  fullName: string
  methods: ProtoMethod[]
}

export interface LoadedProto {
  projectId: string
  services: ProtoService[]
  error?: string
}

export interface GrpcCallRequest {
  projectId: string
  serviceName: string
  methodName: string
  payload: Record<string, unknown>
  metadata: GrpcMetadataEntry[]
  timeoutMs?: number
}

export type GrpcCallStatus = 'idle' | 'loading' | 'success' | 'error'

export interface GrpcCallResponse {
  status: GrpcCallStatus
  data?: unknown
  error?: string
  grpcStatusCode?: number
  grpcStatusMessage?: string
  durationMs?: number
  headers?: Record<string, string>
  trailers?: Record<string, string>
}

export interface Tab {
  id: string
  /** Unique key used to detect duplicate tabs: projectId:service.fullName:method.name */
  key: string
  projectId: string
  service: ProtoService
  method: ProtoMethod
  requestPayload: string
  requestMetadata: GrpcMetadataEntry[]
  response: GrpcCallResponse | null
  callLoading: boolean
}

/** Subset of Tab that survives app restarts (no runtime-only fields) */
export interface PersistedTab {
  key: string
  service: ProtoService
  method: ProtoMethod
  requestPayload: string
  requestMetadata: GrpcMetadataEntry[]
}

export interface PersistedProjectTabs {
  tabs: PersistedTab[]
  /** key of the tab that was active when the app closed */
  activeTabKey: string | null
}

// IPC channel names — single source of truth
export const IPC = {
  // Projects
  PROJECT_LIST: 'project:list',
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',

  // Proto loading
  PROTO_LOAD: 'proto:load',
  PROTO_PICK_FILE: 'proto:pick-file',
  PROTO_PICK_FOLDER: 'proto:pick-folder',

  // gRPC calls
  GRPC_INVOKE: 'grpc:invoke',
  GRPC_CANCEL: 'grpc:cancel',

  // Streaming events (main → renderer)
  GRPC_STREAM_DATA: 'grpc:stream-data',
  GRPC_STREAM_END: 'grpc:stream-end',
  GRPC_STREAM_ERROR: 'grpc:stream-error',

  // Tab persistence
  TABS_SAVE: 'tabs:save',
  TABS_LOAD_ALL: 'tabs:load-all'
} as const
