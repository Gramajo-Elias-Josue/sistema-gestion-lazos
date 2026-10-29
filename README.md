# Lazos — Sistema de Gestión

Sistema de gestión para **Lazos — Centro de Rehabilitación Integral** (Aguilares,
Tucumán). Aplicación web hecha con **JavaScript vainilla + módulos ES**, empaquetada
con **Vite**, con **Supabase** como backend (PostgreSQL, autenticación, Storage y una
Edge Function).

Reemplaza las planillas en papel del centro: admisión de pacientes, historia clínica,
grilla de atención, turnos, asistencia, informes profesionales en PDF y la gestión
administrativa (convenios, facturación y gastos), con usuarios y permisos por rol.

---

## ✅ Qué hace

| Sección | Para qué sirve |
|---|---|
| **Inicio** | Panel del día: **Grilla de atención** (quién atiende a quién y a qué hora, separada en turno mañana 8–12 y tarde 14–18), disponibilidad del equipo, alertas de CUD por vencer y entregas pendientes del mes. |
| **Admisión** | Ingreso de pacientes nuevos con checklist de documentación. Al aprobar, el paciente pasa a la lista de Pacientes. |
| **Pacientes** | Legajo e **historia clínica**: documentos por categoría, buscador, informes profesionales y evaluación / certificado. |
| **Turnos** | Agenda para pacientes **casuales** (sin legajo). Nunca puede pisar un turno fijo de la grilla. |
| **Asistencia** | Planilla diaria de pacientes y fichaje de profesionales, con calendario mensual y PDF. El profesional también puede **fichar solo desde Inicio con su ubicación** (📍 en la planilla). |
| **Profesionales** | Equipo, profesiones (sectores), días y turnos de trabajo. Al crear un profesional se le crea su usuario. |
| **Galería** | Fotos del trabajo del mes (material de difusión). Cada profesional sube las suyas. |
| **Facturación / Gastos** | Gestión de la sociedad: estado de facturación por paciente y mes, gastos y rendición por socio. Ambas se **exportan a Excel** (.xlsx). |
| **Estadísticas** | Asistencia, atención y grilla, informes y turnos, facturación y gastos: el mes elegido y la tendencia de los últimos 6 meses, con gráficos. |
| **Administración** | Usuarios, roles y secciones habilitadas para cada uno. **Ubicación del centro** y radio para el fichaje por ubicación. |

**Documentos en PDF** (con el membrete de la clínica): informes (mensual, anual,
evolución, admisión), evaluación / certificado ocasional y planilla de asistencia.

---

## 👥 Roles y permisos

| Rol | Ve por defecto | Puede modificar |
|---|---|---|
| **Director** (socio) | Todo | Todo, incluida Administración |
| **Secretaría** | Inicio, Admisión, Pacientes, Turnos, Asistencia, Profesionales, Facturación, Gastos, Estadísticas | Todo lo operativo |
| **Profesional** | Inicio, Pacientes, Turnos (consulta), Galería | Informes, certificados y sus fotos |
| **CM** (contenido) | Inicio, Galería | Nada clínico |

El director puede ajustar las secciones de cada usuario. Los permisos se aplican en **dos
capas**: el front oculta lo que no corresponde (`src/permisos.js`) y la **base lo impide**
con Row Level Security por rol (`supabase/sql/04-seguridad-rls.sql`). Aunque alguien llame
a la API desde la consola del navegador, la base rechaza lo que su rol no permite.

---

## 🧱 Arquitectura: Modelo–Vista–Controlador

Regla de oro: **las vistas y los controladores nunca hablan con Supabase; siempre pasan
por un modelo.**

```
  Usuario
    │  (clic, escribe, navega)
    ▼
┌─────────────┐   pide datos   ┌─────────────┐   consulta   ┌──────────┐
│ CONTROLADOR │ ─────────────► │   MODELO    │ ───────────► │ Supabase │
│  (eventos)  │ ◄───────────── │   (datos)   │ ◄─────────── │ (BD/RLS) │
└─────────────┘   devuelve     └─────────────┘   responde   └──────────┘
    │  entrega datos
    ▼
┌─────────────┐
│    VISTA    │  arma el HTML (funciones puras: datos → string)
└─────────────┘
```

- **Modelos** (`src/models/`): un módulo por entidad. Solo consultas a Supabase; no saben
  nada del HTML.
- **Vistas** (`src/views/`): funciones **puras** que reciben datos y devuelven HTML. No
  acceden a la base ni guardan estado. Por eso se pueden testear sin navegador.
- **Controladores** (`src/controllers/`): conectan eventos, piden datos a los modelos, se
  los pasan a las vistas y manejan los estados de carga y error.
- **Utils** (`src/utils/`): reglas de negocio puras y testeadas (validaciones, fechas,
  turnos del centro, períodos, informes, PDF).

**Por qué JavaScript vainilla y no un framework:** el sistema es chico y la separación
MVC hecha a mano deja ver cada capa sin magia de por medio. Vite agrega lo que hacía
falta: módulos, variables de entorno y carga diferida: el generador de PDF (jsPDF) y el de Excel
(SheetJS), que son pesados, se descargan recién cuando alguien los usa.

---

## 🔐 Seguridad

- **Login** con Supabase Auth (email y contraseña, con recuperación por mail).
- **Row Level Security** por rol en todas las tablas y en el Storage: sin sesión no se ve
  ningún dato.
- **Alta de usuarios** con una **Edge Function** (`supabase/functions/crear-usuario`): crear
  cuentas necesita la *service key*, que vive solo en el servidor. La función verifica que
  quien la llama sea director (o secretaría, solo para profesionales) y **le manda a la persona
  un mail de bienvenida** para que elija su contraseña: nadie más la conoce. Las plantillas de
  los mails están en `supabase/plantillas-mail/`.
- El usuario de **contenido (CM)** solo accede a la galería: la base no le devuelve datos
  clínicos. Cada **profesional** crea y corrige solo sus propios informes, y solo los del día.
- El front usa **solo la clave pública** (*publishable key*); el `.env` no se sube al repo.
- **Baja lógica**: pacientes y profesionales no se borran, se desactivan, para no perder
  la historia clínica ni la autoría de los informes.
- Todo dato que se muestra en pantalla se **escapa** (`esc()`), para evitar inyección de HTML.

---

## 📂 Estructura

```
├── index.html                 # Estructura de la app (menú + secciones)
├── styles/main.css            # Estilos (modo claro y oscuro, responsive)
├── public/                    # Logo y fuentes del membrete de los PDF
├── src/
│   ├── app.js                 # Punto de entrada: sesión, perfil, permisos, router
│   ├── router.js              # Navegación por hash (#pacientes, #agenda…)
│   ├── auth.js · perfil.js · sesion.js · permisos.js   # login, rol y permisos
│   ├── config/                # cliente de Supabase y datos de la clínica
│   ├── models/                # acceso a datos (uno por entidad)
│   ├── views/                 # HTML de cada sección (funciones puras)
│   ├── controllers/           # eventos y orquestación
│   └── utils/                 # reglas de negocio puras (testeadas)
├── tests/                     # tests automáticos (Vitest)
├── supabase/
│   ├── sql/                   # scripts de la base, numerados en orden
│   │   └── mantenimiento/     # datos de prueba, vaciar la base, revertir RLS
│   ├── functions/crear-usuario/   # Edge Function de alta de usuarios (invita por mail)
│   └── plantillas-mail/       # HTML de los mails de bienvenida y de recuperar contraseña
└── docs/                      # despliegue, seguridad, usuarios, guion de la demo
```

---

## 🗃️ Base de datos

Los scripts de `supabase/sql/` arman la base completa. Se corren en el **SQL Editor**, en
orden, y son re-ejecutables:

| Script | Qué hace |
|---|---|
| `00-tablas-base.sql` | Las 6 tablas originales (`pacientes`, `profesionales`, `documentos`, `asistencias`, `contactos_emergencia`, `asignaciones`), que al principio se crearon desde el panel |
| `01-roles-y-perfiles.sql` | Tabla `perfiles` (rol y secciones de cada usuario) + función `rol_actual()` |
| `02-esquema-principal.sql` | Admisión, turnos, fichaje, evaluaciones, grilla, sectores, galería |
| `03-storage-y-acceso.sql` | Bucket privado `documentos` y activa la seguridad por fila |
| `04-seguridad-rls.sql` | **Seguridad por rol**: permisos de cada tabla y del Storage; sin sesión no se accede a nada |
| `05-avatar.sql` | Foto / avatar del perfil (bucket `avatares`) |
| `06-convenios-facturacion-gastos.sql` | Tablas de gestión (solo director y secretaría) |
| `07` a `12` | Cumpleaños, sector del profesional, grilla por horario, turnos del profesional, turnos casuales y certificados |
| `13-cm-sin-datos-clinicos.sql` | El usuario de contenido (CM) no lee datos clínicos (solo la galería) |
| `14-escritura-informes-y-documentos.sql` | El profesional crea y edita solo sus informes del día; el CM no escribe informes ni documentos |
| `15-documentacion-y-categorias.sql` | Documentación de admisión y categorías de la historia clínica, editables desde la app |
| `16-fichaje-por-ubicacion.sql` | El profesional ficha su entrada y salida con su ubicación (la base valida distancia y hora); ubicación del centro configurable |

Tablas principales:

- **pacientes** — legajo; `estado` (activo/inactivo, baja lógica) y `estado_admision`.
- **profesionales** — equipo; `sector`, `dias_trabajo`, `turnos_trabajo` (`{manana}`, `{tarde}` o ambos).
- **asignaciones** — cada celda de la **grilla**: profesional × franja de 30 min → paciente.
  Al cambiar de paciente no se pisa la fila: se cierra (`vigente_hasta`) y se crea otra.
- **turnos** — agenda de **casuales**: nombre, teléfono y DNI anotados en el turno.
- **asistencias** / **asistencias_profesionales** — una por persona y día.
- **evaluaciones** — informes (`mensual`, `anual`, `evolucion`, `admision`) y la
  evaluación / certificado (`certificado`); contenido en JSON.
- **documentos** — metadatos de la historia clínica; los archivos van al Storage.
- **perfiles**, **sectores**, **fotos_trabajo**, **convenios**, **facturacion**, **gastos**.

---

## 🚀 Instalación

Requisitos: **Node.js 18+** y un proyecto de **Supabase**.

```bash
npm install
cp .env.example .env     # completar con la URL y la publishable key del proyecto
npm run dev              # http://localhost:5173
```

Otros comandos:

```bash
npm test          # tests automáticos
npm run build     # versión de producción en dist/
```

Pasos en Supabase: correr los scripts de `supabase/sql/` en orden, desplegar la Edge
Function y crear el primer director. Detalle en [`docs/despliegue.md`](docs/despliegue.md)
y [`docs/usuarios-y-roles.md`](docs/usuarios-y-roles.md).

Para probar con datos: `supabase/sql/mantenimiento/datos-prueba-cargar.sql` carga
profesionales, pacientes, grilla, turnos, asistencia, informes y facturación de ejemplo
(y `datos-prueba-borrar.sql` los saca sin tocar lo demás).

---

## 🧪 Tests

**~300 tests** con Vitest sobre las partes puras del sistema: validaciones, fechas, turnos
del centro, períodos y entregas, permisos por rol, informes, avatares y el HTML que arma
cada vista (incluidas regresiones de bugs ya corregidos).

```bash
npm test
```

---

## 📚 Documentación

- [`docs/base-de-datos.md`](docs/base-de-datos.md) — tablas, relaciones, reglas y decisiones de diseño.
- [`docs/despliegue.md`](docs/despliegue.md) — publicar en un hosting gratuito.
- [`docs/seguridad-rls.md`](docs/seguridad-rls.md) — matriz de permisos y cómo probarlos.
- [`docs/usuarios-y-roles.md`](docs/usuarios-y-roles.md) — Edge Function y pantalla de usuarios.
- [`docs/guion-demo.md`](docs/guion-demo.md) — guion para presentar el sistema.
