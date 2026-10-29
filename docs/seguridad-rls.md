# Fase C — RLS por rol (seguridad en la base)

Hasta ahora los permisos vivían **solo en el frontend**: se ocultaban
secciones, pero la base aceptaba cualquier pedido de un usuario logueado.
Con la Fase C, **la base misma** rechaza lo que el rol no permite. Aunque
alguien llame a la API desde la consola del navegador, no pasa.

> Este es el argumento fuerte del sistema: *el control de acceso no está en
> la interfaz, está en la base de datos*.

---

## Antes de empezar
- [ ] Ya corriste `supabase/sql/01-roles-y-perfiles.sql` (existe `perfiles` y `rol_actual()`).
- [ ] **Cada usuario tiene su fila en `perfiles`.** Un usuario sin perfil
      queda sin permisos de escritura.
- [ ] Tenés a mano `supabase/sql/mantenimiento/rls-revertir.sql` (deshace todo en 10 segundos).

## Aplicar
1. **SQL Editor** → pegá y ejecutá **`supabase/sql/04-seguridad-rls.sql`**.
   La última consulta del script lista las políticas que dejan entrar sin
   sesión: **tiene que dar 0 filas**.
2. Seguí con los scripts **13 y 14**: ajustan algunas de estas políticas
   (el CM no lee datos clínicos; el profesional escribe solo sus informes
   del día). Si alguna vez volvés a correr el 04, corré después el 13 y el 14.
3. Probá con cada rol (abajo).
4. Si algo se bloquea de más → ejecutá **`supabase/sql/mantenimiento/rls-revertir.sql`** y avisá
   qué acción falló.

---

## Matriz que queda vigente

| | Director | Secretaría | Profesional | Contenido (CM) |
|---|:---:|:---:|:---:|:---:|
| Leer datos clínicos (pacientes, informes, asistencia, documentos, grilla, turnos) | ✅ | ✅ | ✅ | ❌ |
| Leer profesionales, profesiones y fotos de la galería | ✅ | ✅ | ✅ | ✅ |
| Pacientes / admisión / asistencia (escribir) | ✅ | ✅ | ❌ | ❌ |
| Profesionales (alta/baja del equipo) | ✅ | ✅ | ❌ | ❌ |
| Documentación de admisión y categorías de la historia clínica (editar) | ✅ | ✅ | ❌ | ❌ |
| Ver la agenda de turnos | ✅ | ✅ | ✅ (solo consulta) | ❌ |
| Crear / eliminar turnos | ✅ | ✅ | ❌ | ❌ |
| Marcar turno "Atendido" | ✅ | ✅ | ❌ | ❌ |
| Cargar / editar informes | ✅ (de cualquiera) | ✅ (de cualquiera) | solo **los suyos** y **del día** | ❌ |
| Adjuntar documentos | ✅ | ✅ | ✅ | ❌ |
| Editar / borrar documentos | ✅ | ✅ | ❌ | ❌ |
| Archivos del Storage `documentos` | ✅ | ✅ | ✅ | solo `galeria/` |
| Facturación y gastos | ✅ | ✅ | ❌ | ❌ |
| Sin sesión (anon) | — | — | — | ❌ nada |

Las reglas del CM y de los informes las agregan los scripts
**`13-cm-sin-datos-clinicos.sql`** (función `ve_datos_clinicos()`) y
**`14-escritura-informes-y-documentos.sql`** (función `puede_escribir_informe()`,
que usa la fecha de Argentina con `hoy_local()`). El script **`15`** suma las
tablas `requisitos_admision` y `categorias_documento` con la misma regla:
leen los que ven datos clínicos, editan dirección y secretaría.

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
- [ ] Al cargar un informe solo puede elegirse **a sí mismo** como autor; la
      base rechaza un informe a nombre de otro o de otro día.

### 4. Contenido (CM)
- [ ] Entra directo a **Galería** y es la única sección del menú.
- [ ] Con su sesión, pedir `pacientes`, `evaluaciones` o `documentos` a la API
      devuelve **0 filas**, y en el Storage solo ve la carpeta `galeria/`.

### 4. Sin sesión
- [ ] Cerrá sesión: aparece el login y no se ve ningún dato.

---

## Si algo falla
Síntomas típicos de RLS bloqueando de más:
- Listas **vacías** donde debería haber datos.
- Error **`42501`** / *"new row violates row-level security policy"*.
- Un guardado que "no hace nada" y vuelve el botón.

Anotá **qué rol** y **qué acción** falló, revertí con
`supabase/sql/mantenimiento/rls-revertir.sql` y se ajusta la política.
El revertir deja todo libre **solo para usuarios logueados** (sin sesión
sigue sin verse nada). Al terminar, correr de nuevo el 04 y después el 13 y el 14.

> **Ojo con los scripts viejos:** en Postgres las políticas se **suman**
> (alcanza con que una permita). Una sola política abierta que quede
> —por ejemplo creada desde el panel— anula todas las de rol. Por eso el 04
> termina con una "red de seguridad" que borra cualquier política abierta.
