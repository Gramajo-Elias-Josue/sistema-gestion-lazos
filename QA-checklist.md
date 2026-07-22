# Checklist de QA manual — Lazos (antes del login)

Guía para probar la app a mano contra Supabase/navegador y cazar bugs que los
tests automáticos no cubren (Storage, RLS, render del PDF, UI, zona horaria).

**Cómo usarlo:** `npm run dev`, abrí http://localhost:5173 y recorré cada bloque.
Marcá `[x]` lo que pasa, anotá al lado lo que falle (qué hiciste → qué esperabas
→ qué pasó). Probá en **modo claro y oscuro** y con la barra lateral **contraída**.

> Los tests automáticos (lógica pura) corren con `npm test`. Este checklist es
> para lo que necesita la base real y el navegador.

---

## 0. Preparación (una vez)
- [ ] `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` correctos.
- [ ] En Supabase: bucket **`documentos`** creado (privado).
- [ ] Ejecutados `supabase-migracion.sql` y `supabase-setup.sql` en el SQL Editor.
- [ ] `public/logo-lazos.png` presente.

## 1. Arranque y navegación
- [ ] La app carga sin errores en la consola del navegador (F12 → Console).
- [ ] Se ve el logo en el sidebar (no la caja "Lz").
- [ ] Navegar por todas las secciones (Inicio, Admisión, Pacientes, Turnos, Asistencia, Profesionales) funciona.
- [ ] Recargar (F5) en una sección mantiene esa sección (hash en la URL).
- [ ] Contraer la barra lateral: NO aparece el logo, solo el botón de menú.
- [ ] Cambiar a modo oscuro y recorrer todo: nada ilegible (texto claro sobre claro, etc.).

## 2. Inicio (panel de dirección)
- [ ] Los 4 KPIs muestran números coherentes (pacientes/profesionales activos, turnos y asistencias de hoy).
- [ ] Tocar una tarjeta KPI navega a su sección.
- [ ] La grilla del día muestra los turnos de hoy.
- [ ] Disponibilidad: profesionales presentes según el fichaje del día.
- [ ] Panel de alertas: documentos vencidos / por vencer con el nombre del paciente.
- [ ] **Zona horaria:** un documento que vence **hoy** aparece como "Por vencer" (no "Vencido"); uno que venció ayer, "Vencido".

## 3. Admisión
- [ ] Lista pacientes en proceso de admisión.
- [ ] Aprobar una admisión pasa el paciente a la sección Pacientes.
- [ ] El checklist de documentación se guarda y persiste al recargar.

## 4. Pacientes
- [ ] Alta de paciente: se guarda y aparece en el listado.
- [ ] DNI duplicado: la app lo rechaza con aviso.
- [ ] DNI con letras o muy corto/largo: rechazado.
- [ ] Fecha de nacimiento futura: rechazada.
- [ ] Editar un paciente: cambios persisten.
- [ ] Baja (lógica): el paciente pasa a inactivo, NO se borra; su historia sigue.
- [ ] Estado del CUD en el listado coincide con el documento CUD del paciente.

## 5. Historia clínica
- [ ] Abrir la historia de un paciente muestra sus documentos por categoría.
- [ ] Buscador filtra por tipo/número/fecha/nota.
- [ ] **Fecha de nacimiento** en el legajo se ve correcta (no corrida un día).
- [ ] Agregar documento **sin archivo**: se guarda (solo datos).
- [ ] Agregar documento **con PDF/imagen**: sube al bucket y el botón "Ver" lo abre (URL firmada).
- [ ] Un documento con vencimiento próximo muestra el pill "Por vencer"; vencido, "Vencido".

## 6. Turnos
- [ ] Crear turno: aparece en la fecha elegida.
- [ ] Navegar entre días (‹ › / Hoy / selector) actualiza la lista.
- [ ] **Superposición paciente:** mismo paciente con <30 min entre turnos (aunque sea con OTRO profesional) → rechazado.
- [ ] **Superposición profesional:** mismo profesional con <30 min entre turnos → rechazado.
- [ ] Turnos separados por 30 min justos → se permiten (el límite es "menos de 30").
- [ ] **Sin internet al crear un turno:** avisa "No se pudo verificar la disponibilidad" y NO lo crea (no lo deja pasar a ciegas).
- [ ] Día no laboral / fuera de horario del profesional → pide confirmación (no bloquea).
- [ ] Cambiar estado a **Atendido** SIN que el profesional y el paciente estén presentes ese día → lo impide y revierte el select.
- [ ] Marcar presentes a ambos (Asistencia + fichaje) y luego Atendido → funciona.
- [ ] Eliminar turno: pide confirmación y se borra.

## 7. Asistencia (pacientes)
- [ ] Marcar presente/ausente/etc. persiste (recargar la fecha).
- [ ] "Marcar todos presentes" funciona.
- [ ] El porcentaje de asistencia se actualiza en vivo.
- [ ] Cambiar de fecha trae la asistencia de ese día.

## 8. Asistencia de profesionales (fichaje)
- [ ] Marcar "Presente" sin horas: se guarda.
- [ ] Registrar salida sin entrada: rechazado.
- [ ] Salida anterior a la entrada: rechazado.
- [ ] Hora de entrada futura (hoy): rechazada (con ~10 min de tolerancia).

## 9. Profesionales
- [ ] Alta / edición funcionan.
- [ ] Email con formato inválido: rechazado.
- [ ] Conteo de pacientes asignados coherente.
- [ ] **Baja (lógica):** "Dar de baja" pide confirmación y lo pasa a inactivo; NO se borra.
- [ ] Un profesional inactivo muestra "Reactivar" y vuelve a activo al tocarlo.
- [ ] Dar de baja a un profesional **con turnos/informes**: no rompe nada; sus informes siguen en la historia clínica del paciente.
- [ ] Ya NO existe ningún botón "Eliminar" (nada se borra de verdad).

### 9.b Campo "Estado" fuera de los formularios (cambio 2026-07-16)
- [ ] Alta de **paciente**: el formulario NO pide "Estado".
- [ ] Alta de **profesional**: el formulario NO pide "Estado".
- [ ] Edición de paciente/profesional: tampoco pide "Estado".
- [ ] **Un paciente recién creado aparece en el listado** (si no aparece, la columna `estado` quedó en NULL).
- [ ] **Un profesional recién creado aparece** en su listado y en el selector de turnos.
- [ ] **Editar un paciente INACTIVO no lo reactiva solo** (sigue inactivo tras guardar).
- [ ] **Editar un profesional INACTIVO no lo reactiva solo.**

## 10. Informes profesionales (lo nuevo — probar a fondo)
Preparar: un paciente con turno **Atendido hoy** (presente en asistencia + fichaje).

**Carga**
- [ ] En la historia clínica del paciente, "+ Nuevo informe de hoy" abre la HOJA.
- [ ] Si el paciente **no** fue atendido hoy: avisa y NO abre.
- [ ] El selector de profesional muestra solo quién lo atendió hoy.
- [ ] Datos del paciente autocompletados y correctos (incluida la fecha de nacimiento).
- [ ] Cambiar el "Tipo" sugiere el título (Mensual / Diario / Evolución / Admisión).
- [ ] El título se ve centrado y en Comic Sans; "LAZOS…" también.
- [ ] Guardar sin cuerpo: lo impide.
- [ ] Guardar con cuerpo: toast de éxito.

**PDF y adjunto**
- [ ] Se descarga el PDF; se abre bien en el visor.
- [ ] El PDF replica el membrete (banda diagonal + logo + datos + título centrado + firma).
- [ ] El informe aparece adjunto en la historia clínica (categoría "Historial médico", tipo informe) con "Ver".
- [ ] Sin bucket/RLS: el informe igual se guarda y descarga; solo avisa que no pudo adjuntar.

**Ver / editar (regla de edición)**
- [ ] Botón "⤓ PDF" del apartado: descarga directa sin abrir la previsualización.
- [ ] Botón "Ver": abre la previsualización (solo lectura, misma hoja).
- [ ] En la previsualización de un informe de **HOY**: aparece "Editar (informe de hoy)".
- [ ] Editar el de hoy, guardar: se actualiza (no crea uno nuevo) y el PDF nuevo refleja el cambio.
- [ ] En un informe de un **día anterior**: NO aparece "Editar", solo Cerrar y Descargar PDF.
- [ ] El mismo profesional no genera dos informes del mismo paciente el mismo día (se sobrescribe).

## 11. Errores y estados
- [ ] Cortar internet y navegar: se ven mensajes de error claros (no pantallas en blanco).
- [ ] Los estados "Cargando…" aparecen mientras se piden datos.
- [ ] Ninguna acción deja botones colgados en "Guardando…" tras un error.

## 12. Responsive / general
- [ ] Ventana angosta (~700px): nada se sale ni se rompe.
- [ ] Los modales se cierran con la X, con "Cancelar" y clickeando afuera.

---

### Notas de bugs encontrados
(anotá acá: sección → pasos → esperado → real)
-
-
