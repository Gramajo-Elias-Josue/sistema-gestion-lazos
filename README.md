# CET Aguilares — Sistema de Gestión (Etapa 1)

Sistema de gestión para el **Centro Educativo Terapéutico Aguilares** (Tucumán).
Aplicación web construida con **JavaScript vainilla + módulos ES**, empaquetada con
**Vite**, y conectada a **Supabase** como backend (base de datos PostgreSQL + Storage).

Esta es la **Etapa 1**: Pacientes, Documentación, Asistencia y Profesionales.
Todavía **no** hay login: se agregará en una etapa posterior con Supabase Auth + RLS.

---

## 🧱 Arquitectura: Modelo–Vista–Controlador (MVC)

El proyecto separa responsabilidades en tres capas bien delimitadas. La regla de oro:
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
- `profesionalModel.js` — profesionales y conteo de pacientes asignados.
- `documentoModel.js` — documentos (tabla) **y** archivos (Storage).
- `asistenciaModel.js` — asistencias, con upsert por (paciente, fecha).

### Capa VISTA — `src/views/`
Presentación pura. Recibe datos y devuelve HTML (strings). No accede a la base ni
decide lógica de negocio. No guarda estado.
- `inicioView.js`, `pacientesView.js`, `asistenciaView.js`, `profesionalesView.js`.

### Capa CONTROLADOR — `src/controllers/`
El "pegamento". Pide datos a los modelos, se los da a las vistas, conecta los eventos
del DOM (clicks, formularios) y maneja los estados de **carga** y **error**.
- `inicioController.js`, `pacientesController.js`, `asistenciaController.js`, `profesionalesController.js`.

### Apoyo
- `src/config/supabaseClient.js` — crea el cliente único de Supabase (lee el `.env`).
- `src/utils/fechas.js` — formato de fechas, edad y **lógica de vencimiento** (de la demo).
- `src/utils/ui.js` — estados de carga/error, notificaciones (toast), escape de HTML.
- `src/router.js` — navegación entre secciones (por hash de URL).
- `src/app.js` — punto de entrada: registra controladores y arranca el router.
- `styles/main.css` — estilos extraídos de la demo + añadidos de la Etapa 1.

---

## 📂 Estructura de archivos

```
CET Aguilares/
├── index.html                  # Shell de la app (sidebar + main vacío que llena el JS)
├── .env                        # Credenciales de Supabase (NO se sube a git)
├── .env.example                # Plantilla de credenciales
├── .gitignore
├── package.json
├── README.md
├── supabase-setup.sql          # SQL de apoyo (políticas de acceso de la Etapa 1)
├── supabase-migracion.sql      # SQL de apoyo (columnas nuevas: legajo, fecha_emision, numero)
├── styles/
│   └── main.css
└── src/
    ├── config/
    │   └── supabaseClient.js
    ├── models/
    │   ├── pacienteModel.js
    │   ├── profesionalModel.js
    │   ├── documentoModel.js
    │   └── asistenciaModel.js
    ├── views/
    │   ├── inicioView.js
    │   ├── pacientesView.js
    │   ├── asistenciaView.js
    │   └── profesionalesView.js
    ├── controllers/
    │   ├── inicioController.js
    │   ├── pacientesController.js
    │   ├── asistenciaController.js
    │   └── profesionalesController.js
    ├── utils/
    │   ├── fechas.js
    │   └── ui.js
    ├── router.js
    └── app.js
```

---

## 🚀 Instalación y ejecución

Requisitos: **Node.js 18+** (probado con Node 22) y npm.

```bash
# 1) Instalar dependencias
npm install

# 2) Verificar el archivo .env (ya viene cargado con las credenciales del proyecto)
#    Si lo creás de cero, copiá la plantilla:
#    copy .env.example .env   (Windows)
#    cp .env.example .env      (Linux/Mac)

# 3) Levantar el servidor de desarrollo
npm run dev
```

Vite mostrará una URL (normalmente http://localhost:5173). Abrila en el navegador.

Otros comandos:
```bash
npm run build     # genera la versión de producción en /dist
npm run preview   # sirve localmente el build de producción
```

---

## 🔧 Pasos manuales en Supabase

La base y las tablas ya existen. Falta configurar el **Storage** y las **políticas de
acceso** para que el frontend (que usa solo la clave pública, sin login todavía) pueda
leer y escribir.

### 1. Crear el bucket de Storage
En el panel de Supabase → **Storage** → **New bucket**:
- Nombre exacto: **`documentos`**
- Dejalo **privado** (los archivos se ven con URLs firmadas temporales que genera la app).

Sin este bucket, la subida de documentos fallará con un aviso claro en pantalla.

### 2. Políticas de acceso (Etapa 1, sin login)
Como todavía no hay autenticación, hay que permitir el acceso anónimo (rol `anon`) a las
tablas y al bucket. El archivo **`supabase-setup.sql`** trae todo esto listo: abrilo en
el panel → **SQL Editor**, pegalo y ejecutalo.

> ⚠️ **Importante:** estas políticas son **permisivas a propósito** para la demostración
> de la Etapa 1. En la Etapa 2, al sumar login, se reemplazan por políticas RLS reales
> atadas al usuario autenticado.

### 3. Columnas nuevas (migración de esquema)
Ejecutá una vez `supabase-migracion.sql` en el **SQL Editor**. Agrega:
- `pacientes.numero_legajo` (text) — número de legajo interno del centro.
- `documentos.fecha_emision` (date) — fecha de emisión (p. ej. del CUD); ordena la historia.
- `documentos.numero` (text) — número del documento (p. ej. número de CUD).

> Sin estas columnas, el alta de paciente con CUD y el guardado de documentos fallan.

### 4. Claves foráneas (si las consultas embebidas fallan)
Algunas consultas traen datos relacionados embebidos (p. ej. el paciente dentro de un
documento, o el conteo de asignaciones). Para que Supabase las resuelva, deben existir
las claves foráneas: `documentos.paciente_id → pacientes.id`,
`contactos_emergencia.paciente_id → pacientes.id`,
`asignaciones.profesional_id → profesionales.id` y `asignaciones.paciente_id → pacientes.id`.

---

## 🗃️ Tablas (esquema de la base)

- **pacientes** — `id, nombre_completo, dni, fecha_nacimiento, domicilio, telefono, escuela, referente_familiar, diagnostico, obra_social, numero_afiliado, fecha_ingreso, estado`
- **contactos_emergencia** — `id, paciente_id, nombre, vinculo, telefono`
- **profesionales** — `id, nombre_completo, profesion, matricula, especialidad, telefono, email, estado`
- **documentos** — `id, paciente_id, tipo, numero, nombre_archivo, storage_path, fecha_emision, fecha_vencimiento, observaciones`
- **asistencias** — `id, paciente_id, fecha, estado, observaciones, registrado_por` — único por `(paciente_id, fecha)`
- **asignaciones** — `id, profesional_id, paciente_id`

> `numero_legajo` (pacientes), `fecha_emision` y `numero` (documentos) los agrega
> `supabase-migracion.sql` (ver Pasos manuales).

El **estado del CUD** que se ve en el listado de pacientes se deriva del documento de
tipo `'cud'` de cada paciente (no es una columna de la tabla pacientes).

---

## ✅ Funcionalidad de la Etapa 1

1. **Inicio (panel de dirección)** — tarjetas con pacientes activos, profesionales
   activos y asistencias de hoy; panel de alertas con documentos vencidos o que vencen
   en ≤30 días, con el nombre del paciente.
2. **Pacientes** — listado con número de legajo, estado del CUD y acciones por fila
   (historia clínica, editar, baja lógica); alta con número de legajo y CUD (número +
   emisión + vencimiento, sin PDF); edición; legajo con datos personales y contactos.
   La **baja** no borra: marca el paciente como `inactivo`.
3. **Historia clínica** — vista dedicada por paciente, con los documentos organizados en
   categorías (CUD, DNI, Estudios y evaluaciones, Historial médico, Obra social, Escolar,
   Otros) y un **buscador** que filtra por tipo, número, fecha o nota. Cada documento
   guarda tipo, número, fecha de emisión, vencimiento, observaciones y un PDF/imagen
   opcional de respaldo en Storage. Ver/descargar con URL firmada. Incluye un espacio
   reservado para las **evoluciones** (relato por sesión), que se implementan en la Etapa 2.
4. **Asistencia** — selección de fecha, listado de pacientes activos, marcado
   presente / ausente / ausente con aviso / enfermedad (upsert por paciente y fecha),
   porcentaje de asistencia en vivo.
5. **Profesionales** — CRUD completo del equipo (crear, listar, editar, eliminar) con
   especialidad, matrícula, contacto, estado y conteo de pacientes asignados.

---

## 🔮 Próximas etapas

- **Etapa 2 — Autenticación y seguridad:** login con Supabase Auth y políticas RLS por
  rol (dirección, profesional). Reemplaza las políticas permisivas actuales.
- **Evoluciones:** registro de evolución terapéutica por paciente y profesional.
- **Facturación:** generación de planillas para obras sociales.
- **Estadísticas:** reportes mensuales/anuales de asistencia y ocupación.

---

## 🔐 Nota de seguridad

El frontend usa **únicamente la _publishable key_** (clave pública) de Supabase. Es
seguro que quede en el navegador: para eso existe. La **_secret key_ nunca** se usa ni se
guarda del lado del cliente. El archivo `.env` está en `.gitignore` para no versionar las
credenciales.
