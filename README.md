# Campus Explorer

Aplicación de portafolio para explorar salas y servicios de un campus ficticio. El objetivo es practicar desarrollo web con React, TypeScript, Node.js y Express. No representa una sede universitaria real ni utiliza información institucional.

## Estado del proyecto

Versión actual: **v1.2.0**. Para volver a una versión anterior: `git checkout v1.1.0`. El trabajo posterior se desarrolla en ramas nuevas (`feature/...`) y las versiones se marcan con tags (`vMAYOR.MENOR.PARCHE`): se sube el número menor con funcionalidades nuevas y el parche con correcciones.

La rama `feature/fixed-floor-matrix-contour` incluye el plano interactivo con matriz fija de 15 × 15, el panel de administración y la API. Para probarla:

Clona el repositorio y entra en la carpeta:

```powershell
git clone https://github.com/Matybiem/campus-explorer-demo.git
cd campus-explorer-demo
git fetch origin
git switch --track origin/feature/fixed-floor-matrix-contour
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
- Plano interactivo editable como matriz fija de 15 × 15 casillas por nivel; el contorno configurable define la superficie visible del piso sin mostrar casillas ocultas como salas.
- Paredes 3D sobre los contornos activos de cada piso, tanto en la vista de un solo piso como en «Ver todos los pisos»: se levantan en el borde de la superficie visible, con una altura igual al ancho de una casilla (`wallHeight` en `frontend/src/App.tsx`), son translúcidas para no ocultar las salas y no interceptan clics.
- Controles de rotación, inclinación y zoom (20 % a 140 %); la vista inicial es inclinada y la opción «Vista plana» cambia a una vista superior. Con el clic izquierdo sostenido y movido sobre el mapa (más de 5 px) se orbita: el movimiento horizontal cambia la rotación y el vertical la inclinación (arrastrar hacia arriba inclina más). Un clic sin movimiento sigue seleccionando la sala. Con el clic derecho sostenido se desplaza el plano («mano»).
- Botón «Ver todos los pisos»: muestra todos los niveles activos apilados como planos de 15 × 15 alineados sobre el eje Z, con el piso más alto arriba. La separación entre pisos es igual a la altura de las paredes, de modo que cada pared llega justo al piso de arriba; el piso seleccionado queda separado del que tiene encima.
- En modo administración, mantener presionado el clic izquierdo sobre una casilla sin moverse durante 0,4 s y soltarla sobre otra intercambia sus datos como un cambio pendiente; si el cursor se mueve antes de ese tiempo, el gesto gira el mapa.
- Panel admin protegido junto al mapa para activar u ocultar casillas y editar el nombre y tipo de cada espacio; el nombre puede quedar vacío y en ese caso se muestra el código de la casilla. En modo administración se muestran todas las casillas y las ocultas aparecen en gris.
- En modo administración se pueden editar las 225 casillas del nivel, incluidas las ocultas, y definir cuáles ocultas forman parte del contorno del piso. Las casillas visibles siempre forman parte del contorno.
- El perfil de administrador puede agregar y desactivar niveles en orden: hasta 10 pisos y 5 subterráneos. Solo se desactiva el último nivel de cada secuencia, el Piso 1 permanece activo y las salas se conservan al desactivar un nivel.
- Diseño adaptable a pantallas pequeñas.
- API REST con Node.js y Express.

El plano actual es un esquema CSS interactivo, no un modelo arquitectónico ni un visor 3D.

## Arquitectura y flujo de datos

1. La interfaz solicita `GET /api/spaces` desde `frontend/src/api.ts`.
2. Vite reenvía `/api` al backend mientras se desarrolla localmente.
3. Express aplica filtros opcionales y consulta PostgreSQL; `backend/data/spaces.js` se usa solo para poblar espacios ficticios iniciales en posiciones vacías.
4. React muestra los espacios del piso seleccionado en el plano, la lista y el panel de detalle.

Los niveles y casillas se almacenan en PostgreSQL. Los pisos usan los números 1 a 10 y los subterráneos -1 a -5. Cada nivel tiene exactamente 225 casillas en una matriz de 15 × 15; los espacios ficticios de `backend/data/spaces.js` se conservan al crear una base nueva. Al iniciar una base existente, la migración conserva los datos de las casillas, mantiene sus coordenadas cuando caben y recoloca las que quedan fuera de rango. Si un nivel tiene más de 225 casillas, el arranque falla explícitamente para no perder registros.

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `id` | texto | Identificador único del espacio |
| `name` | texto | Nombre que se muestra |
| `type` | `Sala`, `Laboratorio`, `Administrativo` o `Espacio común` | Tipo principal |
| `category` | `Baño hombre`, `Baño mujer`, `Escalera`, `Ascensor` o `Comida`; nulo para otros tipos | Subcategoría de un espacio común, con su icono y color |
| `floor` | número entero | Piso |
| `x`, `y` | número entero entre 0 y 14 | Columna y fila en la matriz fija de 15 × 15 |
| `enabled` | booleano | Si está activo, se muestra en el mapa público |
| `use_contour` | booleano | Incluye una casilla oculta en la superficie visible del piso |
| `capacity` | número, opcional | Capacidad referencial ficticia |
| `accessible` | booleano | Indica accesibilidad en los datos de ejemplo |
| `description` | texto | Descripción del espacio |

La interfaz de administración permite seleccionar primero el tipo principal y luego editar el nombre; para «Espacio común», el nombre se reemplaza por una categoría seleccionable (baño hombre, baño mujer, escalera, ascensor o comida). Cada categoría tiene su propio icono y color. Los cambios de nombre, tipo, categoría, visibilidad, accesibilidad y descripción quedan pendientes hasta guardar juntos todos los cambios del piso. Las descripciones admiten hasta 500 caracteres y se muestran en los detalles públicos debajo de la accesibilidad. No permite cerrar la administración ni cambiar de piso hasta guardar los cambios. Las casillas desactivadas no aparecen en el mapa público. Si cambia el contrato, actualiza PostgreSQL, los repositorios, `frontend/src/types.ts`, la validación API y las pruebas afectadas.

La tabla `floor_plans` almacena el nivel, su estado activo y dimensiones fijas de 15 × 15. Los niveles se activan consecutivamente: el siguiente piso disponible es el número posterior al último activo y el siguiente subterráneo es el siguiente número negativo. Se desactiva solo el último piso o el subterráneo más profundo; el Piso 1 no se puede desactivar. Esta regla evita huecos (por ejemplo, no se puede desactivar el Piso 3 mientras el Piso 4 siga activo). Desactivar un nivel lo oculta del selector y del mapa público, pero conserva su configuración y casillas para poder reactivarlo.

En administración, las casillas visibles siempre pertenecen a la superficie del piso y la opción «Usar contorno» queda forzada mientras estén visibles. Las casillas ocultas con esa opción activa rellenan el piso en vista de usuario sin aparecer como espacios seleccionables. La opción de una casilla visible se conserva al ocultarla para que el administrador pueda decidir después si debe quedar fuera del contorno.

## API

- `GET /api/health`: devuelve el estado del backend.
- `GET /api/floors`: lista los pisos y subterráneos activos para el selector público.
- `GET /api/floors/:floor/plan`: devuelve las dimensiones fijas de 15 × 15 y las coordenadas de superficie (`enabled` o `use_contour`).
- `GET /api/spaces`: lista solo espacios activados.
- `GET /api/spaces?q=sala&type=Sala&floor=1&accessible=true`: filtra por texto, tipo, piso y accesibilidad; todos los parámetros son opcionales.
- `GET /api/admin/session`: devuelve si hay una sesión admin activa.
- `POST /api/admin/login`: autentica usuario y contraseña.
- `POST /api/admin/logout`: cierra la sesión.
- `GET /api/admin/slots?floor=1`: lista todas las casillas de un piso; requiere sesión admin.
- `PATCH /api/admin/floors/:floor/slots`: guarda juntos hasta 225 casillas (nombre, tipo, visibilidad, contorno, accesibilidad y descripción) en una transacción; requiere sesión admin.
- `PATCH /api/admin/floors/:floor/active`: agrega o desactiva un piso/subterráneo siguiendo el orden y los límites establecidos; requiere sesión admin.
- `PATCH /api/admin/slots/:id`: guarda una casilla individual; `name` es opcional y admite hasta 60 caracteres; requiere sesión admin.

Los tipos principales admitidos son `Sala`, `Laboratorio`, `Administrativo` y `Espacio común`. Los espacios comunes requieren una categoría de `Baño hombre`, `Baño mujer`, `Escalera`, `Ascensor` o `Comida`; los tipos de baño independientes ya no se aceptan. La migración convierte los tipos de baño existentes en espacios comunes y conserva su categoría. Los filtros inválidos devuelven estado HTTP `400` con un mensaje JSON. Las rutas de edición requieren sesión y las contraseñas no se envían al frontend después del login.

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
- `feature/resizable-floor-plan`: ajuste persistente del tamaño de los brazos del plano por piso.

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
