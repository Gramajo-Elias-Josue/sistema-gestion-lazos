# Login — Etapa 2 · Fase A (autenticación)

Pasos manuales en Supabase para activar el inicio de sesión. El código del
front ya está hecho: falta crear al menos un usuario para poder entrar.

> **Fase A = solo autenticación.** Todavía NO hay roles ni permisos por rol:
> cualquier usuario que inicie sesión ve todo. Los roles llegan en la Fase B
> (menú según rol) y la Fase C (RLS en la base).

---

## 1. Crear un usuario de prueba

En el panel de Supabase:

1. **Authentication → Users → Add user** (botón *Create new user*).
2. Cargá un **email** y una **contraseña** (elegilos vos; anotalos).
3. Marcá **Auto Confirm User** (o *Email confirm* = confirmado). Sin esto,
   Supabase pide confirmar el email antes de dejar entrar.
4. Create user.

> No hace falta configurar envío de emails para Fase A: al crear el usuario
> ya confirmado, entra directo con email + contraseña.

## 2. (Opcional) Desactivar el registro público

Como los usuarios los crea la clínica (no se registran solos):

- **Authentication → Providers → Email**: dejá **Enable Email** activado
  (es el que usamos), y si aparece la opción, **desactivá "Enable sign-ups"**
  para que nadie cree cuentas por su cuenta.

## 3. Las políticas RLS ya contemplan al usuario logueado

No hay que tocar nada: las políticas de `supabase-setup.sql` ya permiten el
acceso a `anon` **y** a `authenticated`, así que al iniciar sesión se sigue
leyendo y escribiendo con normalidad. (En la Fase C esas políticas se
reemplazan por unas atadas al rol de cada usuario.)

---

## Probar en el dev server (localhost:5173)

- [ ] Al abrir la app **sin sesión**, aparece la pantalla de **login** (no el panel).
- [ ] Email o contraseña incorrectos → mensaje **"Email o contraseña incorrectos."** (no una pantalla en blanco).
- [ ] Con las credenciales correctas → entra a la app y el encabezado muestra el **email** del usuario.
- [ ] **Recargar (F5)** estando logueado → sigue dentro (la sesión persiste).
- [ ] Botón **"Salir"** → vuelve al login.
- [ ] Tras salir, **recargar** → sigue mostrando el login (no entra solo).
