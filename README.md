# RH-Studio

Frontend para RunningHub.ai que permite explorar herramientas de generación de imágenes AI, ejecutarlas, y organizar los resultados en una galería persistente.

## ¿Qué hace?

RH-Studio funciona como un panel de control para herramientas de generación de imágenes basadas en RunningHub:

1. **Catálogo** — Explorá herramientas de generación de imágenes disponibles en RunningHub.ai
2. **Configuración** — Cada herramienta tiene campos configurables (imágenes, prompts, parámetros)
3. **Ejecución** — Corré tareas individuales o en lote (hasta 10 por ejecución)
4. **Galería** — Los resultados se guardan persistentemente, independientes de las tareas
5. **Reutilización** — Usá resultados de la galería como insumo para otras herramientas
6. **Prompts** — Guardá y reutilizá prompts organizados por herramienta

## Arquitectura

```
rh-studio/
├── client/           # React 19 + Vite (frontend)
│   └── src/
│       ├── pages/    # ToolRunner, Gallery, Catalog, TaskHistory, etc.
│       ├── components/  # DynamicField, BrowseUploadsModal, etc.
│       └── api/      # Cliente API
├── server/           # Node.js + Express + better-sqlite3 (backend)
│   └── src/
│       ├── routes/   # /api/gallery, /api/tasks, /api/tools, etc.
│       ├── services/ # rhClient (RunningHub API), galleryStore, taskCleanup
│       └── db/       # Migraciones y conexión SQLite
├── shared/           # Tipos TypeScript compartidos
├── downloads/        # Archivos temporales de tareas (auto-limpieza)
├── uploads/          # Archivos subidos por usuarios (persistentes)
└── data/             # Base de datos SQLite
```

## Stack

| Capa    | Tecnología                          |
|---------|-------------------------------------|
| Frontend | React 19, React Router 7, Vite     |
| Backend  | Express.js, TypeScript              |
| DB       | better-sqlite3 (SQLite embebido)    |
| AI API   | RunningHub.ai (runninghub.ai)       |
| Upload   | Multer (multipart/form-data)        |

## Modelo de datos

```
┌─────────────┐       ┌─────────────┐       ┌──────────────────┐
│   tools     │──────▶│   tasks     │──────▶│  gallery_items   │
│ webappId,   │       │ taskId,     │       │  fileName,       │
│ nodeInfoList│       │ status,     │       │  toolName,       │
│ coverUrl    │       │ resultFiles │       │  prompt          │
└─────────────┘       └─────────────┘       └──────────────────┘
       │                                           ▲
       │                                           │
       ▼              ┌─────────────┐              │
┌─────────────┐       │   prompts   │              │
│   uploads   │       │ title,      │              │
│ fileName,   │       │ content,    │──────────────┘
│ originalName │       │ toolId      │
└─────────────┘       └─────────────┘
```

**Nota importante:** `gallery_items` es independiente de `tasks`. Las tareas son efímeras (se auto-limpian) pero la galería persiste.

## API Routes

| Método | Ruta                        | Descripción                          |
|--------|-----------------------------|--------------------------------------|
| GET    | /api/tools                  | Listar herramientas del catálogo     |
| GET    | /api/tools/:id              | Detalle de una herramienta           |
| POST   | /api/tasks/run              | Crear y ejecutar tarea               |
| GET    | /api/tasks                  | Listar tareas (con filtros)          |
| GET    | /api/tasks/:id              | Estado de tarea (polling)            |
| DELETE | /api/tasks/:id              | Eliminar tarea y sus archivos        |
| GET    | /api/gallery                | Listar ítems de galería              |
| GET    | /api/gallery/files/:id      | Servir archivo de galería           |
| DELETE | /api/gallery/:id            | Eliminar ítem de galería (soft delete)|
| POST   | /api/upload                 | Subir archivo                        |
| GET    | /api/uploads                | Listar archivos subidos              |
| GET    | /api/prompts                | Listar prompts guardados             |
| POST   | /api/prompts                | Crear prompt                         |
| GET    | /api/settings               | Obtener setting (ej. API key)       |
| POST   | /api/settings               | Guardar setting                     |

## Primeros pasos

### 1. Requisitos

- Node.js 20+
- npm 10+

### 2. Instalación

```bash
npm install
```

### 3. Configuración

Ingresá tu API key de RunningHub.ai en la página de Settings de la aplicación.

### 4. Ejecución

```bash
npm run dev
```

Esto inicia concurrently el servidor (puerto 3001) y el cliente (puerto 5173).

### 5. Uso

1. Andá a Settings y configurá la API key de RunningHub
2. Explorá el catálogo de herramientas
3. Seleccioná una herramienta → configurá los parámetros
4. Ejecutá (individual o en lote)
5. Revisá los resultados en Gallery
6. Reutilizá resultados de Gallery con otras herramientas

## Workflow de ejecución de tareas

```
1. Usuario configura herramienta en ToolRunner
2. POST /api/tasks/run → server valida y llama a RunningHub API
3. Server crea registro task (status: PENDING)
4. Polling: GET /api/tasks/:id cada 2s
5. RunningHub responde COMPLETED → server extrae URLs de resultados
6. Server descarga archivos → guarda en downloads/ y registra en gallery_items
7. Galería muestra resultado persistente
8. Tareas se auto-limpian después de 7 días (gallery_items no se toca)
```

## Limpieza automática

- **tasks**: se eliminan después de 7 días de completadas
- **gallery_items**: solo soft-delete (marcado `deletedAt`), archivos permanecen en disco
- Archivos huérfanos de tareas viejas se recuperan automáticamente al inicio

## Rutas del frontend

| Ruta              | Página              |
|-------------------|---------------------|
| /                 | Catálogo de herramientas |
| /register         | Registrar nueva herramienta |
| /tools/:id/run    | ToolRunner (config y ejecución) |
| /history          | Historial de tareas |
| /history/:id      | Detalle de tarea + Repeat |
| /gallery          | Galería de resultados |
| /prompts          | Gestión de prompts |
| /uploads          | Archivos subidos |
| /settings         | Configuración (API key, etc.) |
