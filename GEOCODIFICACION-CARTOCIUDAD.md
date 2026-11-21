# Geolocalización masiva PMR con CartoCiudad

Se ha preparado un CSV privado con las 677 direcciones y un script SQL para importar los resultados. No subir el CSV de autorizaciones a GitHub.

## 1. Descargar y procesar el CSV

1. Descarga el archivo `PMR_677_direcciones_para_CartoCiudad.csv` que se ha entregado en esta conversación.
2. Abre el conversor oficial: https://www.cartociudad.es/web/portal/herramientas-calculos/conversor
3. Selecciona el CSV y pulsa **Obtener resultados**.
4. Descarga el CSV resultante. El conversor oficial admite hasta 60.000 registros por fichero.
5. Conserva el fichero de salida completo: debe incluir `ID`, las columnas de dirección, `LATITUD_WGS84_4326`, `LONGITUD_WGS84_4326` y `OBSERVACIONES_GEOCODIFICACION`.

## 2. Crear la tabla auxiliar en Supabase

En Supabase > SQL Editor, ejecuta una vez el archivo `sql/importar-geocodificacion-cartociudad.sql`. Esto crea una tabla auxiliar cerrada a los roles de la aplicación.

## 3. Importar el resultado

En Supabase > Table Editor:
1. Abre `geocodificacion_pmr_import`.
2. Usa **Import data from CSV** y selecciona el CSV completo devuelto por CartoCiudad.
3. Si pregunta por el separador, selecciona `|` (barra vertical).
4. Comprueba que los encabezados se asignan a las columnas correspondientes.

## 4. Aplicar las coordenadas a las autorizaciones

Vuelve al SQL Editor y ejecuta el bloque UPDATE y la consulta de comprobación del mismo archivo SQL.

Solo las filas con observación exactamente igual a **Resultado exacto de la búsqueda**, coordenadas válidas y dentro del ámbito geográfico de Gran Canaria se marcan como `verificada`. Resultados como **Portal más próximo**, **No existe resultado** o cualquier coincidencia ambigua se marcan como `revisar` y no reciben coordenadas operativas.

## 5. Abrir el punto exacto en Google Maps

La aplicación ya genera el enlace de Google Maps usando latitud,longitud cuando `geocodificacion_estado = 'verificada'`. Las direcciones sin coincidencia exacta seguirán abriendo la búsqueda textual, sin fingir que tienen un pin exacto.

## Fuente, atribución y límites

CartoCiudad es un servicio oficial del Sistema Cartográfico Nacional / IGN-CNIG. Su conversor procesa CSV de direcciones de forma masiva; el resultado añade `OBSERVACIONES_GEOCODIFICACION` para distinguir resultados exactos, portales próximos y búsquedas fallidas. Reconocer la fuente: **© CartoCiudad / IGN-CNIG, CC BY 4.0**.

La geocodificación es informativa y no tiene validez jurídica. Antes de utilizar los puntos como referencia operativa, deben validarse los casos dudosos y confirmarse la idoneidad del dato con el responsable municipal.
