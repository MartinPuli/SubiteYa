# 🎨 Frontend SubiteYa - Documentación Completa

## ✅ Frontend Implementado

### 📦 Estructura Creada

```
packages/web/src/
├── components/
│   ├── Button/          ✅ Botón reutilizable (variants, sizes, loading)
│   ├── Card/            ✅ Card contenedor
│   └── Input/           ✅ Input con label y error
├── pages/
│   ├── LoginPage        ✅ Login y Registro
│   ├── DashboardPage    ✅ Dashboard con métricas
│   ├── ConnectionsPage  ✅ Gestión de cuentas TikTok
│   ├── UploadPage       ✅ Upload de videos + multi-selección
│   └── HistoryPage      ✅ Historial de publicaciones
├── store/
│   ├── authStore.ts     ✅ Estado de autenticación
│   └── appStore.ts      ✅ Estado de la aplicación
├── design/
│   ├── tokens.ts        ✅ Sistema de diseño
│   └── global.css       ✅ Estilos globales
├── App.tsx              ✅ Routing completo
└── main.tsx             ✅ Entry point

```

## 🎯 Funcionalidades Implementadas

### 1️⃣ Sistema de Autenticación

**LoginPage** (`/login`)

- ✅ Formulario de login
- ✅ Formulario de registro
- ✅ Toggle entre login/registro
- ✅ Validación de campos
- ✅ Manejo de errores
- ✅ Loading states
- ✅ Diseño minimalista blanco y negro

**Store: authStore**

- Login/Registro (preparado para API)
- Logout
- Persistencia local (LocalStorage)
- Estado de autenticación

### 2️⃣ Dashboard

**DashboardPage** (`/dashboard`)

- ✅ Bienvenida personalizada
- ✅ 4 tarjetas de métricas:
  - Cuentas conectadas
  - Publicaciones pendientes
  - Publicaciones completadas
  - Publicaciones fallidas
- ✅ 3 acciones rápidas:
  - Gestionar cuentas
  - Subir video
  - Ver historial
- ✅ Navegación protegida (redirect a login)
- ✅ Diseño responsive

### 3️⃣ Gestión de Cuentas TikTok

**ConnectionsPage** (`/connections`)

- ✅ Lista de cuentas conectadas
- ✅ Avatar o inicial
- ✅ Badge "Por defecto"
- ✅ Botón "Conectar cuenta" (OAuth TikTok)
- ✅ Establecer cuenta por defecto
- ✅ Desconectar cuenta
- ✅ Empty state cuando no hay cuentas
- ✅ Diseño de cards con hover effects

### 4️⃣ Upload de Videos

**UploadPage** (`/upload`)

- ✅ Dropzone para subir video
- ✅ Preview del archivo seleccionado
- ✅ Textarea para descripción (caption)
- ✅ Contador de caracteres (max 2200)
- ✅ **Multi-selector de cuentas**:
  - Checkboxes visuales
  - Contador de cuentas seleccionadas
  - Grid responsive
- ✅ Campo opcional de fecha/hora programada
- ✅ Validación:
  - Archivo requerido
  - Al menos 1 cuenta seleccionada
- ✅ Botón con contador de cuentas
- ✅ Loading state durante upload

### 5️⃣ Historial

**HistoryPage** (`/history`)

- ✅ Lista de todas las publicaciones
- ✅ Información por job:
  - Caption
  - Cuenta TikTok
  - Estado (Pendiente/Completado/Fallido)
  - Fecha formateada
- ✅ Estados con colores:
  - Verde: Completado
  - Rojo: Fallido
  - Naranja: Pendiente
- ✅ Empty state
- ✅ Botón para nueva publicación

## 🎨 Sistema de Diseño

### Colores (Monochrome)

```typescript
const colors = {
  black: '#000000',
  white: '#FFFFFF',
  gray: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
  // Colores funcionales
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
};
```

### Componentes Reutilizables

**Button**

- Variants: `primary`, `secondary`, `ghost`, `danger`
- Sizes: `sm`, `md`, `lg`
- Props: `loading`, `fullWidth`, `disabled`
- Spinner animado en loading

**Input**

- Label opcional
- Mensaje de error
- Estados: focus, error, disabled
- FullWidth support

**Card**

- Bordes redondeados
- Hover effect (si es clickable)
- Padding consistente
- Shadow al hover

## 🔌 Integración con API (Preparado)

### authStore Methods

```typescript
// Login
await login(email, password);

// Register
await register(name, email, password);

// Logout
logout();
```

### appStore Methods

```typescript
// Guardar conexiones
setConnections(connections);

// Guardar jobs
setJobs(jobs);

// Loading
setLoading(true / false);

// Errores
setError('mensaje');
```

## 📱 Responsive Design

- **Desktop**: Grid layouts, side-by-side
- **Tablet**: Grid adaptativo
- **Mobile**:
  - Layouts verticales
  - Botones full-width
  - Stacks de contenido

## 🛣️ Rutas Implementadas

| Ruta           | Componente              | Protegida |
| -------------- | ----------------------- | --------- |
| `/`            | Redirect a `/dashboard` | No        |
| `/login`       | LoginPage               | No        |
| `/dashboard`   | DashboardPage           | ✅ Sí     |
| `/connections` | ConnectionsPage         | ✅ Sí     |
| `/upload`      | UploadPage              | ✅ Sí     |
| `/history`     | HistoryPage             | ✅ Sí     |

## 🚀 Cómo Usar

### Ver el Frontend

```powershell
# Iniciar servidores
npm run dev

# Abrir navegador
http://localhost:5173
```

### Flujo de Usuario

1. **Inicio** → `/login`
2. **Login/Registro** → Usuario ingresa credenciales
3. **Dashboard** → `/dashboard` - Ver métricas
4. **Conectar TikTok** → `/connections` - OAuth TikTok
5. **Subir Video** → `/upload`:
   - Seleccionar archivo
   - Escribir descripción
   - Elegir cuentas (✅ multi-select)
   - Programar (opcional)
   - Publicar
6. **Ver Historial** → `/history` - Trackear estado

## 🎯 Características Destacadas

### ✨ Multi-Account Publishing

```tsx
// En UploadPage.tsx
const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

// Toggle account selection
const toggleAccount = (id: string) => {
  setSelectedAccounts((prev) =>
    prev.includes(id)
      ? prev.filter((a) => a !== id)
      : [...prev, id]
  );
};

// Visual feedback
<div className={`account-item ${
  selectedAccounts.includes(conn.id)
    ? 'account-item--selected'
    : ''
}`}>
```

### 🔐 Protected Routes

Todas las páginas verifican autenticación:

```tsx
useEffect(() => {
  if (!isAuthenticated) {
    navigate('/login');
  }
}, [isAuthenticated, navigate]);
```

### 📊 Real-time Stats

Dashboard calcula métricas en tiempo real:

```tsx
const stats = {
  connections: connections.length,
  pending: jobs.filter(j => j.state === 'PENDING').length,
  completed: jobs.filter(j => j.state === 'COMPLETED').length,
  failed: jobs.filter(j => j.state === 'FAILED').length,
};
```

## 🔜 Próximos Pasos

### Backend Integration

1. Crear servicios API en `src/services/api.ts`
2. Implementar endpoints:
   - `POST /auth/register`
   - `POST /auth/login`
   - `GET /connections`
   - `POST /connections` (OAuth callback)
   - `POST /publish`
   - `GET /jobs`
3. Conectar stores con API
4. Manejo de tokens (JWT)
5. Interceptors de Axios

### Features Adicionales

- [ ] Editar publicaciones programadas
- [ ] Cancelar publicaciones pendientes
- [ ] Preview de video antes de publicar
- [ ] Filtros en historial
- [ ] Paginación en historial
- [ ] Notificaciones en tiempo real
- [ ] Dark mode (opcional)
- [ ] Búsqueda de publicaciones

## 📝 Notas Técnicas

### TypeScript

Todos los componentes usan TypeScript estricto:

- Interfaces para props
- Tipos para state
- Type safety en stores

### Performance

- Componentes funcionales con hooks
- Lazy loading preparado (React.lazy)
- Optimistic UI updates
- Loading states en todas las acciones

### Accessibility

- Labels semánticos
- Focus states visibles
- Keyboard navigation
- ARIA attributes (preparado)

---

**Estado**: ✅ Frontend completamente funcional y listo para integrar con backend

**Diseño**: 🎨 Minimalista, blanco y negro, moderno

**Responsive**: 📱 Mobile, tablet, desktop

**Multi-account**: ✅ Implementado con selección múltiple

**Real-time**: ⚡ Estados y métricas en tiempo real
