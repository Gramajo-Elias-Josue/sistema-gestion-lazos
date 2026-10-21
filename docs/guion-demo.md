# Guion de la demo — Lazos

Duración estimada: **15–20 minutos** de demo + preguntas.
La idea: contar **un día en el centro**, de punta a punta, en vez de recorrer el
menú sección por sección.

---

## 0. Antes de presentar (el día anterior)

- [ ] **Datos de prueba cargados**: correr `supabase/sql/mantenimiento/datos-prueba-cargar.sql`.
      Si ya estaban, primero `datos-prueba-borrar.sql` y después cargar de nuevo
      (así las fechas quedan alrededor del día de la presentación).
- [ ] **Usuarios listos**:
  - Director: el tuyo (`admin@lazos.test`).
  - Un usuario **profesional**: *Administración → Nuevo usuario*, rol Profesional,
    con una contraseña que pongas ahí mismo (no depende de que llegue un mail).
    Anotala.
- [ ] Dos ventanas del navegador: una normal (director) y una **incógnito** (profesional).
- [ ] La app abierta en el **celular** (por el túnel o el sitio publicado).
- [ ] `npm test` corrido una vez antes (para que en vivo arranque rápido).
- [ ] **Plan B** si falla internet: capturas o un video corto de cada paso.

---

## 1. Introducción (1–2 min)

> "Lazos es un centro de rehabilitación en Aguilares. Hoy organizan todo en papel:
> la planilla de turnos, la asistencia, los informes de cada profesional. El sistema
> reemplaza esas planillas y suma lo que el papel no puede: control de quién puede
> ver qué, avisos de vencimientos y los informes en PDF con el membrete del centro."

Mencionar el stack en una línea: *JavaScript sin framework con arquitectura MVC,
Vite y Supabase (base de datos, login, archivos y seguridad por rol).*

---

## 2. Login y panel de inicio (2 min)

1. Entrar como **director**. Mostrar el login y el **modo claro / oscuro**.
2. **Grilla de atención** (lo primero que se ve):
   - Pestañas **Turno mañana (8 a 12)** y **Turno tarde (14 a 18)**.
   - *Lic. Gabriela Soria* aparece en las dos: trabaja doble turno.
   - Cada tarjeta es un profesional, con el color de su profesión.
3. **Asignar un paciente** en una franja libre: tocar "+ asignar", escribir el
   nombre, Enter (baja a la franja siguiente, como en Excel).
4. **Validación en vivo**: poner en la misma hora a un paciente que ya está con otro
   profesional → el sistema avisa que no puede estar en dos lados a la vez.
5. Señalar la **campana**: cumpleaños de la semana (un paciente cumple hoy y una
   profesional en 2 días). En los últimos días del mes también avisa quién debe el
   informe o la foto; el panel **Entregas del mes** lo muestra siempre.

> Qué remarcar: "la grilla es la planilla en papel del centro, pero valida sola".

---

## 3. Llega un paciente nuevo: Admisión (2 min)

1. **Admisión → + Nuevo ingreso**.
2. Mostrar que primero pregunta **¿Tiene CUD?** y recién con "Sí" aparece
   *Diagnóstico según CUD*.
3. Guardar → el paciente queda **en admisión**, no en la lista de pacientes.
4. Abrir la admisión: tildar la documentación presentada (el progreso se actualiza).
5. **Aprobar admisión** → ahora sí aparece en Pacientes.

> Qué remarcar: "nadie entra como paciente sin pasar por el control de documentación".

---

## 4. La jornada: asistencia (1–2 min)

1. **Asistencia → Pacientes**: hoy está sin marcar. Marcar presentes (o "Todos presentes").
2. Pestaña **Profesionales**: fichar la entrada de un profesional (se completa la hora actual).
3. Tocar un nombre → **calendario del mes** y descarga del **PDF** de asistencia.

> Esto habilita el paso siguiente: el informe solo se puede cargar si el paciente
> y su profesional estuvieron presentes.

---

## 5. Historia clínica e informes (3 min)

1. **Pacientes**: buscador, paginado; elegir un paciente que se marcó presente.
2. **Historia clínica**: documentos por categoría (CUD con vencimiento, etc.).
3. **+ Nuevo informe de hoy**:
   - Solo deja elegir a los profesionales que **lo atendieron hoy** (grilla + asistencia).
   - Se escribe sobre una **hoja con el membrete** del centro.
   - Guardar → se **descarga el PDF** y queda **adjunto** en la historia clínica.
4. **+ Evaluación / certificado**: documento ocasional (cuando la familia lo pide).
   No exige que haya venido hoy, pero sí **asistencia confirmada alguna vez** con ese
   profesional.
5. Mostrar un informe viejo con **Ver**: solo lectura (los de días anteriores no se
   pueden modificar).

> Qué remarcar: "un informe no se puede firmar por un paciente que no se atendió".

---

## 6. Un paciente casual: Turnos (2 min)

1. **Turnos → + Nuevo turno**: es para personas **sin legajo** (consulta suelta);
   se escribe nombre, teléfono y DNI.
2. Elegir un profesional y una hora en la que tiene un **paciente fijo** en la grilla
   → **bloquea**: "a las 08:00 atiende a … (Grilla de atención)".
3. Cambiar a una hora libre → se crea.
4. Marcar el turno **Atendido** → aparece **+ Evaluación / certificado** para ese casual.

> Qué remarcar: "la agenda de casuales nunca pisa a los pacientes fijos".

---

## 7. El equipo y los usuarios (2 min)

1. **Profesionales**: tarjetas con el color de su profesión; editar uno → turno
   **mañana / tarde** (casillas) y días de trabajo.
2. **+ Nuevo profesional**: al guardarlo **se le crea el usuario** automáticamente y le
   llega un mail para elegir su contraseña.
3. **Administración**: lista de usuarios, rol de cada uno y **secciones habilitadas**
   (se tildan por usuario).

---

## 8. Seguridad por rol (2 min) — *el momento fuerte*

1. En la ventana **incógnito**, entrar como el **profesional**.
2. El menú es más corto: Inicio, Pacientes, Turnos (solo consulta), Galería.
3. En Turnos no hay "+ Nuevo turno" ni "Eliminar": muestra **Solo consulta**.
4. Explicar: *"No es solo que se oculte el botón. Si este usuario intentara escribir
   en la base desde la consola del navegador, la base lo rechaza: tiene seguridad por
   fila (RLS) según el rol."*

---

## 9. Celular (1 min)

Mostrar en el teléfono: las tablas se vuelven **tarjetas**, la grilla es un **carrusel**
de a un profesional, los formularios se apilan.

---

## 10. El código (2–3 min)

1. Estructura de carpetas: `models/`, `views/`, `controllers/`, `utils/`.
2. Un ejemplo de punta a punta, **turnos del centro**:
   - `src/utils/turnosCentro.js` — la regla de negocio pura (mañana 8–12, tarde 14–18,
     "¿atiende a esta hora?").
   - `tests/turnosCentro.test.js` — sus tests, incluido que con doble turno el
     mediodía queda afuera.
   - Dónde se usa: la grilla, la agenda (bloqueo) y el fichaje.
3. Correr **`npm test`** en vivo: ~300 tests en verde.

---

## 11. Cierre (30 s)

> "El sistema cubre el circuito completo del centro: admisión, atención diaria,
> informes y gestión, con usuarios y permisos que la base hace cumplir. Lo que sigue:
> estadísticas mensuales y tests de los controladores."

---

## Preguntas probables del tribunal

**¿Por qué JavaScript sin framework (React, Angular)?**
El sistema es mediano y la arquitectura MVC hecha a mano deja ver cada capa. No hay
estado global complejo: cada sección se dibuja a partir de datos. Vite aporta módulos,
variables de entorno y carga diferida.

**¿Por qué Supabase y no un backend propio?**
Da PostgreSQL, login, almacenamiento de archivos y seguridad por fila sin mantener un
servidor. La lógica sensible (crear usuarios) va en una Edge Function, del lado servidor.

**La clave de Supabase está en el JavaScript, ¿no es inseguro?**
Es la clave **pública**: está hecha para eso. Lo que protege los datos es la **RLS**:
cada consulta se evalúa contra el rol del usuario logueado. Sin sesión no se ve nada.
La clave secreta solo existe en la Edge Function.

**¿Qué pasa si dos personas asignan el mismo horario a la vez?**
Además de la validación en pantalla, la base tiene un **índice único** sobre
(profesional, hora) para las celdas vigentes: la segunda escritura falla y no hay
duplicados.

**¿Por qué no se borran pacientes ni profesionales?**
Baja lógica: borrarlos destruiría su historia clínica, sus turnos y la autoría de los
informes que firmaron. Se marcan inactivos y se pueden reactivar.

**¿Qué cubren los tests?**
Las partes puras: validaciones, fechas, reglas de turnos y períodos, permisos por rol y
el HTML de cada vista (los controladores no, porque necesitan la base y el navegador).
Varios tests son **regresiones**: bugs reales que se corrigieron y no deben volver.

**¿Cómo se generan los PDF?**
Con jsPDF en el navegador, replicando el membrete en papel del centro. Se carga recién
cuando alguien genera un documento, para no hacer pesada la carga inicial.

**¿Y la privacidad de los datos de salud?**
Son datos sensibles (Ley 25.326): acceso solo con login, permisos por rol en la base,
archivos en un bucket privado con enlaces temporales, y nada se borra sin dejar rastro.

**¿Qué mejorarías?**
Estadísticas mensuales y tests de los controladores con un navegador simulado.

**¿Qué pasa con la grilla si un paciente o un profesional se va?**
Al desactivarlo se liberan solos sus horarios: las celdas no se borran, se cierran con
fecha (queda la historia de con quién se atendía). Al reactivarlo no se le devuelven
automáticamente, porque esos horarios pueden haberse dado a otro.
