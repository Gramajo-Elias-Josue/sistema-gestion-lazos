# Fase C — RLS por rol (seguridad en la base)

Hasta ahora los permisos vivían **solo en el frontend**: se ocultaban
secciones, pero la base aceptaba cualquier pedido de un usuario logueado.
Con la Fase C, **la base misma** rechaza lo que el rol no permite. Aunque
alguien llame a la API desde la consola del navegador, no pasa.

> Este es el argumento fuerte del sistema: *el control de acceso no está en
> la interfaz, está en la base de datos*.

---

## Antes de empezar
- [ ] Ya corriste `supabase-roles.sql` (existe `perfiles` y `rol_actual()`).
- [ ] **Cada usuario tiene su fila en `perfiles`.** Un usuario sin perfil
      queda sin permisos de escritura.
- [ ] Tenés a mano `supabase-rls-revertir.sql` (deshace todo en 10 segundos).

## Aplicar
1. **SQL Editor** → pegá y ejecutá **`supabase-rls.sql`**.
2. Probá con cada rol (abajo).
3. Si algo se bloquea de más → ejecutá **`supabase-rls-revertir.sql`** y avisá
   qué acción falló.

---

## Matriz que queda vigente

| | Director | Secretaría | Profesional |
|---|:---:|:---:|:---:|
| Leer todo | ✅ | ✅ | ✅ |
| Pacientes / admisión / asistencia (escribir) | ✅ | ✅ | ❌ |
| Profesionales (alta/baja del equipo) | ✅ | ✅ | ❌ |
| Ver la agenda de turnos | ✅ | ✅ | ✅ (solo consulta) |
| Crear / eliminar turnos | ✅ | ✅ | ❌ |
| Marcar turno "Atendido" | ✅ | ✅ | ❌ |
| Cargar / editar informes | ✅ | ✅ | ✅ |
| Adjuntar documentos | ✅ | ✅ | ✅ |
| Editar / borrar documentos | ✅ | ✅ | ❌ |
| Sin sesión (anon) | — | — | ❌ nada |

**La agenda es de la secretaría.** El profesional la ve en modo consulta (sin
el selector de estado ni el botón de eliminar). El circuito queda así:

> la secretaría marca el turno como **Atendido** → recién entonces el
> profesional puede cargar el **informe** de ese paciente.

**Por qué el profesional sí puede adjuntar documentos:** al guardar un
informe, el PDF se adjunta como fila en `documentos` + archivo en Storage.

---

## Probar (en este orden)

### 1. Director
- [ ] Entra y recorre **todas** las secciones sin errores.
- [ ] Alta/edición de paciente y de profesional funcionan.
- [ ] Administración lista usuarios y guarda permisos.

### 2. Secretaría
- [ ] Ve todo menos **Administración**.
- [ ] Puede crear pacientes, turnos, marcar asistencia, aprobar admisión.
- [ ] Puede cargar documentos en la historia clínica.

### 3. Profesional
- [ ] Ve **Inicio, Pacientes y Turnos** (nada más).
- [ ] En **Turnos** ve la agenda pero en **modo consulta**: dice "Solo
      consulta", sin "+ Nuevo turno", sin selector de estado ni "Eliminar".
- [ ] Abre la **historia clínica** de un paciente y la consulta.
- [ ] Con un turno que la **secretaría** marcó Atendido, puede cargar el
      **informe** y el PDF **se adjunta** a la historia.
- [ ] **NO** puede dar de alta un paciente ni un profesional (si el front lo
      permitiera, la base lo rechaza).

### 4. Sin sesión
- [ ] Cerrá sesión: aparece el login y no se ve ningún dato.

---

## Si algo falla
Síntomas típicos de RLS bloqueando de más:
- Listas **vacías** donde debería haber datos.
- Error **`42501`** / *"new row violates row-level security policy"*.
- Un guardado que "no hace nada" y vuelve el botón.

Anotá **qué rol** y **qué acción** falló, revertí con
`supabase-rls-revertir.sql` y se ajusta la política.
