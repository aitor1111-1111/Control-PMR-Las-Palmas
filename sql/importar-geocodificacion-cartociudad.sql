-- CONTROL PMR: importación segura del resultado de CartoCiudad
-- 1) Ejecutar este script una vez en Supabase SQL Editor.
-- 2) En Table Editor > geocodificacion_pmr_import > Import data from CSV,
--    importar el CSV COMPLETO devuelto por CartoCiudad, con separador |.
--    Debe conservar las columnas de entrada y OBSERVACIONES_GEOCODIFICACION.
-- 3) Ejecutar el bloque UPDATE y la consulta de comprobación de este script.
-- Solo marca como verificada la coincidencia textual exacta. Los portales
-- aproximados, ambiguos o no encontrados quedan como revisar/sin coordenadas.

CREATE TABLE IF NOT EXISTS public.geocodificacion_pmr_import (
  id text PRIMARY KEY,
  tipo_via text,
  nombre_via text,
  portal1 text,
  portal2 text,
  codpostal text,
  poblacion text,
  cod_ine_municipio text,
  latitud_wgs84_4326 double precision,
  longitud_wgs84_4326 double precision,
  municipio text,
  provincia text,
  observaciones_geocodificacion text
);

ALTER TABLE public.geocodificacion_pmr_import ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.geocodificacion_pmr_import FROM anon, authenticated;

-- Ejecutar después de importar el CSV completo:
UPDATE public.autorizaciones AS a
SET
  latitud = CASE
    WHEN lower(trim(coalesce(g.observaciones_geocodificacion, ''))) = lower('Resultado exacto de la búsqueda')
     AND g.latitud_wgs84_4326 BETWEEN 27 AND 30
     AND g.longitud_wgs84_4326 BETWEEN -19 AND -13
    THEN g.latitud_wgs84_4326 ELSE NULL END,
  longitud = CASE
    WHEN lower(trim(coalesce(g.observaciones_geocodificacion, ''))) = lower('Resultado exacto de la búsqueda')
     AND g.latitud_wgs84_4326 BETWEEN 27 AND 30
     AND g.longitud_wgs84_4326 BETWEEN -19 AND -13
    THEN g.longitud_wgs84_4326 ELSE NULL END,
  geocodificacion_estado = CASE
    WHEN lower(trim(coalesce(g.observaciones_geocodificacion, ''))) = lower('Resultado exacto de la búsqueda')
     AND g.latitud_wgs84_4326 BETWEEN 27 AND 30
     AND g.longitud_wgs84_4326 BETWEEN -19 AND -13
    THEN 'verificada' ELSE 'revisar' END
FROM public.geocodificacion_pmr_import AS g
WHERE a.numero_original::text = g.id;

SELECT geocodificacion_estado, count(*)
FROM public.autorizaciones
GROUP BY geocodificacion_estado
ORDER BY geocodificacion_estado;
