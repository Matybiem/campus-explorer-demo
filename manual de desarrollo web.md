# Manual de Desarrollo Web para Agentes de IA

Este manual está diseñado como referencia completa para agentes de inteligencia artificial que desarrollan aplicaciones web. Incluye especificaciones técnicas, mejores prácticas, etapas de desarrollo, flujo TDD, preguntas de clarificación y patrones de código reutilizables.

---

## Tabla de contenidos

1. [Fase de descubrimiento: preguntas al usuario](#fase-de-descubrimiento)
2. [Especificaciones técnicas](#especificaciones-técnicas)
3. [Esquema de base de datos](#esquema-de-base-de-datos)
4. [Arquitectura de la aplicación](#arquitectura-de-la-aplicación)
5. [Flujo de desarrollo TDD](#flujo-de-desarrollo-tdd)
6. [Patrones de código y mejores prácticas](#patrones-de-código-y-mejores-prácticas)
7. [Seguridad](#seguridad)
8. [Accesibilidad](#accesibilidad)
9. [Despliegue](#despliegue)
10. [Lista de verificación final](#lista-de-verificación-final)

---

## Fase de descubrimiento: preguntas al usuario

Antes de iniciar el desarrollo, el agente debe obtener respuestas a estas preguntas críticas:

### Negocio y alcance
1. ¿Cuál es el problema principal que resuelve esta aplicación?
2. ¿Quiénes son los usuarios finales y qué roles tendrán?
3. ¿Cuál es el MVP (versión mínima viable) y qué funcionalidades son post-MVP?

### Técnico
4. ¿Qué stack tecnológico se requiere o prefiere? (lenguaje, framework, BD, hosting)
5. ¿Existe una base de datos ya definida o hay que crearla desde cero?
6. ¿Se necesitan integraciones con APIs externas? ¿Cuáles?
7. ¿Hay requisitos de autenticación y autorización?
8. ¿Se requiere internacionalización (i18n)?
9. ¿Cuál es el entorno de despliegue objetivo?

### Diseño y UX
10. ¿Hay un sistema de diseño o marca que seguir? (colores, tipografía, componentes)
11. ¿Qué dispositivos deben soportarse? (móvil, tablet, desktop)
12. ¿Hay requisitos de accesibilidad (WCAG)?

### Restricciones
13. ¿Cuál es el plazo estimado para el desarrollo?
14. ¿Existen limitaciones de presupuesto o infraestructura?

---

## Especificaciones técnicas

### Frontend

| Capa | Tecnología recomendada | Justificación |
|------|----------------------|---------------|
| Framework | React 18+ + TypeScript | Tipado estático, ecosistema maduro |
| Build tool | Vite | Rápido, configuración mínima, HMR |
| Estilos | CSS nativo con variables CSS | Sin dependencias pesadas, fácil mantenimiento |
| Iconos | SVG inline (Tabler Icons) | Ligero, personalizable, sin npm package |
| Estado | React hooks (`useState`, `useReducer`, Context) | Suficiente para la mayoría de aplicaciones |
| Formularios | Validación nativa HTML5 + TypeScript | Menos dependencias, mejor rendimiento |
| API calls | `fetch` nativo o `axios` | Simple y estándar |
| Ruteo | React Router (si SPA multi-vista) | Estándar de la industria |

### Backend

| Capa | Tecnología recomendada | Justificación |
|------|----------------------|---------------|
| Runtime | Node.js 20+ | LTS, amplio ecosistema |
| Framework | Express | Minimalista, flexible, maduro |
| Lenguaje | JavaScript ES Modules | Simplicidad, sin paso de compilación extra |
| Base de datos | PostgreSQL | Relacional, ACID, ampliamente soportado |
| Driver | `pg` (node-postgres) | Oficial, estable |
| Autenticación | `express-session` + `bcryptjs` | Sesiones servidor, contraseñas hasheadas |
| Seguridad | `helmet`, `express-rate-limit` | Protección básica contra ataques comunes |

### Base de datos (PostgreSQL)

| Elemento | Especificación |
|----------|---------------|
| Driver | `pg.Pool` para conexiones reutilizables |
| Migraciones | Scripts SQL versionados en `database.js` |
| Tipos | `text`, `integer`, `boolean`, `timestamp`, `jsonb` |
| Índices | En columnas usadas en `WHERE`, `JOIN`, `ORDER BY` |
| Transacciones | `BEGIN`/`COMMIT`/`ROLLBACK` para writes múltiples |
| Backups | Estrategia definida para producción |

---

## Esquema de base de datos (ejemplo Campus Explorer)

```sql
-- Tabla de pisos/niveles
CREATE TABLE floor_plans (
  floor INTEGER PRIMARY KEY,
  horizontal_length INTEGER DEFAULT 15,
  vertical_length INTEGER DEFAULT 15,
  enabled BOOLEAN DEFAULT TRUE
);

-- Tabla de espacios/casillas
CREATE TABLE space_slots (
  id TEXT PRIMARY KEY,
  floor INTEGER REFERENCES floor_plans(floor),
  x INTEGER CHECK (x >= 0 AND x < 15),
  y INTEGER CHECK (y >= 0 AND y < 15),
  type TEXT CHECK (type IN ('Sala', 'Laboratorio', 'Administrativo', 'Espacio común', 'Otro')),
  category TEXT CHECK (category IN ('Baño hombre', 'Baño mujer', 'Escalera', 'Ascensor', 'Comida') OR category IS NULL),
  name TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  use_contour BOOLEAN DEFAULT FALSE,
  capacity INTEGER,
  accessible BOOLEAN DEFAULT FALSE,
  description TEXT,
  custom_code TEXT,
  UNIQUE(floor, x, y)
);

-- Tabla de sesiones de admin
CREATE TABLE sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP NOT NULL
);

-- Tabla de admin users
CREATE TABLE admin_users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);
```

---

## Arquitectura de la aplicación

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (Frontend)                    │
│  React + TypeScript + Vite                              │
│  - Componentes UI                                       │
│  - Gestión de estado local                              │
│  - Llamadas a API vía fetch                             │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTPS / HTTP
┌──────────────────────▼───────────────────────────────────┐
│                   SERVIDOR (Backend)                     │
│  Express + Node.js                                       │
│  - Rutas REST API                                        │
│  - Middleware de autenticación (sesiones)                │
│  - Validación de entrada                                 │
│  - Manejo centralizado de errores                        │
└──────────────────────┬───────────────────────────────────┘
                       │ pg (node-postgres)
┌──────────────────────▼───────────────────────────────────┐
│                 BASE DE DATOS (PostgreSQL)               │
│  - Tablas: floor_plans, space_slots, sessions, etc.      │
│  - Índices, transacciones, constraints                   │
└─────────────────────────────────────────────────────────┘
```

---

## Flujo de desarrollo TDD

### Ciclo Red-Green-Refactor

```
1. RED:    Escribir prueba que falle
2. GREEN:  Escribir código mínimo para pasar
3. REFACTOR: Mejorar código sin romper pruebas
4. REPETIR
```

### Ejemplo de prueba con Node.js `node:test`

```javascript
import test from 'node:test'
import assert from 'node:assert/strict'

test('POST /api/admin/login rechaza credenciales incorrectas', async () => {
  const response = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'wrong' })
  })
  assert.equal(response.status, 401)
  const body = await response.json()
  assert.equal(body.error, 'Credenciales incorrectas')
})
```

### Reglas TDD obligatorias

1. **No hay código de producción sin una prueba que falle primero**
2. **Una prueba = un comportamiento específico**
3. **Las pruebas no dependen entre sí** (pueden ejecutarse en cualquier orden)
4. **Usar mocks/repositorios simulados** para pruebas unitarias sin BD real
5. **Refactorizar solo cuando todas las pruebas pasan**

---

## Patrones de código y mejores prácticas

### Componentes React (TypeScript)

```tsx
// Buen ejemplo: componente tipado, props explícitas, sin comentarios obvios
type ButtonProps = {
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}

export function Button({ label, onClick, disabled = false, variant = 'primary' }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant} ${disabled ? 'btn-disabled' : ''}`}
      type="button"
    >
      {label}
    </button>
  )
}
```

### Endpoints Express

```javascript
// Patrón: validar → procesar → responder con JSON
app.patch('/api/admin/slots/:id', async (request, response) => {
  // 1. Validar autenticación
  if (!request.session.admin) {
    return response.status(401).json({ error: 'No autenticado' })
  }

  // 2. Validar entrada
  const { type, name, category } = request.body
  if (!spaceTypes.has(type)) {
    return response.status(400).json({ error: 'Tipo inválido' })
  }

  // 3. Procesar en transacción
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await repositories.updateSlot(...)
    await client.query('COMMIT')
    response.json(result)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    response.status(500).json({ error: 'Error interno' })
  } finally {
    client.release()
  }
})
```

### Manejo de estado en React

```tsx
// Usar useReducer para estado complejo con múltiples acciones
type SpaceState = {
  spaces: Space[]
  loading: boolean
  error: string | null
}

type SpaceAction =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; payload: Space[] }
  | { type: 'LOAD_ERROR'; payload: string }

function spaceReducer(state: SpaceState, action: SpaceAction): SpaceState {
  switch (action.type) {
    case 'LOAD_START': return { ...state, loading: true, error: null }
    case 'LOAD_SUCCESS': return { ...state, loading: false, spaces: action.payload }
    case 'LOAD_ERROR': return { ...state, loading: false, error: action.payload }
    default: return state
  }
}
```

---

## Seguridad

### Checklist de seguridad obligatorio

- [ ] Contraseñas hasheadas con bcrypt (nunca texto plano)
- [ ] Cookies de sesión: `HttpOnly`, `Secure` (en producción), `SameSite=Strict`
- [ ] `helmet` middleware para headers de seguridad
- [ ] `express-rate-limit` en endpoints de login y escritura
- [ ] Validación de entrada en TODOS los endpoints (tipo, rango, formato)
- [ ] Nunca exponer detalles internos de errores al cliente
- [ ] `.env` en `.gitignore`, nunca subir secretos al repositorio
- [ ] Consultas parametrizadas (evitar SQL injection) — `pg` lo hace automático con `$1`, `$2`

---

## Accesibilidad (WCAG 2.1 AA)

### Checklist de accesibilidad

- [ ] HTML semántico (`<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`, `<button>`, `<a>`)
- [ ] Navegación completa por teclado (Tab, Enter, Space, Esc)
- [ ] Foco visible en elementos interactivos
- [ ] Contraste de color mínimo 4.5:1 para texto normal, 3:1 para texto grande
- [ ] Atributos `aria-label`, `aria-describedby`, `aria-expanded` cuando sea necesario
- [ ] Imágenes con atributo `alt` descriptivo o `alt=""` si decorativas
- [ ] Formularios con `<label>` asociado a cada `<input>`
- [ ] Mensajes de error asociados a campos con `aria-describedby`
- [ ] Idioma del documento definido (`<html lang="es">`)

---

## Despliegue

### Flujo de trabajo con Git y Pull Requests

Todo el desarrollo se hace en ramas de feature y se integra mediante pull requests:

1. Crear rama desde `main`: `git checkout -b feature/nombre-funcionalidad`
2. Hacer cambios y commit: `git commit -m "feat(area): descripción"`
3. Push a GitHub: `git push origin feature/nombre-funcionalidad`
4. Crear Pull Request en GitHub (base: `main`, compare: rama de feature)
5. Revisión y aprobación del PR
6. Merge a `main`
7. Sincronizar local: `git checkout main && git pull origin main`

### Variables de entorno de producción (.env)

```
DATABASE_URL=postgresql://campus_user:${DB_PASSWORD}@database:5432/campus_explorer
SESSION_SECRET=secreto_hex_de_al_menos_48_bytes
ADMIN_USERNAME=admin
ADMIN_PASSWORD=contraseña_minimo_14_bytes
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

1. **Backend**: `npm install --prefix backend` + `npm start --prefix backend`
2. **Frontend**: `npm install --prefix frontend` + `npm run build --prefix frontend` (genera `dist/`)
3. **Servir `dist/`** con nginx, Apache o cualquier servidor de archivos estáticos
4. **Base de datos**: PostgreSQL en servidor separado o mismo host
5. **Proxy**: Configurar `/api` para apuntar al backend en producción

### Docker Compose completo (producción)

```yaml
version: '3.8'

services:
  database:
    image: postgres:15-alpine
    container_name: campus-db
    environment:
      POSTGRES_DB: campus_explorer
      POSTGRES_USER: campus_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - campus-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U campus_user -d campus_explorer"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: campus-backend
    environment:
      DATABASE_URL: postgresql://campus_user:${DB_PASSWORD}@database:5432/campus_explorer
      SESSION_SECRET: ${SESSION_SECRET}
      ADMIN_USERNAME: ${ADMIN_USERNAME}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD}
      PORT: 3001
      NODE_ENV: production
    ports:
      - "3001:3001"
    depends_on:
      database:
        condition: service_healthy
    networks:
      - campus-network
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: campus-frontend
    environment:
      VITE_API_URL: http://localhost:3001/api
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - campus-network
    restart: unless-stopped

networks:
  campus-network:
    driver: bridge

volumes:
  pgdata:
```

---

## Lista de verificación final

### Antes de marcar como "completado"

- [ ] Todas las preguntas de descubrimiento respondidas
- [ ] Esquema de base de datos documentado
- [ ] Endpoints API implementados y probados
- [ ] Autenticación y autorización funcionando
- [ ] Frontend conectado al backend correctamente
- [ ] Diseño responsive (móvil y desktop)
- [ ] Accesibilidad WCAG AA básica
- [ ] Pruebas de backend: 100% pasando
- [ ] Build de frontend exitoso sin errores
- [ ] TypeScript sin errores de tipo (`tsc --noEmit`)
- [ ] Variables de entorno configuradas (no hardcodeadas)
- [ ] `.gitignore` excluye `.env`, `node_modules`, `dist/`, `build/`
- [ ] Pull Request creado y mergeado a `main`
- [ ] README actualizado con funcionalidades reales
- [ ] Este manual actualizado si se agregaron patrones nuevos

---

## Cómo usar este manual como agente de IA

1. **Leer todo el manual antes de escribir código**
2. **Hacer las preguntas de descubrimiento al usuario** y documentar las respuestas
3. **Seguir el flujo TDD** para el backend (prueba primero, código después)
4. **Aplicar las mejores prácticas** de seguridad, accesibilidad y calidad
5. **Actualizar este documento** cuando se agreguen funcionalidades importantes
6. **Nunca asumir** requisitos que no hayan sido confirmados por el usuario

---

*Documento vivo: actualizar este archivo a medida que el proyecto evolucione y se agreguen nuevas funcionalidades.*