# Pantalla "Usuarios" + Edge Function (Etapa 2 · Fase B)

La sección **Administración** (solo la ve el director) permite crear usuarios
y asignarles rol y secciones. El alta de la cuenta usa una **Edge Function**
(`crear-usuario`), porque crear cuentas necesita la *service key*, que vive
del lado servidor.

Pasos para dejarlo andando (todo desde el **dashboard**, sin CLI).

---

## 1. SQL (una vez)
Corré de nuevo `supabase/sql/01-roles-y-perfiles.sql` en el **SQL Editor**. Es idempotente:
agrega las columnas `secciones` y `email` a `perfiles` y backfillea tu email.

## 2. Deploy de la Edge Function (sin CLI)
En el dashboard de Supabase:

1. **Edge Functions** (menú izquierdo) → **Deploy a new function** (o
   "Create a new function" / "Via Editor").
2. Nombre EXACTO: **`crear-usuario`**.
3. Pegá el contenido de `supabase/functions/crear-usuario/index.ts`.
4. **Deploy**.

> No hace falta cargar secretos: `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
> `SUPABASE_SERVICE_ROLE_KEY` ya vienen disponibles en la función.

### 2.b ⚠️ Desactivar "Verify JWT" (si no, falla por CORS)

En la función `crear-usuario` → **Settings** (o "Function configuration") →
destildá **Verify JWT** / *"Enforce JWT verification"* → Guardar.

**Por qué:** con esa opción activa, el gateway de Supabase rechaza el
**preflight `OPTIONS`** del navegador (que viaja sin `Authorization`), y
el pedido muere antes de llegar al código. El síntoma es exactamente:

```
Access to fetch ... has been blocked by CORS policy: Response to preflight
request doesn't pass access control check: It does not have HTTP ok status.
```

**No la deja abierta:** la propia función verifica el JWT de quien llama y
corta con 403 si no es director.

### 2.c Si sigue fallando: mirá los logs
Edge Functions → `crear-usuario` → **Logs**. Si aparece `BOOT_ERROR`, el
código no arrancó (import mal pegado): volvé a pegar el archivo y re-deploy.

## 3. Probar en el dev server (localhost:5173)
Entrá como **director** (admin@lazos.test).

- [ ] Aparece **Administración** en el menú (solo el director la ve).
- [ ] Se lista tu usuario director con "Acceso total" (sin checkboxes).
- [ ] **+ Nuevo usuario**: cargá nombre + email + rol → "Usuario creado" y a esa
      dirección le llega el **mail de bienvenida** (plantilla *Invite user*).
- [ ] Desde el mail, "Crear mi contraseña" abre la app en "¡Bienvenido/a a Lazos!";
      la persona elige su contraseña y entra.
- [ ] El usuario nuevo aparece en la lista con las secciones por defecto de su rol.
- [ ] Destildá/tildá secciones y **Guardar** → "Permisos actualizados".
- [ ] Cerrá sesión y entrá con el usuario nuevo: el menú aparece recortado
      según lo que le asignaste.
- [ ] Un usuario que NO es director no ve la sección Administración.

## Notas
- El **primer** director se crea a mano (ver `docs/despliegue.md`). Desde ahí,
  ese director crea a los demás socios con rol Director, a la secretaría, a los
  profesionales y al CM. A un director ya creado no se le puede bajar el rol
  desde la pantalla (eso se hace en la base).
- Nadie carga contraseñas ajenas: la función invita por mail
  (`inviteUserByEmail`) y la persona elige la suya. Requiere el SMTP propio y las
  plantillas de `supabase/plantillas-mail/` cargadas en Supabase.
- Al **director no se le pueden recortar** secciones (acceso total fijo).
- La seguridad la aplica la base (RLS por rol, ver `docs/seguridad-rls.md`);
  ocultar secciones en el menú es solo comodidad.
