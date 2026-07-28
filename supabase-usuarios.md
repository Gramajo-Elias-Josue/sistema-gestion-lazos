# Pantalla "Usuarios" + Edge Function (Etapa 2 · Fase B)

La sección **Administración** (solo la ve el director) permite crear usuarios
y asignarles rol y secciones. El alta de la cuenta usa una **Edge Function**
(`crear-usuario`), porque crear cuentas necesita la *service key*, que vive
del lado servidor.

Pasos para dejarlo andando (todo desde el **dashboard**, sin CLI).

---

## 1. SQL (una vez)
Corré de nuevo `supabase-roles.sql` en el **SQL Editor**. Es idempotente:
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
- [ ] **+ Nuevo usuario**: cargá email + contraseña (≥6) + rol → "Usuario creado".
- [ ] El usuario nuevo aparece en la lista con las secciones por defecto de su rol.
- [ ] Destildá/tildá secciones y **Guardar** → "Permisos actualizados".
- [ ] Cerrá sesión y entrá con el usuario nuevo: el menú aparece recortado
      según lo que le asignaste.
- [ ] Un usuario que NO es director no ve la sección Administración.

## Notas
- El alta **no permite crear otro director** desde la pantalla (a propósito;
  el director se define por SQL). Se pueden crear secretaría y profesional.
- Al **director no se le pueden recortar** secciones (acceso total fijo).
- La seguridad definitiva la agrega la **Fase C** (RLS por rol en todas las
  tablas). Hasta entonces, el gating del front es de comodidad/UX.
