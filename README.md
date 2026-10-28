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
- Filtros por tipo, categoría y accesibilidad desde un panel lateral con botonera («Filtros»).
- Selección de piso y espacios en el plano o en la lista.
- Panel con detalles ficticios del espacio seleccionado.
- Plano interactivo editable como matriz fija de 15 × 15 casillas por nivel; el contorno configurable define la superficie visible del piso sin mostrar casillas ocultas como salas.
- Paredes 3D sobre los contornos activos de cada piso, tanto en la vista de un solo piso como en «Ver todos los pisos»: se levantan en el borde de la superficie visible, con una altura igual al ancho de una casilla (`wallHeight` en `frontend/src/App.tsx`), son translúcidas para no ocultar las salas y no interceptan clics.
- Controles de rotación, inclinación y zoom (20 % a 140 %); la rueda del ratón sobre el mapa cambia el zoom (hacia arriba acerca, hacia abajo aleja) en lugar de desplazarlo. La vista inicial es inclinada y la opción «Vista plana» cambia a una vista superior. Con el clic izquierdo sostenido y movido sobre el mapa (más de 5 px) se orbita: el movimiento horizontal cambia la rotación y el vertical la inclinación (arrastrar hacia arriba inclina más). Un clic sin movimiento sigue seleccionando la sala. Con el clic derecho sostenido se desplaza el plano («mano»).
- Botón «Ver todos los pisos»: muestra todos los niveles activos apilados como planos de 15 × 15 alineados sobre el eje Z, con el piso más alto arriba. La separación entre pisos es igual a la altura de las paredes, de modo que cada pared llega justo al piso de arriba; el piso seleccionado queda separado del que tiene encima.
- En modo administración, mantener presionado el clic izquierdo sobre una casilla sin moverse durante 0,4 s y soltarla sobre otra intercambia sus datos como un cambio pendiente; si el cursor se mueve antes de ese tiempo, el gesto gira el mapa.
- Panel admin protegido junto al mapa para activar u ocultar casillas y editar el nombre y tipo de cada espacio; el nombre puede quedar vacío y en ese caso se muestra el código de la casilla. En modo administración se muestran todas las casillas y las ocultas aparecen en gris.
- En modo administración se pueden editar las 225 casillas del nivel, incluidas las ocultas, y definir cuáles ocultas forman parte del contorno del piso. Las casillas visibles siempre forman parte del contorno.
- El perfil de administrador puede agregar y desactivar niveles en orden: hasta 10 pisos y 5 subterráneos. Solo se desactiva el último nivel de cada secuencia, el Piso 1 permanece activo y las salas se conservan al desactivar un nivel.
- Diseño adaptable a pantallas pequeñas.
- API REST con Node.js y Express.

El plano actual es un esquema CSS interactivo, no un modelo arquitectónico ni un visor 3D.

## Requerimientos funcionales

Cada requerimiento describe qué puede hacer la aplicación y las reglas que cumple. Los valores configurables se indican con el nombre de su constante en `frontend/src/App.tsx`.

### RF-01 Consulta del mapa por piso

El mapa muestra los espacios de un piso sobre una cuadrícula fija, con la superficie del piso y sus paredes.

- **Cuadrícula fija:** cada piso es una matriz de 15 × 15 casillas. Solo las casillas visibles se muestran como salas.
- **Contorno:** la superficie del piso se dibuja con las casillas visibles y con las ocultas marcadas con «Usar contorno».
- **Paredes:** se levantan en cada borde exterior del contorno, con una altura igual al ancho de una casilla (`wallHeight`). Son translúcidas, así que las salas se siguen viendo, y no interceptan los clics.
- **Selector de nivel:** lista solo los niveles activos, de arriba hacia abajo: Piso 4, Piso 3, Piso 2, Piso 1, Subterráneo 1, Subterráneo 2.
- **Selección:** un clic sobre una sala la resalta y muestra su detalle.
- **Tipos y categorías:** cada tipo de espacio y cada categoría de espacio común tiene su propio color e icono.

### RF-02 Navegación del mapa

El usuario controla la cámara del mapa con el ratón o con los controles de la parte inferior.

- **Rotación e inclinación:** los deslizadores rotan el plano entre -180° y 180° y lo inclinan entre 0° y 90°.
- **Zoom:** el zoom queda entre 20 % y 140 % (`minZoom` y `maxZoom`). Se ajusta con el deslizador, con los botones + y − (10 puntos por pulsación) y con la rueda del ratón sobre el mapa (5 puntos por «clic», con `wheelZoomPerPixel`).
- **Rueda del ratón:** la rueda sobre el mapa cambia el zoom en lugar de desplazarlo. Fuera del mapa, la página se desplaza como siempre.
- **Orbitar:** al mantener el clic izquierdo y mover el ratón más de 5 px (`orbitThresholdPx`), el movimiento horizontal cambia la rotación y el vertical la inclinación (hacia arriba inclina más). Un clic sin movimiento selecciona la sala.
- **Mover el mapa:** con el clic derecho sostenido el plano se arrastra como una mano. También se puede mover con las barras de desplazamiento. Sobre el mapa no aparece el menú contextual del navegador.
- **Vistas predefinidas:** «Restablecer vista» vuelve a la vista inclinada inicial (`defaultView`) y «Vista plana» muestra el mapa desde arriba (`flatView`).
- **Margen:** el plano queda rodeado de un margen amplio (`mapCanvasPadding`) para poder moverlo sin que toque el borde.

### RF-03 Vista de todos los pisos

El botón «Ver todos los pisos» muestra todos los niveles activos apilados en el eje Z.

- **Piso por defecto:** cada vez que se activa la vista, el piso seleccionado pasa a ser el más alto. Después se puede elegir otro piso desde el selector.
- **Planos alineados:** cada piso es un plano de 15 × 15 con el mismo origen, así que la casilla (x, y) de un piso queda sobre la (x, y) del piso de abajo.
- **Orden:** el piso más alto va arriba y cada plano lleva una etiqueta con su nombre.
- **Separación:** la distancia entre pisos es igual a la altura de las paredes (`stackLayerGap`), de modo que cada pared llega justo al piso de arriba. El piso seleccionado queda más separado del que tiene encima (`stackSelectedGap`).
- **Paredes:** cada piso dibuja las paredes de su propio contorno.
- **Selección:** un clic sobre una sala la selecciona y cambia al piso al que pertenece.
- **Controles:** la rotación, la inclinación y el zoom funcionan igual que en la vista de un piso.
- **Administración:** el botón se oculta en modo administración, que siempre edita un solo piso.

### RF-04 Búsqueda y filtros

El usuario encuentra espacios por texto y con filtros, en todos los pisos a la vez.

- **Búsqueda:** el campo de texto busca por nombre, código, tipo o categoría, sin distinguir mayúsculas y minúsculas.
- **Alcance:** la búsqueda recorre todos los pisos, no solo el seleccionado.
- **Filtros:** el botón «Filtros», debajo del campo de búsqueda, abre un panel lateral izquierdo con una botonera de nueve botones: Sala, Laboratorio, Administrativo, Baño hombre, Baño mujer, Escalera, Ascensor, Comida y Accesible. Los botones de tipo y categoría activos se ven a color (con el color e icono de cada uno) y los desactivados en gris. Al abrir el panel están todos activos, de modo que se muestran todos los espacios; al desactivar uno, sus espacios se ocultan. «Accesible» empieza desactivado y, al activarlo, solo se muestran los espacios accesibles.
- **Panel de filtros:** se cierra con el botón ✕, con la tecla Esc o volviendo a pulsar «Filtros». No oscurece la página, así que el mapa y los resultados se actualizan mientras se eligen los filtros. Incluye el número de resultados y el botón «Restablecer filtros».
- **Indicador:** el botón «Filtros» muestra una insignia con el número de filtros activos (tipos desactivados más «Accesible»); sin insignia, no hay ninguno.
- **Resultados:** la lista muestra el icono, el nombre, el tipo y el nivel de cada espacio, junto con el número de resultados.
- **Ir al espacio:** al elegir un resultado, el mapa cambia al piso del espacio y lo selecciona.
- **Mapa:** las salas que no coinciden con la búsqueda se atenúan y no se pueden seleccionar.
- **Sin resultados:** se muestra un aviso con el botón «Limpiar filtros», que borra el texto y restablece todos los filtros.

### RF-05 Detalle de un espacio

Al seleccionar un espacio, el panel lateral muestra su información.

- **Encabezado:** una etiqueta con el tipo, con su icono y color (para un espacio común incluye la categoría), y el nombre del espacio. Si no tiene nombre, se muestra su código.
- **Datos:** código, piso y capacidad referencial (solo si existe).
- **Accesibilidad:** indica «Accesible» o «No indicada».
- **Descripción:** se muestra entre la accesibilidad y la nota de información ficticia.
- **Ver en el mapa:** el botón «Ver … en el mapa» cambia al piso del espacio y lo selecciona.

### RF-06 Acceso del administrador

La edición del mapa requiere iniciar sesión como administrador.

- **Inicio de sesión:** el botón «Administrar» abre el panel con usuario (hasta 40 caracteres) y contraseña (hasta 72).
- **Sesión:** la sesión se guarda en una cookie `HttpOnly` y dura 8 horas. El botón «Salir» la cierra.
- **Intentos:** se permiten 8 intentos de inicio de sesión cada 15 minutos.
- **Contraseñas:** se guardan con hash bcrypt y nunca se envían al frontend.
- **Rutas protegidas:** todas las rutas de edición exigen sesión. Sin ella responden con el estado `401`.
- **Cerrar la administración:** los botones «Cerrar administración» y «Salir» se bloquean mientras haya cambios sin guardar.

### RF-07 Edición de casillas

El administrador edita cualquiera de las 225 casillas del piso, incluidas las ocultas.

- **Mapa de edición:** muestra todas las casillas del piso. Las ocultas aparecen en gris.
- **Visibilidad:** el interruptor «Visible» o «Oculta» decide si la casilla se muestra como sala en el mapa público.
- **Tipo:** se elige primero el tipo: Sala, Laboratorio, Administrativo o Espacio común.
- **Nombre:** es opcional y admite hasta 60 caracteres. Si queda vacío, se muestra el código de la casilla.
- **Categoría:** para un Espacio común, el nombre se reemplaza por una categoría obligatoria: Baño hombre, Baño mujer, Escalera, Ascensor o Comida. Cada una se elige en un desplegable con su icono y color.
- **Accesibilidad:** la casilla «Espacio accesible» marca si el espacio es accesible.
- **Usar contorno:** decide si una casilla oculta forma parte de la superficie del piso. Mientras la casilla es visible, esta opción queda marcada y no se puede desmarcar. Se conserva al ocultarla.
- **Descripción:** texto opcional de hasta 500 caracteres.

### RF-08 Guardado de cambios

Los cambios se acumulan y se guardan todos juntos.

- **Cambios pendientes:** cada edición queda pendiente. El botón «Guardar cambios (N)» muestra cuántas casillas se modificaron.
- **Guardado conjunto:** el botón guarda todas las casillas modificadas del piso en una sola petición, hasta 225.
- **Consistencia:** el guardado es una transacción. Si algo falla, no se guarda ninguna casilla.
- **Bloqueo:** con cambios pendientes no se puede cambiar de piso, cerrar la administración ni modificar los niveles.
- **Confirmación:** al terminar se informa cuántos cambios se guardaron.

### RF-09 Gestión de niveles

El administrador agrega y desactiva pisos y subterráneos.

- **Límites:** hasta 10 pisos y 5 subterráneos. Los contadores muestran cuántos hay activos.
- **Orden:** los botones «＋ Piso» y «＋ Subterráneo» activan el siguiente nivel de su secuencia, sin dejar huecos.
- **Desactivar:** el botón «−» desactiva solo el último nivel de cada secuencia. El Piso 1 no se puede desactivar.
- **Datos conservados:** un nivel desactivado desaparece del selector y del mapa público, pero conserva sus casillas para poder reactivarlo.
- **Bloqueo:** los botones se deshabilitan mientras hay cambios pendientes.

### RF-10 Intercambio de casillas

El administrador reubica el contenido de una casilla arrastrándola.

- **Gesto:** mantener presionado el clic izquierdo sobre una casilla sin moverse durante 0,4 s (`slotDragDelayMs`) y soltarla sobre otra.
- **Resultado:** las dos casillas intercambian su contenido (visibilidad, tipo, nombre, categoría, accesibilidad, contorno y descripción). Sus posiciones no cambian.
- **Pendiente:** el intercambio queda como un cambio pendiente y se guarda con el resto.
- **Orbitar:** si el cursor se mueve antes de los 0,4 s, el gesto gira el mapa en lugar de intercambiar.
- **Resaltado:** la casilla de origen se atenúa y la de destino se resalta mientras se arrastra.

### RF-11 Estado de la conexión

La aplicación informa cuando carga los datos o cuando falla la conexión.

- **Carga:** mientras se piden los espacios se muestra el mensaje «Cargando espacios de demostración…».
- **Error:** si la API no responde o devuelve un formato inválido, se muestra el motivo y un botón «Reintentar».
- **Datos reales:** la aplicación no muestra datos inventados como si la API hubiera respondido.

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
