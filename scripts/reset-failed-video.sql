-- Script para resetear videos en FAILED_EDIT y poder reintentarlos
-- Usar con cuidado - solo para videos específicos que querés reintentar

-- Ver videos en FAILED_EDIT con sus errores
SELECT 
  id,
  status,
  error,
  caption,
  "createdAt",
  "updatedAt"
FROM videos
WHERE status = 'FAILED_EDIT'
ORDER BY "updatedAt" DESC
LIMIT 10;

-- Para resetear UN video específico (reemplazar VIDEO_ID):
-- UPDATE videos 
-- SET 
--   status = 'PENDING',
--   error = NULL,
--   "updatedAt" = NOW()
-- WHERE id = 'VIDEO_ID';

-- Para resetear el video actual:
UPDATE videos 
SET 
  status = 'PENDING',
  error = NULL,
  "updatedAt" = NOW()
WHERE id = 'eudoc5ban58k0ee8uhldsrte';

-- Verificar que se actualizó correctamente:
SELECT 
  id,
  status,
  error,
  caption
FROM videos
WHERE id = 'eudoc5ban58k0ee8uhldsrte';
