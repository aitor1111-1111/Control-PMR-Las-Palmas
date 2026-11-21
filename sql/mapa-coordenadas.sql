-- Control PMR: soporte de coordenadas verificadas para el mapa.
-- Ejecutar una sola vez en Supabase > SQL Editor.
ALTER TABLE public.autorizaciones
  ADD COLUMN IF NOT EXISTS latitud double precision,
  ADD COLUMN IF NOT EXISTS longitud double precision,
  ADD COLUMN IF NOT EXISTS geocodificacion_estado text NOT NULL DEFAULT 'pendiente';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'autorizaciones_geocodificacion_estado_check'
      AND conrelid = 'public.autorizaciones'::regclass
  ) THEN
    ALTER TABLE public.autorizaciones
      ADD CONSTRAINT autorizaciones_geocodificacion_estado_check
      CHECK (geocodificacion_estado IN ('pendiente', 'verificada', 'revisar'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'autorizaciones_latitud_check'
      AND conrelid = 'public.autorizaciones'::regclass
  ) THEN
    ALTER TABLE public.autorizaciones
      ADD CONSTRAINT autorizaciones_latitud_check
      CHECK (latitud IS NULL OR latitud BETWEEN -90 AND 90);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'autorizaciones_longitud_check'
      AND conrelid = 'public.autorizaciones'::regclass
  ) THEN
    ALTER TABLE public.autorizaciones
      ADD CONSTRAINT autorizaciones_longitud_check
      CHECK (longitud IS NULL OR longitud BETWEEN -180 AND 180);
  END IF;
END $$;
