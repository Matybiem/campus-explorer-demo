# Campus Explorer

Aplicación de portafolio para explorar salas y servicios de un campus ficticio. El objetivo es practicar desarrollo web con React, TypeScript, Node.js y Express. No representa una sede universitaria real ni utiliza información institucional.

## Estado del proyecto

El panel de administración se desarrolla en `feature/admin-panel`, basada en `feature/map-improvements`. La rama incluye el plano interactivo con vistas plana e inclinada, la API y la configuración admin. Cambia a esa rama para probar esta funcionalidad:

Clona el repositorio y entra en la carpeta:

```powershell
git clone https://github.com/Matybiem/campus-explorer-demo.git
cd campus-explorer-demo
git fetch origin
git switch --track origin/feature/admin-panel
```

## Tecnologías

- **Frontend:** React, TypeScript y Vite.
- **Backend:** Node.js, Express y PostgreSQL.
- **Pruebas del backend:** test runner integrado de Node.js (`node:test`).
- **Autenticación:** sesiones HTTP-only almacenadas en PostgreSQL; contraseñas con hash bcrypt.
- **Datos:** espacios y visibilidad persistidos en PostgreSQL.

## Requisitos

- Node.js 20.19+ (o 22.12+)
- npm
- Git
- Docker Desktop con Docker Compose, para la base de datos local

## Puesta en marcha local

### Configurar credenciales locales

Crea tu archivo de entorno local a partir de la plantilla:

```powershell
Copy-Item .env.example .env
```

Edita `.env` y reemplaza **todos** los valores `replace-with-...` por valores locales propios. La contraseña inicial debe tener entre 14 y 72 bytes. Genera el secreto de sesión con:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

No compartas ni subas `.env`: está excluido por `.gitignore`. La primera vez que se inicia la API, se crea el usuario indicado por `ADMIN_USERNAME` y `ADMIN_PASSWORD`; cambiar esas variables después no modifica una cuenta ya creada.

### Iniciar PostgreSQL y la aplicación

Desde la raíz, inicia la base de datos:

```powershell
docker compose up -d database
```

Instala las dependencias:

```powershell
npm install --prefix backend
npm install --prefix frontend
```

Inicia la API en una terminal:

```powershell
cd backend
npm run dev
```

Inicia el frontend en otra:

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
  database.js            Esquema, casillas iniciales y admin de arranque
  repositories.js        Consultas PostgreSQL
  server.js              Inicio del servidor HTTP
  data/spaces.js         Datos ficticios para poblar la base inicialmente
  test/api.test.js       Pruebas automatizadas de la API
frontend/
  src/App.tsx            Interfaz, búsqueda, filtros y selección
  src/AdminPanel.tsx     Inicio de sesión y edición de casillas
  src/api.ts             Cliente y validación de respuestas API
  src/adminApi.ts        Cliente de endpoints protegidos
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
- Panel admin protegido junto al mapa para activar u ocultar casillas y editar el nombre y tipo de cada espacio; en modo administración se muestran todas las casillas y las ocultas aparecen en gris.
- Diseño adaptable a pantallas pequeñas.
- API REST con Node.js y Express.

El plano actual es un esquema CSS interactivo, no un modelo arquitectónico ni un visor 3D.

## Arquitectura y flujo de datos

1. La interfaz solicita `GET /api/spaces` desde `frontend/src/api.ts`.
2. Vite reenvía `/api` al backend mientras se desarrolla localmente.
3. Express aplica filtros opcionales y consulta PostgreSQL; `backend/data/spaces.js` se usa solo para poblar espacios ficticios iniciales en posiciones vacías.
4. React muestra los espacios del piso seleccionado en el plano, la lista y el panel de detalle.

Las casillas se almacenan en PostgreSQL. El arranque crea 20 posiciones para cada piso y añade los espacios ficticios iniciales solo en posiciones vacías; no sobrescribe cambios existentes. Para cambiar los datos iniciales de una base nueva, edita `backend/data/spaces.js`.

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | texto | Identificador único del espacio |
| `name` | texto | Nombre que se muestra |
| `type` | `Sala`, `Laboratorio`, `Administrativo`, `Baño hombre` o `Baño mujer` | Categoría |
| `floor` | número entero | Piso |
| `x`, `y` | número entero | Columna y fila del espacio en la cuadrícula 6 × 6 con forma de L |
| `enabled` | booleano | Si está activo, se muestra en el mapa público |
| `capacity` | número, opcional | Capacidad referencial ficticia |
| `accessible` | booleano | Indica accesibilidad en los datos de ejemplo |
| `description` | texto | Descripción del espacio |

La interfaz de administración guarda cada casilla explícitamente con «Guardar cambios». Las casillas desactivadas no aparecen en el mapa público. Si cambia el contrato, actualiza PostgreSQL, los repositorios, `frontend/src/types.ts`, la validación API y las pruebas afectadas.

## API

- `GET /api/health`: devuelve el estado del backend.
- `GET /api/spaces`: lista solo espacios activados.
- `GET /api/spaces?q=sala&type=Sala&floor=1&accessible=true`: filtra por texto, tipo, piso y accesibilidad; todos los parámetros son opcionales.
- `GET /api/admin/session`: devuelve si hay una sesión admin activa.
- `POST /api/admin/login`: autentica usuario y contraseña.
- `POST /api/admin/logout`: cierra la sesión.
- `GET /api/admin/slots?floor=1`: lista todas las casillas de un piso; requiere sesión admin.
- `PATCH /api/admin/slots/:id`: guarda `name`, `type` y `enabled`; requiere sesión admin.

Los tipos admitidos son `Sala`, `Laboratorio`, `Administrativo`, `Baño hombre` y `Baño mujer`. Los filtros inválidos devuelven estado HTTP `400` con un mensaje JSON. Las rutas de edición requieren sesión y las contraseñas no se envían al frontend después del login.

## Pruebas y compilación

Ejecuta desde la raíz del repositorio:

```powershell
npm run build --prefix frontend
```

Ejecuta además las pruebas de API:

```powershell
npm test --prefix backend
```

Las pruebas de API usan repositorios simulados para no exigir una base PostgreSQL de pruebas. Para comprobar el flujo completo, ejecuta la base local, inicia ambos servidores, modifica una casilla como admin y confirma que aparece o desaparece del mapa público después de guardarla.

## Guía de desarrollo

- **Interfaz y comportamiento:** modifica `frontend/src/App.tsx` y `frontend/src/styles.css`. Carga los espacios desde la API y evita duplicar el catálogo en el frontend.
- **Endpoints y filtros:** modifica `backend/app.js` y `backend/repositories.js`; añade pruebas en `backend/test/api.test.js` y documenta los parámetros nuevos.
- **Datos de ejemplo:** edita `backend/data/spaces.js` usando exclusivamente información inventada.
- **Esquema de PostgreSQL:** actualiza `backend/database.js` y documenta cómo migrar una base existente; no dependas solo de cambios a datos iniciales, pues las posiciones existentes se conservan.
- **Credenciales:** no agregues secretos al repositorio. La cuenta inicial se crea desde variables locales; almacena contraseñas usando bcrypt y valida permisos en el backend.
- **Errores:** conserva estados explícitos de carga, error y reintento; no muestres datos inventados como si la API hubiera respondido correctamente.
- **Accesibilidad y responsive:** prueba teclado, foco visible y diseño en pantallas pequeñas al cambiar la interfaz.

## Ramas y commits

- `main`: base integrada del proyecto.
- `feature/frontend-mvp` y `feature/backend-api`: ramas ya integradas mediante pull requests.
- `feature/map-improvements`: plano en “L”; base de `feature/admin-panel`.
- `feature/admin-panel`: configuración PostgreSQL y administración protegida.

Para las siguientes funcionalidades, crea ramas breves basadas en `main`. Si una rama depende de cambios aún no integrados, integra primero la rama base y luego actualiza la dependiente.

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

Todos los espacios y detalles son inventados. No agregues planos reales, ubicación de equipos, inventarios ni otros datos institucionales a una versión pública sin autorización. La autenticación protege la administración de esta demo, pero no sustituye la autorización institucional ni una revisión de seguridad y despliegue antes de usarla en producción.
