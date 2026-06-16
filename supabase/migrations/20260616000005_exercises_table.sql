-- Exercises table for lifting plan
CREATE TABLE exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  equipment text[] DEFAULT '{}',
  day_type text NOT NULL,
  sort_order integer DEFAULT 0,
  sets integer NOT NULL,
  reps text NOT NULL,
  form_cues text[] DEFAULT '{}',
  common_mistakes text[] DEFAULT '{}',
  running_benefit text NOT NULL,
  youtube_url text,
  notes text,
  is_ai_suggested boolean DEFAULT false,
  ai_reasoning text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_exercises" ON exercises
  FOR ALL USING (true) WITH CHECK (true);

-- ─── Lower A ──────────────────────────────────────────────────────────────────

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'Kettlebell Swings',
  ARRAY['kettlebell']::text[],
  'lower_a', 1, 3, '15',
  ARRAY['Hinge at hips, not a squat', 'Drive hips forward explosively', 'Keep core braced throughout', 'Arms guide — legs drive the bell']::text[],
  ARRAY['Squatting instead of hinging', 'Lifting with arms rather than hips', 'Rounding the lower back']::text[],
  'Builds posterior chain power for hill running and sprint finish'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'Bulgarian Split Squats',
  ARRAY['dumbbells', 'bench']::text[],
  'lower_a', 2, 3, '10 each leg',
  ARRAY['Rear foot elevated hip-height', 'Front shin stays vertical at bottom', 'Drive through front heel to stand', 'Keep torso upright']::text[],
  ARRAY['Front knee caving inward', 'Leaning too far forward', 'Too much weight before mastering form']::text[],
  'Single-leg strength and hip stability critical for running economy'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'Barbell Hip Thrusts',
  ARRAY['barbell', 'bench']::text[],
  'lower_a', 3, 3, '12',
  ARRAY['Upper back on bench edge', 'Drive hips to full extension', 'Squeeze glutes hard at top', 'Tuck chin to neutral']::text[],
  ARRAY['Hyperextending lower back at top', 'Not reaching full hip extension', 'Bar rolling during the set']::text[],
  'Direct glute strength transfers to propulsion and hill climbing'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'Single-Leg Romanian Deadlift',
  ARRAY['dumbbells']::text[],
  'lower_a', 4, 3, '8 each leg',
  ARRAY['Hinge at hip, keep back flat', 'Trailing leg lifts as torso lowers', 'Slight knee bend on standing leg', 'Return to start with hip drive']::text[],
  ARRAY['Hips rotating open', 'Looking up and losing neutral spine', 'Rushing the movement']::text[],
  'Hamstring strength and single-leg balance reduce injury risk at speed'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'Kettlebell Farmer Carries',
  ARRAY['kettlebells']::text[],
  'lower_a', 5, 3, '40 yards',
  ARRAY['Stand tall, shoulders packed back', 'Engage core throughout the carry', 'Short controlled steps', 'Keep bells from swinging']::text[],
  ARRAY['Leaning to one side', 'Looking down at feet', 'Letting shoulders hunch forward']::text[],
  'Core stability and grip strength support efficient arm drive during runs'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'Single-Leg Calf Raises',
  ARRAY['step or curb']::text[],
  'lower_a', 6, 3, '15 each leg',
  ARRAY['Full range of motion heel to toe', '3-second slow descent', 'Balance on ball of foot at top', 'Full drop below step level']::text[],
  ARRAY['Partial range of motion only', 'Bouncing at the bottom', 'Going too fast to feel the muscle']::text[],
  'Calf and Achilles tendon strength for push-off power and injury prevention'
);

-- ─── Lower B ──────────────────────────────────────────────────────────────────

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'TRX Single-Leg Squats',
  ARRAY['TRX']::text[],
  'lower_b', 1, 3, '8 each leg',
  ARRAY['Use TRX for balance, not support', 'Sit back as you lower', 'Drive knee out over toes', 'Controlled descent to parallel']::text[],
  ARRAY['Pulling hard on TRX straps', 'Knee caving inward', 'Leaning too far forward']::text[],
  'Functional single-leg strength mimics running mechanics'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'Goblet Squats',
  ARRAY['kettlebell', 'dumbbell']::text[],
  'lower_b', 2, 3, '12',
  ARRAY['Hold weight at chest', 'Elbows inside knees at bottom', 'Chest tall throughout', 'Full depth squat']::text[],
  ARRAY['Heels rising off floor', 'Chest collapsing forward', 'Knees caving inward']::text[],
  'Hip and ankle mobility while building quad and glute strength'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'TRX Hamstring Curls',
  ARRAY['TRX']::text[],
  'lower_b', 3, 3, '10',
  ARRAY['Heels in foot cradles, legs extended', 'Bridge hips off floor first', 'Curl heels toward glutes', 'Maintain hip height throughout']::text[],
  ARRAY['Dropping hips during the curl', 'Pulling with arms on floor', 'Moving too fast']::text[],
  'Eccentric hamstring strength prevents strains at high speeds'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit, notes)
VALUES (
  'Step-Ups with Dumbbells',
  ARRAY['dumbbells', 'box or bench']::text[],
  'lower_b', 4, 3, '10 each leg',
  ARRAY['Step fully onto box', 'Drive through heel of lead foot', 'Don''t push off the trailing leg', 'Control the descent']::text[],
  ARRAY['Pushing off back foot', 'Leaning excessively forward', 'Box height too high to maintain form']::text[],
  'Quad and glute strength for uphills and stride power',
  NULL
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'TRX Hip Press',
  ARRAY['TRX']::text[],
  'lower_b', 5, 3, '12',
  ARRAY['Feet in TRX foot straps, knees bent', 'Drive hips toward ceiling', 'Squeeze glutes hard at top', 'Lower hips with control']::text[],
  ARRAY['Not reaching full hip extension', 'Hips sagging mid-set', 'Feet swinging in straps']::text[],
  'Glute and hamstring activation for powerful ground contact'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'Hip Flexor Stretch Circuit',
  ARRAY[]::text[],
  'lower_b', 6, 2, '60 seconds each side',
  ARRAY['Posterior pelvic tilt to deepen stretch', 'Breathe steadily into the stretch', 'Stay upright, don''t lean forward', 'Let the hip flexor fully relax']::text[],
  ARRAY['Anterior pelvic tilt negating the stretch', 'Holding breath', 'Rushing through positions']::text[],
  'Hip flexor flexibility improves stride length and reduces low back stress'
);

-- ─── Upper ────────────────────────────────────────────────────────────────────

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit, notes)
VALUES (
  'Pull-Ups or Lat Pulldown',
  ARRAY['pull-up bar', 'cable machine']::text[],
  'upper', 1, 3, '8',
  ARRAY['Initiate with shoulder blades retracting', 'Drive elbows down and back', 'Full hang at bottom of each rep', 'Control the descent']::text[],
  ARRAY['Using momentum or kipping', 'Not reaching full hang', 'Shrugging shoulders up']::text[],
  'Upper back strength supports upright posture during fatigue',
  'Use lat pulldown if pull-ups are not yet accessible'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'Dumbbell Bench Press',
  ARRAY['dumbbells', 'bench']::text[],
  'upper', 2, 3, '10',
  ARRAY['Feet flat on floor', 'Shoulders pinched back and down', 'Lower to chest level', 'Press up and slightly inward']::text[],
  ARRAY['Elbows flaring too wide (90 degrees)', 'Bouncing off chest', 'Losing upper back tension']::text[],
  'Chest and shoulder strength balances pulling muscles for upright posture'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'Single-Arm Kettlebell Row',
  ARRAY['kettlebell', 'bench']::text[],
  'upper', 3, 3, '10 each side',
  ARRAY['Flat back, core braced', 'Pull elbow past torso', 'Retract shoulder blade at top', 'No rotation in the torso']::text[],
  ARRAY['Rotating the torso to cheat the rep', 'Using momentum on heavy sets', 'Not fully retracting shoulder blade']::text[],
  'Unilateral pulling strength prevents postural imbalances from one-sided fatigue'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'Face Pulls',
  ARRAY['cable machine', 'resistance band']::text[],
  'upper', 4, 3, '15',
  ARRAY['Pull to face level, not neck or chest', 'Elbows high and above wrists', 'Externally rotate at end range', 'Control the return slowly']::text[],
  ARRAY['Pulling too low toward chest', 'Using momentum', 'Skipping the external rotation']::text[],
  'Rear delt and rotator cuff health keeps shoulders back during long runs'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'Pallof Press',
  ARRAY['cable machine', 'resistance band']::text[],
  'upper', 5, 3, '10 each side',
  ARRAY['Stand perpendicular to anchor point', 'Brace core before pressing out', 'Press straight out and return', 'No rotation in hips or spine']::text[],
  ARRAY['Allowing torso to rotate toward anchor', 'Standing too close to anchor', 'Rushing through reps']::text[],
  'Anti-rotation core stability is essential for efficient running mechanics'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'Dead Bug',
  ARRAY[]::text[],
  'upper', 6, 3, '8 each side',
  ARRAY['Press lower back firmly into floor', 'Lower opposite arm and leg slowly', 'Exhale as you extend', 'Don''t let lower back arch']::text[],
  ARRAY['Lower back lifting off floor', 'Moving too fast', 'Holding breath during extension']::text[],
  'Deep core stability supports spine and pelvis through every stride'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit, notes)
VALUES (
  'Plank Variations',
  ARRAY[]::text[],
  'upper', 7, 3, '30-45 seconds',
  ARRAY['Straight line from head to heels', 'Squeeze glutes and quads', 'Push floor away with forearms', 'Breathe steadily throughout']::text[],
  ARRAY['Hips too high or sagging', 'Holding breath', 'Head dropping toward floor']::text[],
  'Total core endurance maintains running form in the final miles',
  'Vary with side plank, RKC plank, or plank shoulder taps'
);

-- ─── Mobility ─────────────────────────────────────────────────────────────────

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'Foam Rolling — Full Lower Body',
  ARRAY['foam roller']::text[],
  'mobility', 1, 1, '60 seconds per area',
  ARRAY['Roll slowly, pause 3-5 seconds on tender spots', 'Breathe through tight areas', 'Cover quads, IT band, calves, and glutes', 'Apply moderate body-weight pressure']::text[],
  ARRAY['Rolling too fast to feel effect', 'Skipping painful areas', 'Not covering enough muscle groups']::text[],
  'Reduces tissue density and improves range of motion for training readiness'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'Hip 90/90 Stretch',
  ARRAY[]::text[],
  'mobility', 2, 2, '90 seconds each side',
  ARRAY['Both knees at 90-degree angles', 'Sit tall through the stretch', 'Hinge forward over front shin for depth', 'Relax and breathe into position']::text[],
  ARRAY['Collapsing onto the hip', 'Rushing through positions', 'Knees not maintaining 90-90 angles']::text[],
  'Hip internal and external rotation for injury prevention and stride efficiency'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'Glute Activation Circuit',
  ARRAY['resistance band']::text[],
  'mobility', 3, 2, '15 reps each',
  ARRAY['Band above knees throughout', 'Include clamshells and lateral band walks', 'Feel glutes working, not hip flexors', 'Controlled movement on every rep']::text[],
  ARRAY['Compensating with lower back', 'Moving too fast', 'Band too light to feel resistance']::text[],
  'Activates glutes before runs to improve mechanics and reduce knee stress'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'TRX Hip Flexor Stretch',
  ARRAY['TRX']::text[],
  'mobility', 4, 2, '60 seconds each side',
  ARRAY['Rear foot elevated in TRX strap', 'Drive hips gently forward', 'Keep core engaged and posture tall', 'Breathe steadily throughout']::text[],
  ARRAY['Overarching lower back', 'Forcing range of motion too quickly', 'Losing core engagement']::text[],
  'Extended hip flexor flexibility improves stride length and running posture'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'Ankle Mobility Drills',
  ARRAY[]::text[],
  'mobility', 5, 2, '10 each direction',
  ARRAY['Knee over pinky toe for wall ankle drill', 'Full range ankle circles', 'Weight-bearing for best transfer', 'Both clockwise and counterclockwise']::text[],
  ARRAY['Heel lifting off ground during drill', 'Only doing non-weight-bearing work', 'Rushing through repetitions']::text[],
  'Dorsiflexion mobility affects every footstrike and reduces Achilles tendon load'
);

INSERT INTO exercises (name, equipment, day_type, sort_order, sets, reps, form_cues, common_mistakes, running_benefit)
VALUES (
  'Diaphragmatic Breathing',
  ARRAY[]::text[],
  'mobility', 6, 1, '5 minutes',
  ARRAY['Hand on belly — it should rise first', '4-count inhale through nose', '6-count exhale through pursed lips', 'Shoulders stay relaxed throughout']::text[],
  ARRAY['Chest breathing instead of belly breathing', 'Rushing the exhale', 'Tensing shoulders during practice']::text[],
  'Improves breathing efficiency and activates parasympathetic recovery response'
);
