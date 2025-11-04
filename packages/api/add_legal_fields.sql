-- Add legal version fields to users table
-- Execute this in Supabase SQL Editor: https://supabase.com/dashboard/project/xfvjfakdlcfgdolryuck/sql

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS accepted_terms_version VARCHAR(10),
ADD COLUMN IF NOT EXISTS accepted_privacy_version VARCHAR(10);

-- Verify the columns were added
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name IN ('accepted_terms_version', 'accepted_privacy_version');

-- Verificar que se agregaron
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name LIKE '%accepted%'
ORDER BY column_name;
