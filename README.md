# Campus Explorer

Prototipo de portafolio para explorar salas y servicios de un campus ficticio. Está pensado como punto de partida para aprender React, TypeScript y desarrollo frontend; no representa una sede universitaria real.

## Requisitos

- Node.js 20.19+ (o 22.12+)
- npm

## Ejecutar en desarrollo

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

Abre `http://localhost:5173`. Durante el desarrollo, Vite reenvía las peticiones `/api` al backend en `http://localhost:3001`.

## API

- `GET /api/health`: comprueba que la API está funcionando.
- `GET /api/spaces`: lista los espacios ficticios.
- `GET /api/spaces?q=sala&type=Sala&floor=1&accessible=true`: filtra por texto, tipo, piso y accesibilidad. Todos los filtros son opcionales.

Los filtros permitidos para `type` son `Sala`, `Laboratorio`, `Baño` y `Servicio`. Los filtros inválidos responden con estado `400` y un mensaje JSON.

Ejecuta las pruebas de la API desde `backend`:

```powershell
npm test
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

## Compilar el frontend

```powershell
cd frontend
npm run build
```
