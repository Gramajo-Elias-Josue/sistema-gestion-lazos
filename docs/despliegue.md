# Publicar el sistema (hosting gratuito)

La app es **estática**: Vite genera archivos (HTML/CSS/JS) que cualquier
hosting sirve. Los datos viven en Supabase, que ya está en la nube. No hace
falta servidor propio ni base aparte.

---

## ⚠️ ANTES de publicar: activar la seguridad de la base

**Esto no es opcional.** La clave pública de Supabase viaja dentro del
JavaScript de la app — así funciona cualquier frontend, y está bien. Pero
mientras las políticas de la base sigan abiertas, cualquiera que entre al
sitio puede sacar esa clave del código y **leer o modificar todos los datos
sin iniciar sesión**. El login no lo impide: la puerta la tiene que cerrar
la base.

- [ ] Ejecutar **`supabase/sql/04-seguridad-rls.sql`** en Supabase → SQL Editor.
- [ ] Probar con los tres roles siguiendo **`docs/seguridad-rls.md`**.
- [ ] Confirmar que **sin sesión** no se ve ningún dato.

Son historias clínicas de pacientes: hasta para una prueba conviene tenerlo
cerrado.

---

## 1. El usuario administrador (director)

Supabase Auth no trae un "usuario por defecto": se crea una vez, a mano. Son
dos pasos.

### a) Crear la cuenta
Supabase → **Authentication → Users → Add user**:

- **Email**: uno real de la clínica (ej. `direccion@lazos.com.ar`). No uses
  `.test`: si algún día hace falta recuperar la contraseña, tiene que llegar
  el correo.
- **Contraseña**: larga y propia de la dirección. **No dejes `1234`** ni la
  de prueba: esa cuenta ve y puede todo.
- Marcá **Auto Confirm User**.

### b) Convertirlo en director
SQL Editor (cambiá el email por el que acabás de crear):

```sql
insert into public.perfiles (id, nombre, rol, email)
select id, 'Dirección', 'director', email
  from auth.users
 where email = 'direccion@lazos.com.ar'
on conflict (id) do update set rol = 'director';
```

Listo: ese usuario entra y ve **Administración**, desde donde crea al resto
(otros directores/socios, secretaría, profesionales y CM) sin tocar más SQL.

> **Por qué el PRIMER director se define acá:** alguien tiene que poder
> entrar a Administración para crear a los demás. Desde la app solo un
> director puede crear usuarios, y a un director ya creado no se le puede
> bajar el rol desde la pantalla: eso se hace a mano en la base.

### c) Cerrar el registro público
**Authentication → Providers → Email**: desactivá **"Enable sign-ups"**. Así
nadie puede crearse una cuenta solo; las cuentas las da la dirección.

---

## 2. Publicar la app

### Camino rápido (5 minutos, para probar)

1. En tu máquina, con el `.env` completo:
   ```bash
   npm run build
   ```
   Se genera la carpeta **`dist/`**.

2. Entrá a **[app.netlify.com/drop](https://app.netlify.com/drop)** y
   **arrastrá la carpeta `dist/`**. En segundos te da una URL pública.

> Las credenciales de Supabase quedan dentro del build (es la clave
> **pública**, la que corresponde). La *service key* nunca está en el
> frontend.

**No hace falta configurar rutas**: la app navega con `#` (`#pacientes`,
`#agenda`), así que no necesita reglas de reescritura en el servidor.

### Camino prolijo (se actualiza solo con cada push)

1. Subí el repo a GitHub (ya está versionado).
2. En **Netlify** o **Vercel**: *"Import from Git"* → elegí el repo.
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. Cargá las variables de entorno en el panel del hosting
   (`.env` no se sube al repo, a propósito):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Deploy. Cada `git push` republica solo.

> **Ojo:** las variables se aplican **al compilar**. Si las cargás después
> del primer deploy, hay que volver a deployar para que tomen efecto.

---

## 3. Avisarle a Supabase cuál es la URL nueva

Supabase → **Authentication → URL Configuration**:

- **Site URL**: la URL que te dio el hosting
  (ej. `https://lazos-cet.netlify.app`).
- **Redirect URLs**: agregá esa misma.

Con email + contraseña la sesión funciona igual, pero dejarlo configurado
evita problemas si más adelante se agrega "recuperar contraseña".

La Edge Function `crear-usuario` ya acepta pedidos desde cualquier origen,
así que la pantalla de Administración funciona sin tocar nada.

---

## 4. Checklist después de publicar

- [ ] Abrir la URL: aparece el **login** (no el panel).
- [ ] Entrar con el director: se ve su rol en el encabezado.
- [ ] Crear un usuario de secretaría desde **Administración**.
- [ ] Entrar con ese usuario: el menú aparece recortado.
- [ ] Cargar un paciente, un turno y tomar asistencia.
- [ ] Subir un documento y abrirlo con "Ver".
- [ ] Generar un informe y revisar el PDF.
- [ ] Cerrar sesión: vuelve al login y no se ve ningún dato.

---

## 5. Antes de usarlo con datos reales de pacientes

Una prueba con datos inventados se puede publicar ya. Para datos reales, hace
falta además:

- **Contraseñas propias** para cada persona (nada compartido).
- **RLS aplicada y probada** (punto de arriba).
- **Dominio propio con HTTPS** — los hostings gratuitos ya dan HTTPS.
- Tener presente la **Ley 25.326** de protección de datos personales: los
  datos de salud son *sensibles* y piden consentimiento informado y resguardo.
  Para la defensa alcanza con nombrarlo; para uso real, conviene revisarlo con
  la dirección del centro.
