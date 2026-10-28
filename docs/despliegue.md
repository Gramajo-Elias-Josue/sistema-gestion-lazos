# Publicar el sistema y ponerlo en marcha

La app es **estática**: Vite genera archivos (HTML/CSS/JS) que cualquier
hosting sirve. Los datos viven en Supabase, que ya está en la nube. No hace
falta servidor propio ni base aparte.

Esta guía sigue el **orden real** para poner el sistema en marcha en el
centro. Se recomienda un **proyecto de Supabase nuevo** para el centro y dejar
el de desarrollo para pruebas y demostraciones: así los datos reales nunca se
mezclan con los de prueba.

---

## 1. La base de datos

1. Crear el proyecto en Supabase (región São Paulo, la más cercana).
2. **SQL Editor** → correr **en orden** los scripts de `supabase/sql/`, del
   **`00`** al **`15`**. Son re-ejecutables.
   - **No** correr los de `supabase/sql/mantenimiento/`: cargan o borran datos
     de prueba.
3. Verificar que **sin sesión no se ve ningún dato**: la última consulta de
   `04-seguridad-rls.sql` lista las políticas que dejan entrar sin sesión y
   **tiene que dar 0 filas**. Los permisos de cada rol se prueban con
   `docs/seguridad-rls.md`.

> **Esto no es opcional.** La clave pública de Supabase viaja dentro del
> JavaScript de la app — así funciona cualquier frontend, y está bien. Lo que
> protege los datos son las políticas de la base (RLS), no el login. Son
> historias clínicas.

---

## 2. La función que crea usuarios

**Edge Functions** → *Deploy a new function* → nombre exacto
**`crear-usuario`** → pegar `supabase/functions/crear-usuario/index.ts` →
**Deploy**. Después, en su configuración, **desactivar "Verify JWT"** (si no,
el navegador falla por CORS; la función igual verifica ella misma quién la
llama). Detalle en `docs/usuarios-y-roles.md`.

---

## 3. Los correos (bienvenida y recuperar contraseña)

El sistema manda dos mails: el de **bienvenida** al crear un usuario y el de
**recuperar contraseña**. El correo que trae Supabase es solo para pruebas
(manda muy pocos y solo a los miembros del proyecto), así que hace falta uno
propio.

1. **SMTP propio** — Authentication → Emails → **SMTP Settings** → activar
   *Custom SMTP* con una cuenta **del centro** (por ejemplo, un Gmail del centro
   con *contraseña de aplicación*: host `smtp.gmail.com`, puerto `465`).
   Como remitente, el nombre **Lazos**.
2. **Plantillas** — Authentication → Emails → Templates. Pegar el contenido de
   `supabase/plantillas-mail/`:

   | Plantilla de Supabase | Archivo | Asunto |
   |---|---|---|
   | **Invite user** | `bienvenida.html` | Bienvenido/a al Sistema de Gestión Lazos |
   | **Reset password** | `recuperar-contrasena.html` | Recuperar tu contraseña — Lazos |

   El botón de las plantillas **no** usa el link de Supabase (que se gasta
   apenas alguien lo abre, y algunos antivirus lo abren antes que la persona):
   lleva a la app con un código, y la app lo usa recién cuando la persona toca
   su botón (`src/utils/linkMail.js`).
3. **URL de la app** — Authentication → **URL Configuration**:
   - **Site URL**: la URL publicada (ej. `https://lazos-cet.netlify.app`).
   - **Redirect URLs**: agregar esa misma URL.

   **Es obligatorio:** los links de los mails vuelven a esa dirección. Si
   queda `localhost`, el botón del mail lleva a una página que no abre.

---

## 4. El primer director (una sola vez, a mano)

Supabase Auth no trae un "usuario por defecto". El **primero** se crea a mano;
los demás se crean desde la app.

### a) Crear la cuenta
Supabase → **Authentication → Users → Add user → Create new user**:

- **Email**: el real de un socio. No uses `.test`: tienen que llegarle los mails.
- **Contraseña**: larga y propia. **No dejes `1234`** ni la de prueba: esa
  cuenta ve y puede todo.
- Marcá **Auto Confirm User**.

> **No uses "Send invitation" acá.** Esa invitación no lleva la marca que la
> app usa para pedir la contraseña en el primer ingreso, y la persona entraría
> sin contraseña.

### b) Convertirlo en director
SQL Editor (cambiá el nombre y el email):

```sql
insert into public.perfiles (id, nombre, rol, email)
select id, 'Nombre del socio', 'director', email
  from auth.users
 where email = 'socio1@ejemplo.com'
on conflict (id) do update set rol = 'director';
```

### c) Cerrar el registro público
**Authentication → Sign In / Providers → Email**: desactivá **"Allow new users
to sign up"**. Así nadie se crea una cuenta solo; las cuentas las da la
dirección.

---

## 5. Publicar la app

### Camino rápido (5 minutos, para probar)

1. En tu máquina, con el `.env` apuntando al proyecto **del centro**:
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

Con la URL definitiva, volvé al **paso 3** y cargala en Site URL y Redirect URLs.

---

## 6. Los demás usuarios, desde la app

El director entra y, en **Administración → + Nuevo usuario**, crea a:

- **cada uno de los otros socios** con rol **Director (socio)** — una cuenta
  por persona, nunca compartida: así se sabe quién hizo qué y, si un socio se
  va, se le da de baja sin tocar a los demás;
- la **secretaría** y, si hace falta, el usuario de **contenido (CM)**.

Los **profesionales** se dan de alta desde **Profesionales → + Nuevo
profesional**: el usuario se crea solo.

Nadie carga contraseñas: a cada persona le llega el **mail de bienvenida** y
elige la suya. Si el link venció, usa "¿Olvidaste tu contraseña?" con su email.

Por último, en **Admisión → Documentación** y **Pacientes → Categorías** se
revisa que la documentación que se pide y las categorías de la historia
clínica sean las que usa el centro.

---

## 7. Checklist después de publicar

- [ ] Abrir la URL: aparece el **login** (no el panel).
- [ ] Entrar con el director: se ve su rol en el encabezado.
- [ ] Crear un usuario de secretaría desde **Administración**: le llega el mail
      de bienvenida, elige su contraseña y entra.
- [ ] Entrar con ese usuario: el menú aparece recortado.
- [ ] "¿Olvidaste tu contraseña?" manda el mail y el link vuelve a la URL publicada.
- [ ] Cargar un paciente, un turno y tomar asistencia.
- [ ] Subir un documento y abrirlo con "Ver".
- [ ] Generar un informe y revisar el PDF.
- [ ] Cerrar sesión: vuelve al login y no se ve ningún dato.

---

## 8. Antes de usarlo con datos reales de pacientes

Una prueba con datos inventados se puede publicar ya. Para datos reales, hace
falta además:

- **Contraseñas propias** para cada persona (nada compartido).
- **RLS aplicada y probada** (paso 1).
- **Sin usuarios ni datos de prueba**: si se reutiliza el proyecto de
  desarrollo, borrar los datos con `mantenimiento/datos-prueba-borrar.sql` y
  las cuentas de prueba (por ejemplo `admin@lazos.test`) desde Authentication → Users.
- **Dominio propio con HTTPS** — los hostings gratuitos ya dan HTTPS.
- Tener presente la **Ley 25.326** de protección de datos personales: los
  datos de salud son *sensibles* y piden consentimiento informado y resguardo.
  Para la defensa alcanza con nombrarlo; para uso real, conviene revisarlo con
  la dirección del centro.
