# 🍗 Almi Pollo — Sistema de Fidelización y Rifa Digital 00-99

Sistema Web Progresivo (PWA) Mobile-First para el asadero y broaster **"Almi Pollo"**. Permite a los clientes acumular presas de pollo con cada compra, canjear boletas automáticamente cada 8 presas y elegir su número de la suerte en un tablero interactivo 00-99 en tiempo real con concurrencia segura mediante transacciones atómicas en Firebase Firestore.

---

## 🎨 Paleta de Marca e Identidad
- **Primario (Branding):** `#a3320e` (Rojo terroso)
- **Secundario (Llamados a la acción):** `#e06d2c` (Naranja vibrante)
- **Fondo claro:** `#fbf8f5` y `#e6d3d2` (Beige / Crema suave)
- **Texto principal:** `#331c19` (Marrón oscuro)
- **Detalles y Acentos:** `#c6501b` (Naranja intenso) y `#c38f7c` (Marrón suave)
- **Imágenes oficiales:** Mascota Chef Almi Pollo (`public/mascota.jpg`) y Logo Oficial (`public/logo.png`).

---

## 🚀 Arquitectura y Stack Tecnológico
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4 + Lucide Icons + Canvas Confetti
- **Backend & Database:** Firebase Firestore (Listeners `onSnapshot` + Transacciones atómicas `runTransaction`)
- **Autenticación:** Firebase Auth (Email/Password para el panel de administración `/admin`)
- **Seguridad:** Sanitización XSS, Regex WhatsApp Colombia `/^3\d{9}$/`, Rate Limiting de PIN (3 intentos / 15 min), Reglas de seguridad `firestore.rules`
- **PWA Ready:** Web Manifest (`manifest.webmanifest`), meta tags mobile-first e iconos adaptables.

---

## 📱 Flujo de Cliente (3 Pasos)

1. **Paso 1 - Identificación / Registro (`/rifa`):**
   - Nombre Completo (sanitizado contra XSS, máx. 50 caracteres).
   - WhatsApp Colombia (`/^3\d{9}$/`, limpia automáticamente prefijos `+57`, espacios y guiones).
   - El WhatsApp es el ID único del cliente. Si ya está registrado, carga su saldo automáticamente.

2. **Paso 2 - Validación de Compra:**
   - Ingreso del **PIN del Día** (4 dígitos numéricos provistos en factura o caja).
   - Rate limiting: 3 intentos fallidos bloquean el ingreso de PIN por 15 minutos.
   - Cantidad de presas compradas con contador interactivo (+ / -) y cálculo en tiempo real:
     $$\text{Presas Totales} = \text{Saldo Anterior} + \text{Compradas}$$
     $$\text{Boletas Ganadas} = \lfloor \text{Presas Totales} / 8 \rfloor$$
     $$\text{Nuevo Saldo Presas} = \text{Presas Totales} \pmod 8$$
   - Alerta festiva con confeti cuando se obtienen nuevas boletas.

3. **Paso 3 - Tablero Digital 00-99:**
   - Matriz 10x10 en tiempo real con 100 casillas (`00` a `99`).
   - Estados: **Naranja** (Disponible), **Marrón oscuro** (Ocupado), **Dorado brillante** (Tus números reservados).
   - **Transacción atómica (`runTransaction`):** Garantiza que no existan condiciones de carrera si dos usuarios tocan el mismo número simultáneamente.

---

## 🛠️ Panel de Administración (`/admin`)

Acceso protegido mediante **Firebase Auth** (`admin@almipollo.com`).

- 🔑 **Generador de PIN Diario:** Crea o renueva el PIN aleatorio de 4 dígitos para la jornada actual (`YYYY-MM-DD`). Desactiva automáticamente el PIN anterior.
- 👥 **Carga Manual de Presas:** Búsqueda por número de WhatsApp para sumar presas a clientes que compran en caja sin smartphone.
- 📊 **Monitoreo Global del Tablero:** Visualización 10x10 en vivo. Clic sobre cualquier casilla ocupada para ver el nombre, WhatsApp (con enlace directo a chat de WhatsApp) y hora de reserva.
- 🏆 **Cierre y Reinicio de Rifa Semanal:**
  - Ingreso del número ganador (00-99).
  - Guarda el historial completo en la colección `rifas_semanales`.
  - Batch update que restablece las 100 boletas a `"disponible"`.
  - **Preserva intactos los saldos de presas de todos los clientes.**

---

## ⚙️ Configuración y Puesta en Marcha

### 1. Clonar e Instalar Dependencias
```bash
cd almipollo-rifa
npm install
```

### 2. Configurar Variables de Entorno de Firebase
Copia `.env.example` a `.env.local` y añade las credenciales de tu proyecto de Firebase:
```env
VITE_FIREBASE_API_KEY=tu_api_key
VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=tu_proyecto_id
VITE_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
VITE_FIREBASE_APP_ID=tu_app_id
```

### 3. Crear el Usuario Administrador en Firebase Console
1. En Firebase Console, ve a **Authentication** > **Sign-in method** y activa **Email/Password**.
2. En la pestaña **Users**, crea el usuario admin (ejemplo: `admin@almipollo.com` con su contraseña segura).

### 4. Desplegar Reglas de Firestore
Despliega el archivo `firestore.rules` incluido en el proyecto:
```bash
firebase deploy --only firestore:rules
```

### 5. Ejecutar en Modo Desarrollo
```bash
npm run dev
```

### 6. Compilar para Producción
```bash
npm run build
```

### 7. Desplegar en Firebase Hosting
```bash
firebase deploy --only hosting
```
