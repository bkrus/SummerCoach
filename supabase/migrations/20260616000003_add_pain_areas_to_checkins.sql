-- Add pain_areas column to checkins table for multi-select injury tracking.
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS pain_areas text[];
