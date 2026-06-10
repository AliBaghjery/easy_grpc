# eASY gRPC

A lightweight, cross-platform desktop gRPC client built with Electron and React.  
Connect to gRPC services via `.proto` files, proto folders, or live server reflection — then compose and send requests from a clean, tabbed workspace.

---

## Features

### Project management
- Create and manage multiple gRPC projects, each with its own host, port, and proto source
- Optional TLS with a custom CA certificate file
- Per-project context menu for quick edit or delete

### Proto loading
| Source | How it works |
|--------|-------------|
| **Single `.proto` file** | Load one proto file directly |
| **Proto folder** | Recursively scans a folder for all `.proto` files |
| **Server reflection** | Queries the live server — no local files needed |

- Fields and default values are automatically derived from proto message types
- Nested messages, repeated fields, and enums all get sensible defaults

### Request editor
- JSON body editor with live validation
- **Reset to defaults** restores the proto-derived skeleton
- Per-request **metadata** (headers) with per-row enable/disable toggles
- Streaming methods are detected and labeled (`BiDi`, `CS`, `SS`)

### Response viewer
- Pretty-printed JSON response
- gRPC status code with human-readable name (all 16 codes supported)
- Call duration in milliseconds
- One-click **Copy** to clipboard
- Separate tabs for response body, **headers**, and **trailers** (populated from server metadata)

### Call cancellation
- The **Send** button becomes a **Cancel** button while a request is in-flight
- Cancellation sends a gRPC cancel signal to the server immediately

### Tab workspace
- One tab per unique method — re-clicking the same method focuses the existing tab
- Tabs are **color-coded by project** for quick orientation
- Per-tab status indicator: loading (pulsing), success (green), error (red)
- Request body and metadata are **automatically saved** and restored on restart

### Search
- **Sidebar search** — filter services and methods within a project
- **Command palette** (`Ctrl+P`) — fuzzy search across all projects and all methods instantly
  - Subsequence matching: typing `georcreque` finds `GetOrCreateQuestion`
  - Results ranked by consecutive matches and CamelCase boundaries

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+P` / `⌘P` | Open command palette |
| `Ctrl+N` / `⌘N` | New project |
| `↑` / `↓` | Navigate command palette results |
| `Enter` | Open selected method |
| `Esc` | Close command palette |

---

## Getting started

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or later
- npm

### Install dependencies
```bash
npm install
```

### Run in development
```bash
npm run dev
```

### Build for production

| Platform | Command | Output |
|----------|---------|--------|
| Linux | `npm run dist:linux` | AppImage + `.deb` in `release/` |
| All platforms | `npm run dist` | Platform-specific package in `release/` |

The **AppImage** is portable — no installation required:
```bash
chmod +x "eASY gRPC-0.1.0.AppImage"
./"eASY gRPC-0.1.0.AppImage"
```

---

## Creating your first request

1. Click **+** in the sidebar (or `Ctrl+N`) to create a project
2. Enter the server address and choose a proto source:
   - Pick a `.proto` file or folder if you have the schema locally
   - Choose **Reflection** to discover services directly from the server
3. Click the project in the sidebar to expand it and load services
4. Click any method to open a tab
5. Edit the JSON request body and optional metadata
6. Click **Send**

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | [Electron](https://electronjs.org/) 33 |
| UI | [React](https://react.dev/) 18 + [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |
| gRPC | [@grpc/grpc-js](https://github.com/grpc/grpc-node) |
| Proto parsing | [@grpc/proto-loader](https://github.com/grpc/grpc-node) + [protobufjs](https://protobufjs.github.io/protobuf.js/) |
| Reflection | [grpc-reflection-js](https://github.com/redhoyasa/grpc-reflection-js) |
| Persistence | [electron-store](https://github.com/sindresorhus/electron-store) |
| Build | [electron-vite](https://electron-vite.org/) + [electron-builder](https://www.electron.build/) |

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Renderer (React + Zustand)                          │
│  Sidebar · TabBar · RequestPanel · ResponsePanel     │
│  CommandPalette · ProjectModal                       │
└─────────────────────┬────────────────────────────────┘
                      │  contextBridge  (preload)
┌─────────────────────▼────────────────────────────────┐
│  Main process (Node / Electron)                      │
│  · electron-store  — projects & tab persistence      │
│  · proto.ts        — proto loading & reflection      │
│  · client.ts       — gRPC invoke                     │
└─────────────────────┬────────────────────────────────┘
                      │
          @grpc/grpc-js · proto-loader
          protobufjs · grpc-reflection-js
```

Security model: `contextIsolation: true`, `nodeIntegration: false`. The renderer communicates with the main process only through a typed `window.api` surface defined in the preload script.

---

## Known limitations

- **Streaming RPCs** — client/server/bidirectional streaming methods are detected and labeled in the UI but not yet invoked. Only unary calls work.
- **Project-level metadata** — stored internally but there is no UI to edit it (per-tab metadata works fully).

---

## License

MIT
