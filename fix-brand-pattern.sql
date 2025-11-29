-- Fix BrandPattern to enable effects
-- Run this in your Supabase SQL editor

-- Update the "ew" pattern to enable effects
UPDATE brand_patterns 
SET 
  enable_effects = true,
  filter_type = 'vibrance'  -- or 'none' if you only want brightness/contrast/saturation
WHERE name = 'ew';

-- Verify the update
SELECT 
  id,
  name,
  enable_effects,
  filter_type,
  brightness,
  contrast,
  saturation,
  logo_url
FROM brand_patterns
WHERE name = 'ew';

-- Optional: Set as default if not already
UPDATE brand_patterns 
SET is_default = true
WHERE name = 'ew' AND is_default = false;
