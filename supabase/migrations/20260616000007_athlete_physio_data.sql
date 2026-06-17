-- Athlete physiological data and extended PR fields
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS height_inches integer;
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS weight_lbs integer;
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS resting_hr integer;
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS max_hr integer;
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS vo2_max numeric(4,1);
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS pr_400m_seconds integer;
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS pr_800m_seconds integer;
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS pr_1600m_seconds integer;
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS pr_3200m_seconds integer;
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS pr_5k_seconds integer;
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS pr_10k_seconds integer;
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS longest_run_miles numeric(4,1);
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS highest_weekly_mileage integer;
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS years_weight_training integer;
