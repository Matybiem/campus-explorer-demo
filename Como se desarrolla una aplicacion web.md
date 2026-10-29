# Cómo se desarrolla una aplicación web

Este documento está escrito para que un agente de IA lo utilice como guía al desarrollar una aplicación web completa, desde el inicio hasta el despliegue. Incluye mejores prácticas, especificaciones técnicas, etapas del proceso, flujo TDD y las preguntas clave que la IA debe hacer al usuario antes de escribir código.

---

## 1. Preguntas iniciales que la IA debe hacer al usuario

Antes de escribir una sola línea de código, la IA debe obtener respuestas claras a estas preguntas:

| # | Pregunta | Por qué importa |
|---|----------|-----------------|
| 1 | ¿Cuál es el propósito principal de la aplicación y quiénes son los usuarios? | Define el alcance, funcionalidades prioritarias y decisiones de UX. |
| 2 | ¿Qué tipo de aplicación es? (SPA, MPA, sitio estático, dashboard, e-commerce, etc.) | Determina la arquitectura, el enrutamiento y la necesidad de estado del cliente. |
| 3 | ¿Qué stack tecnológico se prefiere o está restringido? (lenguaje, framework, base de datos) | Evita reescrituras y asegura compatibilidad con el equipo o infraestructura existente. |
| 4 | ¿Hay requisitos de autenticación y autorización? ¿Qué roles de usuario existen? | Afecta el diseño de rutas protegidas, middlewares y modelo de datos de usuarios. |
| 5 | ¿Qué datos se necesitan almacenar y cuáles son sus relaciones? | Define el esquema de base de datos y las migraciones necesarias. |
| 6 | ¿La aplicación necesita consumir APIs externas? ¿Cuáles y con qué autenticación? | Determina la capa de integración y manejo de claves secretas. |
| 7 | ¿Cuál es el público objetivo y qué dispositivos usarán? (móvil, desktop, ambos) | Afecta el diseño responsive y las decisiones de CSS/maquetación. |
| 8 | ¿Hay requisitos de accesibilidad (WCAG)? | Influye en el marcado semántico, ARIA, contraste y navegación por teclado. |
| 9 | ¿Cuál es el entorno de despliegue esperado? (VPS, TrueNAS, Docker, serverless, estático) | Define cómo se construye, empaqueta y sirve la aplicación. |
| 10 | ¿Hay un presupuesto o límite de tiempo para el desarrollo? | Prioriza funcionalidades MVP vs. mejoras futuras. |
| 11 | ¿Existen normas de diseño o marca que seguir? (colores, tipografía, logo) | Establece el sistema de diseño y componentes UI. |
| 12 | ¿Se requiere internacionalización (i18n)? | Afecta la estructura de textos y formato de fechas/números. |

---

## 2. Especificaciones técnicas recomendadas

### 2.1 Frontend

| Aspecto | Especificación recomendada |
|---------|---------------------------|
| Framework | React 18+ con TypeScript |
| Herramienta de build | Vite |
| Estilos | CSS moderno con variables CSS, diseño responsive (mobile-first), Flexbox/Grid |
| Iconos | SVG inline (Tabler Icons o similares), sin dependencia de librerías de iconos pesadas |
| Gestión de estado | `useState`, `useReducer` o Context API para estado global simple; evitar Redux a menos que sea necesario |
| Ruteo | React Router (si es SPA con múltiples vistas) |
| Validación de formularios | Validación nativa HTML5 + validación en TypeScript en el frontend |
| Llamadas API | `fetch` nativo o `axios` con interceptores para auth y manejo de errores |
| Accesibilidad | HTML semántico, atributos ARIA, navegación por teclado, foco visible, contraste mínimo 4.5:1 |

### 2.2 Backend

| Aspecto | Especificación recomendada |
|---------|---------------------------|
| Runtime | Node.js 20+ |
| Framework | Express |
| Lenguaje | JavaScript (ES modules) o TypeScript |
| Base de datos | PostgreSQL con driver `pg` |
| Autenticación | Sesiones con `express-session` + `connect-pg-simple`, contraseñas con `bcryptjs` |
| Seguridad | `helmet`, `express-rate-limit`, CORS configurado, cookies `HttpOnly` y `Secure` |
| Validación | Validación de entrada en cada endpoint (tipo, rango, formato) |
| Manejo de errores | Middleware centralizado, respuestas JSON consistentes con códigos HTTP apropiados |
| Logging | `morgan` o similar para requests, consola para errores de aplicación |

### 2.3 Base de datos (PostgreSQL)

| Aspecto | Especificación recomendada |
|---------|---------------------------|
| Driver | `pg` (node-postgres) |
| Conexión | Pool de conexiones con `pg.Pool` |
| Migraciones | Scripts SQL versionados o migraciones programáticas en `database.js` |
| Tipos de datos | Usar tipos nativos de PostgreSQL (`text`, `integer`, `boolean`, `timestamp`) |
| Índices | Índices en columnas usadas frecuentemente en `WHERE` y `JOIN` |
| Transacciones | Usar `BEGIN`/`COMMIT`/`ROLLBACK` para operaciones que afectan múltiples tablas |
| Backups | Estrategia de respaldo definida para producción |

### 2.4 Estructura de carpetas recomendada

```
proyecto/
├── backend/
│   ├── app.js          # Configuración Express, rutas, middlewares
│   ├── database.js     # Esquema, conexión, migraciones, datos iniciales
│   ├── repositories.js # Consultas SQL a la base de datos
│   ├── server.js       # Inicio del servidor HTTP
│   ├── test/           # Pruebas automatizadas (node:test, vitest, etc.)
│   └── data/           # Datos ficticios para poblar inicialmente
├── frontend/
│   ├── src/
│   │   ├── App.tsx     # Componente principal
│   │   ├── components/ # Componentes reutilizables
│   │   ├── pages/      # Vistas de la aplicación
│   │   ├── services/   # Clientes de API (fetch/axios)
│   │   ├── types.ts    # Tipos TypeScript compartidos
│   │   ├── styles.css  # Estilos globales
│   │   └── icons.tsx   # Iconos SVG inline
│   ├── vite.config.ts  # Configuración Vite y proxy /api
│   └── index.html      # Punto de entrada
├── docker-compose.yml  # Orquestación para desarrollo (PostgreSQL + app)
├── .env.example        # Plantilla de variables de entorno
├── README.md           # Documentación del proyecto
└── .gitignore          # Archivos excluidos del control de versiones
```

---

## 3. Etapas del desarrollo

### Etapa 1: Planeación y requisitos
- Responder las 12 preguntas iniciales
- Definir MVP (funcionalidades mínimas viables)
- Diseñar esquema de base de datos
- Definir endpoints de la API
- Elegir stack tecnológico

### Etapa 2: Configuración del entorno
- Inicializar repositorio Git
- Crear estructura de carpetas
- Configurar `.env.example` y `.gitignore`
- Instalar dependencias (backend y frontend)
- Configurar PostgreSQL local (Docker o instalador)

### Etapa 3: Backend - API y base de datos
- Implementar conexión a PostgreSQL
- Crear esquemas y tablas
- Implementar endpoints REST (GET, POST, PATCH, DELETE)
- Implementar autenticación y autorización
- Escribir pruebas de API (TDD)

### Etapa 4: Frontend - Interfaz y consumo de API
- Crear componentes base
- Implementar llamadas a la API
- Conectar frontend con backend
- Implementar navegación y enrutamiento
- Diseño responsive y accesible

### Etapa 5: Pruebas y calidad
- Pruebas unitarias y de integración (backend)
- Pruebas de extremo a extremo (opcional)
- Lint y typecheck
- Build de producción

### Etapa 6: Despliegue
- Configurar variables de entorno de producción
- Construir imagen Docker o preparar servidor
- Desplegar base de datos y aplicación
- Verificar salud del sistema

---

## 4. TDD (Test-Driven Development) para el backend

### Flujo TDD

1. **Red**: Escribir una prueba que falle (endpoint aún no existe o no hace lo esperado)
2. **Green**: Escribir el mínimo código para que la prueba pase
3. **Refactor**: Mejorar el código sin romper las pruebas
4. Repetir

### Ejemplo de estructura de prueba (Node.js `node:test`)

```javascript
import test from 'node:test'
import assert from 'node:assert/strict'

test('endpoint devuelve lista de espacios filtrados', async () => {
  const response = await fetch(`${baseUrl}/api/spaces?type=Sala`)
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.ok(Array.isArray(data))
  data.forEach(space => assert.equal(space.type, 'Sala'))
})
```

### Reglas TDD
- No escribir código de producción sin una prueba que falle primero
- Una prueba por comportamiento específico
- Las pruebas deben ser independientes entre sí
- Usar mocks o repositorios simulados para no depender de BD real en pruebas unitarias

---

## 5. Mejores prácticas generales

### Seguridad
- Nunca guardar secretos en el repositorio (usar `.env`)
- Contraseñas siempre con hash (bcrypt, nunca texto plano)
- Cookies de sesión: `HttpOnly`, `Secure`, `SameSite=Strict`
- Validar toda entrada del usuario en el backend
- Rate limiting en endpoints de login y escritura
- Helmet para headers de seguridad

### Calidad de código
- TypeScript en frontend para tipado estático
- Nombres de variables y funciones en inglés, descriptivos
- Funciones pequeñas y con una sola responsabilidad
- Comentarios solo cuando el código no es autoexplicativo (evitar comentarios obvios)
- Formato consistente (Prettier o similar)

### Rendimiento
- Construir para producción (`npm run build`) antes de desplegar
- Servir archivos estáticos del frontend desde nginx/CDN
- Índices de base de datos en columnas filtradas frecuentemente
- Paginación en listados grandes

### Accesibilidad
- HTML semántico (`<header>`, `<main>`, `<section>`, `<nav>`, etc.)
- Atributos `aria-label`, `aria-describedby` cuando sea necesario
- Navegación completa por teclado
- Contraste de color mínimo WCAG AA (4.5:1)
- Imágenes con `alt` descriptivo

---

## 6. Despliegue en producción

### Flujo de trabajo con Git y Pull Requests

Todo el desarrollo se hace en ramas de feature y se integra mediante pull requests:

1. Crear rama desde `main`: `git checkout -b feature/nombre-funcionalidad`
2. Hacer cambios y commit: `git commit -m "feat(area): descripción"`
3. Push a GitHub: `git push origin feature/nombre-funcionalidad`
4. Crear Pull Request en GitHub (base: `main`, compare: rama de feature)
5. Revisión y aprobación del PR
6. Merge a `main`
7. Sincronizar local: `git checkout main && git pull origin main`

### Variables de entorno requeridas (.env)

```
DATABASE_URL=postgresql://usuario:password@host:puerto/basededatos
SESSION_SECRET=secreto_al_menos_48_bytes_hex
ADMIN_USERNAME=admin
ADMIN_PASSWORD=contraseña_segura_14_o_mas_bytes
PORT=3001
NODE_ENV=production
DB_PASSWORD=password_para_postgres
```

### Pasos de despliegue con Docker Compose (TrueNAS)

1. Clonar repositorio en el servidor: `git clone <url>`
2. Copiar `.env.example` a `.env` y configurar valores
3. Levantar servicios: `docker compose up -d`
4. Verificar salud: `docker compose ps` y `curl http://localhost:3001/api/health`
5. Acceder al frontend: `http://IP_SERVIDOR:80`

### Pasos de despliegue sin Docker (alternativa)

1. Construir frontend: `npm run build --prefix frontend`
2. Configurar variables de entorno en el servidor
3. Iniciar PostgreSQL
4. Ejecutar migraciones de base de datos
5. Iniciar backend: `npm start --prefix backend`
6. Servir `frontend/dist/` con nginx o similar
7. Verificar endpoint `/api/health`

---

## 7. Comandos útiles

```powershell
# Backend
npm install --prefix backend
npm run dev --prefix backend      # Desarrollo con --watch
npm test --prefix backend         # Pruebas
npm start --prefix backend        # Producción

# Frontend
npm install --prefix frontend
npm run dev --prefix frontend     # Servidor de desarrollo Vite
npm run build --prefix frontend   # Build de producción (genera dist/)

# Docker Compose
docker compose up -d              # Levantar todos los servicios
docker compose down               # Detener servicios
docker compose logs -f            # Ver logs en tiempo real
docker compose ps                 # Ver estado de contenedores
docker compose up -d --build      # Reconstruir imágenes y levantar

# Utilidades
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"  # Generar SESSION_SECRET
```

---

## 8. Lista de verificación antes de entregar

- [ ] Todas las preguntas iniciales respondidas y documentadas
- [ ] Esquema de base de datos diseñado y migrado
- [ ] Endpoints API implementados y probados
- [ ] Autenticación y autorización funcionando
- [ ] Frontend conectado al backend
- [ ] Diseño responsive verificado en móvil y desktop
- [ ] Accesibilidad básica verificada (teclado, contraste, ARIA)
- [ ] Pruebas de backend pasando (100%)
- [ ] Build de frontend exitoso
- [ ] Variables de entorno configuradas (no hardcodeadas)
- [ ] `.gitignore` excluyendo `.env`, `node_modules`, `dist`
- [ ] Pull Request creado y mergeado a `main`
- [ ] Documentación actualizada (README y este manual)

---

*Documento vivo: actualizar este archivo cada vez que se agreguen funcionalidades importantes al proyecto.*