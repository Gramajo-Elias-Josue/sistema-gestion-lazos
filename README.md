# Lazos — Sistema de Gestión (CET Aguilares)

Sistema de gestión para el **Centro Educativo Terapéutico / Centro de Rehabilitación
Integral "Lazos"** (Aguilares, Tucumán). Aplicación web construida con
**JavaScript vainilla + módulos ES**, empaquetada con **Vite**, y conectada a
**Supabase** como backend (base de datos PostgreSQL + Storage).

Cubre **admisión, pacientes e historia clínica, turnos, asistencia (de pacientes y de
profesionales), profesionales e informes profesionales en PDF**. Todavía **no** hay
login: se agrega en una etapa posterior con Supabase Auth + RLS, momento en el que se
dividirá por roles (secretaría, profesionales, dirección).

---

## 🧱 Arquitectura: Modelo–Vista–Controlador (MVC)

El proyecto separa responsabilidades en tres capas. La regla de oro:
**las vistas y los controladores nunca hablan con Supabase directamente; siempre pasan
por un modelo.**

```
  Usuario
    │  (click, escribe, navega)
    ▼
┌─────────────┐     pide datos     ┌─────────────┐    consulta    ┌──────────┐
│ CONTROLADOR │ ─────────────────► │   MODELO    │ ─────────────► │ Supabase │
│  (eventos)  │ ◄───────────────── │ (datos)     │ ◄───────────── │  (BD)    │
└─────────────┘     devuelve        └─────────────┘    responde    └──────────┘
    │  entrega datos
    ▼
┌─────────────┐
│   VISTA     │  arma el HTML y lo muestra
└─────────────┘
```

### Capa MODELO — `src/models/`
Acceso a datos. Un módulo por entidad. Encapsula todas las consultas a Supabase y
devuelve datos "limpios" (o lanza el error). No sabe nada del HTML.
- `pacienteModel.js` — pacientes + contactos de emergencia + documentos.
- `admisionModel.js` — checklist de documentación de admisión.
- `profesionalModel.js` — profesionales y conteo de pacientes asignados.
- `documentoModel.js` — documentos (tabla) **y** archivos (Storage).
- `turnoModel.js` — turnos (citas paciente ↔ profesional por fecha).
- `asistenciaModel.js` — asistencia de pacientes (upsert por paciente/fecha).
- `asistenciaProfesionalModel.js` — fichaje de profesionales (entrada/salida por día).
- `evaluacionModel.js` — informes/evaluaciones de un paciente por un profesional.

### Capa VISTA — `src/views/`
Presentación pura. Recibe datos y devuelve HTML (strings). No accede a la base ni
decide lógica de negocio. No guarda estado.
- `inicioView.js`, `admisionView.js`, `pacientesView.js`, `turnosView.js`,
  `asistenciaView.js`, `asistenciaProfView.js`, `profesionalesView.js`.

### Capa CONTROLADOR — `src/controllers/`
El "pegamento". Pide datos a los modelos, se los da a las vistas, conecta los eventos
del DOM (clicks, formularios) y maneja los estados de **carga** y **error**.
- `inicioController.js`, `admisionController.js`, `pacientesController.js`,
  `turnosController.js`, `asistenciaController.js`, `asistenciaProfController.js`,
  `profesionalesController.js`.

### Apoyo
- `src/config/supabaseClient.js` — crea el cliente único de Supabase (lee el `.env`).
- `src/config/clinica.js` — datos institucionales del membrete (nombre, dirección,
  CUIT, CEL, resolución, ruta del logo).
- `src/utils/fechas.js` — formato de fechas, edad y lógica de vencimiento.
- `src/utils/ui.js` — estados de carga/error, notificaciones (toast), escape de HTML.
- `src/utils/validacion.js` — validaciones de formularios.
- `src/utils/errores.js` — mensajes de error legibles.
- `src/utils/evaluacion.js` — estructura de los informes (tipos + secciones) y su
  serialización a JSON. Puro, sin DB ni DOM.
- `src/utils/informePdf.js` — generación de los informes en PDF con jsPDF (membrete,
  secciones, firma). Se importa de forma dinámica (code-split) para no pesar al inicio.
- `src/router.js` — navegación entre secciones (por hash de URL).
- `src/sidebar.js` — barra lateral (contraer/expandir) y `src/tema.js` — modo claro/oscuro.
- `src/app.js` — punto de entrada: registra controladores y arranca el router.
- `styles/main.css` — estilos de toda la app (modo claro y oscuro).

> **Nota:** `src/controllers/evolucionesController.js` y `src/views/evolucionesView.js`
> quedaron **sin uso**: la carga de informes se movió a la ficha del paciente (historia
> clínica). Se conservan como referencia; no están en el menú.

---

## 📂 Estructura de archivos

```
sistema-gestion-lazos/
├── index.html                  # Shell de la app (sidebar + main que llena el JS)
├── .env                        # Credenciales de Supabase (NO se sube a git)
├── .env.example                # Plantilla de credenciales
├── .gitignore
├── package.json
├── README.md
├── supabase-migracion.sql      # Migración de esquema (columnas + tablas + constraints)
├── supabase-setup.sql          # Políticas de acceso (RLS permisivo, sin login)
├── supabase-limpiar.sql        # Utilidad para limpiar datos de prueba
├── public/
│   ├── logo-lazos.png          # Logo de la clínica (membrete PDF + sidebar)
│   └── comic*.ttf              # Fuentes Comic Sans MS del membrete
├── styles/
│   └── main.css
└── src/
    ├── config/                 # supabaseClient.js, clinica.js
    ├── models/                 # un módulo por entidad (ver Arquitectura)
    ├── views/                  # HTML de cada sección
    ├── controllers/            # eventos + orquestación
    ├── utils/                  # fechas, ui, validacion, errores, evaluacion, informePdf
    ├── router.js
    ├── sidebar.js
    ├── tema.js
    └── app.js
```

---

## 🚀 Instalación y ejecución

Requisitos: **Node.js 18+** (probado con Node 22), **npm** y una cuenta de **Supabase**.

```bash
# 1) Clonar el repositorio
git clone https://github.com/Gramajo-Elias-Josue/sistema-gestion-lazos.git
cd sistema-gestion-lazos

# 2) Instalar dependencias
npm install

# 3) Crear el archivo .env a partir de la plantilla
#    (el .env NO está en el repo por seguridad: hay que crearlo)
copy .env.example .env      # Windows
# cp .env.example .env       # Linux/Mac
```

Abrí `.env` y completá con los datos de tu proyecto Supabase
(**Project Settings → API**). Se usa **solo la publishable key** (clave pública):

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxxxxxxxxxx
```

```bash
# 4) Preparar Supabase (una sola vez): ver "Pasos manuales en Supabase" más abajo
#    - crear el bucket "documentos"
#    - ejecutar supabase-migracion.sql y supabase-setup.sql en el SQL Editor

# 5) Levantar el servidor de desarrollo
npm run dev
```

Vite mostrará una URL (normalmente **http://localhost:5173**). Abrila en el navegador.

Otros comandos:
```bash
npm run build     # genera la versión de producción en /dist
npm run preview   # sirve localmente el build de producción
```

> **Logo e informes:** el logo (`public/logo-lazos.png`) y las fuentes del membrete de
> los PDF (`public/comic*.ttf`, Comic Sans MS) ya vienen en el repo. Si falta el logo,
> la app y los informes funcionan igual, solo que sin él (en el sidebar se muestra "Lz").

---

## 🔧 Pasos manuales en Supabase

La base y las tablas se crean con los scripts SQL. Además hay que configurar el
**Storage** y las **políticas de acceso** (el frontend usa solo la clave pública, sin
login todavía).

### 1. Crear el bucket de Storage
En el panel de Supabase → **Storage** → **New bucket**:
- Nombre exacto: **`documentos`**
- Dejalo **privado** (los archivos se ven con URLs firmadas temporales que genera la app).

Sin este bucket, la subida de documentos y de los informes PDF falla con un aviso claro.

### 2. Migración de esquema
Ejecutá una vez **`supabase-migracion.sql`** en el **SQL Editor**. Crea/ajusta las
tablas y columnas que usan las secciones (pacientes, turnos, asistencias de
profesionales, evaluaciones, documentos) y **actualiza el CHECK de `documentos.tipo`**
para incluir el tipo `'informe'` (si no, adjuntar el PDF del informe falla con
`documentos_tipo_check`).

### 3. Políticas de acceso (sin login)
Como todavía no hay autenticación, hay que permitir el acceso anónimo (rol `anon`) a las
tablas y al bucket. **`supabase-setup.sql`** trae todo listo: abrilo en el **SQL Editor**,
pegalo y ejecutalo.

> ⚠️ Estas políticas son **permisivas a propósito** para esta etapa sin login. En la
> Etapa 2, con autenticación, se reemplazan por políticas RLS reales atadas al usuario y
> su rol.

---

## 🗃️ Tablas (esquema de la base)

- **pacientes** — `id, nombre_completo, dni, fecha_nacimiento, domicilio, telefono,
  escuela, referente_familiar, diagnostico, tiene_cud, obra_social, numero_afiliado,
  fecha_ingreso, estado, estado_admision`
- **contactos_emergencia** — `id, paciente_id, nombre, vinculo, telefono`
- **admision_documentos** — `id, paciente_id, requisito, presentado, observaciones`
- **profesionales** — `id, nombre_completo, profesion, especialidad, matricula, dni,
  direccion, telefono, telefono2, email, horario_entrada, horario_salida, estado`
- **documentos** — `id, paciente_id, tipo, numero, nombre_archivo, storage_path,
  fecha_emision, fecha_vencimiento, observaciones`
- **turnos** — `id, paciente_id, profesional_id, fecha, hora, estado, observaciones`
  — `estado`: `programado | atendido | ausente | cancelado`
- **asistencias** — `id, paciente_id, fecha, estado, observaciones` — único por `(paciente_id, fecha)`
- **asistencias_profesionales** — `id, profesional_id, fecha, hora_entrada, hora_salida,
  estado, observaciones` — único por `(profesional_id, fecha)`
- **evaluaciones** — `id, paciente_id, profesional_id, fecha, contenido, turno_id`
  — único por `(paciente_id, profesional_id, fecha)`. `contenido` guarda el informe
  serializado en **JSON** (tipo, título y secciones).
- **asignaciones** — `id, profesional_id, paciente_id`

El **estado del CUD** que se ve en el listado de pacientes se deriva del documento de
tipo `'cud'` de cada paciente (no es una columna de la tabla pacientes).

---

## ✅ Funcionalidad

1. **Inicio (panel de dirección)** — tarjetas con pacientes activos, profesionales
   activos, turnos de hoy y asistencias; alertas de documentos vencidos o por vencer.
2. **Admisión** — pacientes en proceso de ingreso con checklist de documentación;
   aprobar la admisión pasa el paciente a "admitido".
3. **Pacientes** — listado con estado del CUD y acciones por fila (historia clínica,
   editar, baja lógica). Alta/edición completa. La **baja** no borra: marca `inactivo`.
4. **Historia clínica** — vista por paciente con los documentos organizados en categorías
   (CUD, DNI, Estudios y evaluaciones, Historial médico, Obra social, Escolar, Otros) y
   un **buscador**. Incluye el apartado **Informes profesionales** (ver abajo).
5. **Turnos** — agenda de citas paciente ↔ profesional por fecha, con estado
   (programado / atendido / ausente / cancelado).
6. **Asistencia** — asistencia diaria de pacientes (presente / ausente / etc.), con
   upsert por paciente y fecha y porcentaje en vivo.
7. **Asistencia de profesionales** — fichaje de entrada/salida por día.
8. **Profesionales** — CRUD del equipo (especialidad, matrícula, contacto, estado) y
   conteo de pacientes asignados.

---

## 📝 Informes profesionales (PDF con plantilla)

El profesional carga los informes **desde la ficha del paciente** (apartado "Informes
profesionales" de la historia clínica), no desde la agenda —esa es de la secretaría—.

- **Condición ("ya atendió"):** solo se puede cargar el informe de un paciente que fue
  **atendido hoy** (existe un turno en estado `atendido` para esa fecha). El autor se
  elige entre los profesionales que lo atendieron ese día. Con login (Etapa 2), el autor
  saldrá del usuario logueado.
- **Plantilla (híbrida):** el informe tiene un **tipo** (Mensual / Evaluación / Evolución
  / Admisión) que sugiere el **título** (editable), y secciones para llenar: *Objetivos /
  motivo* (opcional), *Desarrollo del informe* (obligatorio) e *Indicaciones / conclusión*
  (opcional). Se guarda serializado en JSON en `evaluaciones.contenido` (sin migrar la base).
- **PDF:** al guardar se genera un PDF con el **membrete institucional** (banda diagonal
  con degradé + logo, datos de la clínica), los **datos del paciente** (PACIENTE, FECHA DE
  NACIMIENTO, DNI, DX, OBRA SOCIAL, AFIL), el título centrado, el cuerpo y la zona de
  firma/sello. El PDF se **descarga** y además se **adjunta a la historia clínica** como
  documento de tipo `informe`. Cada informe listado tiene un botón **⤓ PDF** para
  reimprimirlo.
- El membrete y las fuentes se configuran en `src/config/clinica.js` y `src/utils/informePdf.js`.

---

## 🔮 Próximas etapas

- **Etapa 2 — Autenticación y roles:** login con Supabase Auth y políticas RLS por rol
  (secretaría, profesional, dirección). Reemplaza las políticas permisivas actuales y el
  selector de profesional pasa a ser el usuario logueado.
- **Facturación:** planillas para obras sociales.
- **Estadísticas:** reportes mensuales/anuales de asistencia y ocupación.

---

## 🔐 Nota de seguridad

El frontend usa **únicamente la _publishable key_** (clave pública) de Supabase. Es
seguro que quede en el navegador: para eso existe, protegida por las políticas de la base.
La **_secret key_ nunca** se usa ni se guarda del lado del cliente. El archivo `.env` está
en `.gitignore` para no versionar las credenciales.
