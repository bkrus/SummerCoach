-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- athlete
-- Single-row table; one athlete per app instance.
-- ────────────────────────────────────────────────────────────
create table if not exists athlete (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  age                      integer,
  current_pr_seconds       integer,
  goal_pr_seconds          integer,
  season_start_date        date,
  strava_athlete_id        bigint unique,
  strava_access_token      text,
  strava_refresh_token     text,
  strava_token_expires_at  timestamptz,
  created_at               timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- activities  (synced from Strava)
-- ────────────────────────────────────────────────────────────
create type effort_level as enum ('easy', 'moderate', 'hard');

create table if not exists activities (
  id                   uuid primary key default gen_random_uuid(),
  strava_activity_id   bigint not null unique,
  name                 text not null,
  distance_meters      numeric(10, 2),
  moving_time_seconds  integer,
  average_heartrate    numeric(5, 1),
  max_heartrate        numeric(5, 1),
  average_speed        numeric(6, 3),       -- m/s
  start_date           timestamptz not null,
  sport_type           text,
  perceived_exertion   integer check (perceived_exertion between 1 and 10),
  effort_level         effort_level,
  created_at           timestamptz not null default now()
);

create index if not exists activities_start_date_idx on activities (start_date desc);

-- ────────────────────────────────────────────────────────────
-- recovery_metrics  (from Garmin ZIP upload)
-- ────────────────────────────────────────────────────────────
create table if not exists recovery_metrics (
  id                    uuid primary key default gen_random_uuid(),
  date                  date not null unique,
  body_battery_min      integer check (body_battery_min between 0 and 100),
  body_battery_max      integer check (body_battery_max between 0 and 100),
  body_battery_avg      numeric(5, 1) check (body_battery_avg between 0 and 100),
  hrv_status            text,               -- Garmin's own label: 'Balanced', 'Low', etc.
  sleep_duration_hours  numeric(4, 2),
  sleep_score           integer check (sleep_score between 0 and 100),
  resting_heartrate     integer,
  recovery_time_hours   integer,
  created_at            timestamptz not null default now()
);

create index if not exists recovery_metrics_date_idx on recovery_metrics (date desc);

-- ────────────────────────────────────────────────────────────
-- checkins  (daily in-app check-in)
-- ────────────────────────────────────────────────────────────
create table if not exists checkins (
  id           uuid primary key default gen_random_uuid(),
  date         date not null unique,
  leg_fatigue  integer check (leg_fatigue between 1 and 5),
  energy_level integer check (energy_level between 1 and 5),
  sleep_hours  numeric(4, 2),
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists checkins_date_idx on checkins (date desc);

-- ────────────────────────────────────────────────────────────
-- workout_log
-- ────────────────────────────────────────────────────────────
create type readiness_status as enum ('green', 'yellow', 'red');

create table if not exists workout_log (
  id                       uuid primary key default gen_random_uuid(),
  date                     date not null unique,
  planned_run_type         text,            -- e.g. 'tempo', 'long run', 'easy', 'rest'
  planned_distance_miles   numeric(5, 2),
  planned_lift_type        text,            -- e.g. 'lower', 'upper'
  actual_strava_activity_id bigint references activities (strava_activity_id),
  readiness_status         readiness_status,
  coach_message            text,
  athlete_response         text,
  completed                boolean not null default false,
  created_at               timestamptz not null default now()
);

create index if not exists workout_log_date_idx on workout_log (date desc);
