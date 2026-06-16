-- Row-Level Security for all tables.
-- Single-user personal app using the anon key directly —
-- permissive policies allow all operations without auth.

ALTER TABLE athlete          ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_log      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_athlete"          ON athlete          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_activities"       ON activities       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_recovery_metrics" ON recovery_metrics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_checkins"         ON checkins         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_workout_log"      ON workout_log      FOR ALL USING (true) WITH CHECK (true);
