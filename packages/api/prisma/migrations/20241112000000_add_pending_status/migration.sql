-- AlterEnum: Add PENDING to VideoStatus enum
ALTER TYPE "VideoStatus" ADD VALUE IF NOT EXISTS 'PENDING';

-- Note: The new value will be added at the end of the enum.
-- To reorder, you would need to recreate the enum entirely.
