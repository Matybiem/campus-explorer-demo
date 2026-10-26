# Campus Explorer

Aplicación de portafolio para explorar salas y servicios de un campus ficticio. El objetivo es practicar desarrollo web con React, TypeScript, Node.js y Express. No representa una sede universitaria real ni utiliza información institucional.

## Estado del proyecto

El frontend y la API están integrados en `main`. Los siguientes cambios se desarrollan en ramas cortas basadas en esa rama principal.

Clona el repositorio y entra en la carpeta:

```powershell
git clone https://github.com/Matybiem/campus-explorer-demo.git
cd campus-explorer-demo
```

## Tecnologías

- **Frontend:** React, TypeScript y Vite.
- **Backend:** Node.js y Express (en `feature/backend-api`).
- **Pruebas del backend:** test runner integrado de Node.js (`node:test`).
- **Datos:** catálogo ficticio en memoria; todavía no hay base de datos.

## Requisitos

- Node.js 20.19+ (o 22.12+)
- npm
- Git

## Puesta en marcha local

Instala las dependencias desde la raíz del repositorio:

```powershell
npm install --prefix backend
npm install --prefix frontend
```

Inicia el backend en una terminal:

```powershell
cd backend
npm run dev
```

Inicia el frontend en otra terminal:

```powershell
cd frontend
npm run dev
```

Abre `http://localhost:5173`.

Vite reenvía las peticiones `/api` a Express en `http://localhost:3001`, según `frontend/vite.config.ts`. Comprueba el backend en `http://localhost:3001/api/health`. La ruta raíz `http://localhost:3001/` no sirve una página web porque el backend solo ofrece endpoints de API.

## Estructura

```text
backend/
  app.js                 Configuración de Express y rutas
  server.js              Inicio del servidor HTTP
  data/spaces.js         Datos ficticios en memoria
  test/api.test.js       Pruebas automatizadas de la API
frontend/
  src/App.tsx            Interfaz, búsqueda, filtros y selección
  src/api.ts             Cliente y validación de respuestas API
  src/types.ts           Tipos del frontend
  src/styles.css         Estilos y diseño adaptable
  vite.config.ts         Vite y proxy de /api
```

## Funcionalidades

- Búsqueda por nombre, código o tipo de espacio.
- Filtros por categoría y accesibilidad.
- Selección de piso y espacios en el plano o en la lista.
- Panel con detalles ficticios del espacio seleccionado.
- Plano esquemático interactivo en forma de L, con celdas seleccionables y espacios ficticios.
- Controles de rotación, inclinación y zoom; la vista inicial es inclinada y la opción «Vista plana» cambia a una vista superior.
- Diseño adaptable a pantallas pequeñas.
- API REST con Node.js y Express.

El plano actual es un esquema CSS interactivo, no un modelo arquitectónico ni un visor 3D.

## Arquitectura y flujo de datos

1. La interfaz solicita `GET /api/spaces` desde `frontend/src/api.ts`.
2. Vite reenvía `/api` al backend mientras se desarrolla localmente.
3. Express aplica filtros opcionales y responde con los espacios ficticios desde `backend/data/spaces.js`.
4. React muestra los espacios del piso seleccionado en el plano, la lista y el panel de detalle.

Los datos se mantienen en memoria y no se persisten. Para añadir espacios, edita `backend/data/spaces.js` manteniendo este contrato:

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | texto | Identificador único del espacio |
| `name` | texto | Nombre que se muestra |
| `type` | `Sala`, `Laboratorio`, `Baño` o `Servicio` | Categoría |
| `floor` | número entero | Piso |
| `x`, `y` | número entero | Columna y fila del espacio en la cuadrícula 6 × 6 con forma de L |
| `capacity` | número, opcional | Capacidad referencial ficticia |
| `accessible` | booleano | Indica accesibilidad en los datos de ejemplo |
| `description` | texto | Descripción del espacio |

Si cambia este contrato, actualiza los datos, `frontend/src/types.ts`, la validación de `frontend/src/api.ts` y las pruebas afectadas.

## API

- `GET /api/health`: devuelve el estado del backend.
- `GET /api/spaces`: lista todos los espacios ficticios.
- `GET /api/spaces?q=sala&type=Sala&floor=1&accessible=true`: filtra por texto, tipo, piso y accesibilidad; todos los parámetros son opcionales.

Los tipos admitidos son `Sala`, `Laboratorio`, `Baño` y `Servicio`. Los filtros inválidos devuelven estado HTTP `400` con un mensaje JSON.

## Pruebas y compilación

Ejecuta desde la raíz del repositorio:

```powershell
npm run build --prefix frontend
```

Ejecuta además las pruebas de API:

```powershell
npm test --prefix backend
```

Antes de proponer cambios, verifica el recorrido local: interfaz en `http://localhost:5173` y, cuando esté activa la API, endpoints `/api/health` y `/api/spaces`.

## Guía de desarrollo

- **Interfaz y comportamiento:** modifica `frontend/src/App.tsx` y `frontend/src/styles.css`. Carga los espacios desde la API y evita duplicar el catálogo en el frontend.
- **Endpoints y filtros:** modifica `backend/app.js`, añade pruebas en `backend/test/api.test.js` y documenta los parámetros nuevos.
- **Datos de ejemplo:** edita `backend/data/spaces.js` usando exclusivamente información inventada.
- **Persistencia:** no hay base de datos. Antes de añadir una, define qué datos se guardarán y sus requisitos de privacidad.
- **Errores:** conserva estados explícitos de carga, error y reintento; no muestres datos inventados como si la API hubiera respondido correctamente.
- **Accesibilidad y responsive:** prueba teclado, foco visible y diseño en pantallas pequeñas al cambiar la interfaz.

## Ramas y commits

- `main`: base integrada del proyecto.
- `feature/frontend-mvp` y `feature/backend-api`: ramas ya integradas mediante pull requests.

Para las siguientes funcionalidades, crea ramas breves basadas en `main`, por ejemplo `feature/map-improvements` o `feature/admin-panel`. Si una tarea depende de cambios aún no integrados, coordina los pull requests en orden.

Usa Conventional Commits:

```text
<tipo>(<área>): <descripción breve>
```

Ejemplos:

```text
feat(frontend): add accessible space filter
feat(backend): add floor filter to spaces endpoint
fix(frontend): refresh spaces after API response
docs: document development workflow
test(backend): cover invalid space filters
```

Tipos habituales: `feat`, `fix`, `docs`, `test` y `refactor`.

## Privacidad y alcance de la demo

Todos los espacios y detalles son inventados. No agregues planos reales, ubicación de equipos, inventarios ni otros datos institucionales a una versión pública sin autorización. El inicio de sesión por sí solo no sustituye esa autorización.
