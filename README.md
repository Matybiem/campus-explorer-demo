# Campus Explorer

Aplicación de portafolio para explorar salas y servicios de un campus ficticio. Este documento sirve como guía para ejecutar, probar y continuar el desarrollo del proyecto. No representa una sede universitaria real.

## Requisitos

- Node.js 20.19+ (o 22.12+)
- npm

## Puesta en marcha local

Instala las dependencias de cada parte del proyecto:

```powershell
cd backend
npm install
```

En otra terminal:

```powershell
cd frontend
npm install
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

Abre `http://localhost:5173`. Durante el desarrollo, Vite reenvía las peticiones `/api` al backend en `http://localhost:3001`, según la configuración de `frontend/vite.config.ts`.

El frontend y el backend se ejecutan en terminales separadas. Si el mapa no carga, comprueba que ambos procesos estén activos y visita `http://localhost:3001/api/health`.

## Estructura del proyecto

```text
backend/
  app.js                 Configuración de Express y rutas de la API
  server.js              Inicio del servidor HTTP
  data/spaces.js         Datos ficticios en memoria
  test/api.test.js       Pruebas automatizadas de la API
frontend/
  src/App.tsx            Interfaz, filtros, selección y estado de carga
  src/api.ts             Cliente y validación de respuestas de la API
  src/types.ts           Tipos compartidos del frontend
  src/styles.css         Estilos adaptables
  vite.config.ts         Servidor frontend y proxy de /api
```

## Flujo de datos

1. React solicita `GET /api/spaces` mediante `frontend/src/api.ts`.
2. En desarrollo, Vite reenvía la solicitud al servidor Express en el puerto `3001`.
3. Express aplica los filtros opcionales y devuelve los espacios de `backend/data/spaces.js` como JSON.
4. React filtra los resultados para mostrar los espacios del piso seleccionado y actualiza el mapa, la lista y el panel de detalle.

Los datos están actualmente en memoria y no se persisten. Para cambiar los espacios de demostración, edita `backend/data/spaces.js` conservando el contrato de datos:

| Campo | Tipo | Uso |
| --- | --- | --- |
| `id` | texto | Identificador único del espacio |
| `name` | texto | Nombre mostrado en la interfaz |
| `type` | `Sala`, `Laboratorio`, `Baño` o `Servicio` | Categoría y estilo visual |
| `floor` | número entero | Piso donde se muestra |
| `x`, `y` | número | Posición porcentual en el esquema |
| `capacity` | número, opcional | Capacidad referencial |
| `accessible` | booleano | Filtro de accesibilidad |
| `description` | texto | Descripción del panel de detalle |

## Guía para continuar el desarrollo

- **Interfaz o comportamiento visual:** trabaja en `frontend/src/App.tsx` y `frontend/src/styles.css`. Mantén los datos obtenidos desde `fetchSpaces`; no vuelvas a duplicar el catálogo en React.
- **Nuevos datos o filtros del servidor:** actualiza la validación y consulta en `backend/app.js`, agrega pruebas en `backend/test/api.test.js` y documenta cualquier parámetro nuevo en la sección API.
- **Cambios al contrato de espacios:** actualiza el tipo en `frontend/src/types.ts`, la validación de respuesta en `frontend/src/api.ts`, los datos del backend y las pruebas correspondientes.
- **Persistencia:** la aplicación aún no tiene base de datos. Antes de agregar una, acuerda qué datos se guardarán y evita usar información institucional sin autorización.
- **Plano:** es un esquema en perspectiva CSS, no un modelo arquitectónico ni un visor 3D real.

## Validación antes de publicar cambios

Desde la raíz del repositorio:

```powershell
npm test --prefix backend
npm run build --prefix frontend
```

Comprueba también el recorrido local completo: API en `/api/health`, listado en `/api/spaces` e interfaz en `http://localhost:5173`.

## API

- `GET /api/health`: comprueba que la API está funcionando.
- `GET /api/spaces`: lista los espacios ficticios.
- `GET /api/spaces?q=sala&type=Sala&floor=1&accessible=true`: filtra por texto, tipo, piso y accesibilidad. Todos los filtros son opcionales.

Los filtros permitidos para `type` son `Sala`, `Laboratorio`, `Baño` y `Servicio`. Los filtros inválidos responden con estado `400` y un mensaje JSON.

Ejecuta las pruebas de la API desde la raíz:

```powershell
npm test --prefix backend
```

## Funcionalidades actuales

- Búsqueda por nombre, código o tipo de espacio.
- Filtros por categoría y accesibilidad.
- Selección de piso y selección de espacios en el plano o en la lista.
- Panel con detalles ficticios del espacio seleccionado.
- Controles de giro y zoom del esquema en perspectiva.
- Diseño adaptable a pantallas pequeñas.
- API REST de Node.js y Express con datos de demostración.

El plano es un esquema de demostración, no un modelo arquitectónico ni un visor 3D real. Todos los datos son inventados; no se incluyen planos, equipos ni inventarios reales. No agregues información institucional o sensible a una versión pública sin autorización.

## Ramas y commits

El trabajo está separado en ramas de funcionalidades:

- `feature/frontend-mvp`: primera versión del frontend.
- `feature/backend-api`: API, documentación de desarrollo y conexión con el backend; parte de la rama del frontend.

Usa commits con el formato Conventional Commits:

```text
<tipo>(<área>): <descripción breve en imperativo>
```

Ejemplos:

```text
feat(frontend): add accessible space filter
feat(backend): add floor filter to spaces endpoint
fix(frontend): refresh spaces after API response
docs: document local development workflow
test(backend): cover invalid space filters
```

Tipos habituales: `feat` para funcionalidades, `fix` para correcciones, `docs` para documentación y `test` para pruebas.
