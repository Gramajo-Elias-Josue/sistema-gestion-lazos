# Avatares del perfil

Poné acá los archivos de los avatares que puede elegir cada usuario desde
**Mi perfil** (se abre tocando el nombre, arriba a la derecha).

**Se detectan solos:** al agregar o borrar un archivo, la lista del selector
se actualiza sola. No hay que tocar el código.

## Cómo nombrarlos

El **nombre del archivo es la clave que se guarda en la base**, así que:

- todo en **minúsculas**, sin **acentos**, sin **espacios** (usá guiones);
- que sea **corto y descriptivo**.

```
medico.svg        secretaria.svg      director.svg
medica.svg        secretario.svg      directora.svg
enfermera.svg     psicologa.svg       kinesiologo.svg
enfermero.svg     psicologo.svg       terapista.svg
```

Estas claves ya tienen su nombre legible en castellano (se usa para el
`aria-label`, de lectores de pantalla — no aparece como tooltip al pasar el
mouse, a propósito). Si usás otra, se muestra el nombre del archivo con la
primera letra en mayúscula: `terapia-ocupacional.svg` → "Terapia ocupacional".
Para que se lea bien, sumale también su entrada en `ETIQUETAS` (utils/avatar.js).

### Orden en la grilla

Los avatares se ordenan por el NOMBRE del archivo (no por la etiqueta), así
que un prefijo de UNA letra + guion agrupa los que se parecen entre sí en
vez de mezclarlos:

```
a-medico.png     -> ilustración grande y detallada
b-mujer-2.png    -> ícono chico, estilo casero
c-perfil-hombre.png -> círculo de color, tipo placeholder
d-usuario.png    -> silueta lisa, sin color
```

Si agregás uno nuevo, ponele el prefijo del grupo al que se parezca (o uno
nuevo, si es un estilo distinto) para que caiga ordenado junto a los suyos.

## Formatos

`.svg` (lo mejor: nítido en cualquier tamaño y pesa poco), `.png`, `.webp`,
`.jpg`.

Conviene que sean **cuadrados**: se recortan en un círculo, así que lo que
quede fuera del centro se pierde. Si son PNG, 256×256 px alcanza y sobra.

## Licencias (importante para la defensa)

Si los bajaste de Flaticon u otro banco de iconos, revisá qué pide la
licencia. Los gratuitos suelen exigir **atribución**: en ese caso agregá el
crédito en el `README.md` del proyecto, por ejemplo:

> Iconos de avatares por [autor] en [Flaticon](https://www.flaticon.com/).

Si tenés cuenta paga, guardá el comprobante de la licencia.
