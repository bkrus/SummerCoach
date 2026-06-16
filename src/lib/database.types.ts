export type EffortLevel = 'easy' | 'moderate' | 'hard'
export type ReadinessStatus = 'green' | 'yellow' | 'red'

export interface Database {
  public: {
    Tables: {
      athlete: {
        Row: {
          id: string
          name: string
          age: number | null
          current_pr_seconds: number | null
          goal_pr_seconds: number | null
          season_start_date: string | null
          strava_athlete_id: number | null
          strava_access_token: string | null
          strava_refresh_token: string | null
          strava_token_expires_at: string | null
          strava_profile_url: string | null
          target_weekly_mileage: number
          current_weekly_mileage: number
          team_practice_days: string[]
          years_running: number | null
          injury_history: string | null
          focus_areas: string[] | null
          lifting_days_per_week: number
          exercises_to_avoid: string | null
          gym_equipment: string[] | null
          coach_message_style: string
          coach_motivation_style: string
          morning_reminder_time: string
          other_goals: string | null
          coach_notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          age?: number | null
          current_pr_seconds?: number | null
          goal_pr_seconds?: number | null
          season_start_date?: string | null
          strava_athlete_id?: number | null
          strava_access_token?: string | null
          strava_refresh_token?: string | null
          strava_token_expires_at?: string | null
          strava_profile_url?: string | null
          target_weekly_mileage?: number
          current_weekly_mileage?: number
          team_practice_days?: string[]
          years_running?: number | null
          injury_history?: string | null
          focus_areas?: string[] | null
          lifting_days_per_week?: number
          exercises_to_avoid?: string | null
          gym_equipment?: string[] | null
          coach_message_style?: string
          coach_motivation_style?: string
          morning_reminder_time?: string
          other_goals?: string | null
          coach_notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          age?: number | null
          current_pr_seconds?: number | null
          goal_pr_seconds?: number | null
          season_start_date?: string | null
          strava_athlete_id?: number | null
          strava_access_token?: string | null
          strava_refresh_token?: string | null
          strava_token_expires_at?: string | null
          strava_profile_url?: string | null
          target_weekly_mileage?: number
          current_weekly_mileage?: number
          team_practice_days?: string[]
          years_running?: number | null
          injury_history?: string | null
          focus_areas?: string[] | null
          lifting_days_per_week?: number
          exercises_to_avoid?: string | null
          gym_equipment?: string[] | null
          coach_message_style?: string
          coach_motivation_style?: string
          morning_reminder_time?: string
          other_goals?: string | null
          coach_notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          id: string
          strava_activity_id: number
          name: string
          distance_meters: number | null
          moving_time_seconds: number | null
          average_heartrate: number | null
          max_heartrate: number | null
          average_speed: number | null
          start_date: string
          sport_type: string | null
          perceived_exertion: number | null
          effort_level: EffortLevel | null
          created_at: string
        }
        Insert: {
          id?: string
          strava_activity_id: number
          name: string
          distance_meters?: number | null
          moving_time_seconds?: number | null
          average_heartrate?: number | null
          max_heartrate?: number | null
          average_speed?: number | null
          start_date: string
          sport_type?: string | null
          perceived_exertion?: number | null
          effort_level?: EffortLevel | null
          created_at?: string
        }
        Update: {
          id?: string
          strava_activity_id?: number
          name?: string
          distance_meters?: number | null
          moving_time_seconds?: number | null
          average_heartrate?: number | null
          max_heartrate?: number | null
          average_speed?: number | null
          start_date?: string
          sport_type?: string | null
          perceived_exertion?: number | null
          effort_level?: EffortLevel | null
          created_at?: string
        }
        Relationships: []
      }
      recovery_metrics: {
        Row: {
          id: string
          date: string
          body_battery_min: number | null
          body_battery_max: number | null
          body_battery_avg: number | null
          hrv_status: string | null
          sleep_duration_hours: number | null
          sleep_score: number | null
          resting_heartrate: number | null
          recovery_time_hours: number | null
          created_at: string
        }
        Insert: {
          id?: string
          date: string
          body_battery_min?: number | null
          body_battery_max?: number | null
          body_battery_avg?: number | null
          hrv_status?: string | null
          sleep_duration_hours?: number | null
          sleep_score?: number | null
          resting_heartrate?: number | null
          recovery_time_hours?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          date?: string
          body_battery_min?: number | null
          body_battery_max?: number | null
          body_battery_avg?: number | null
          hrv_status?: string | null
          sleep_duration_hours?: number | null
          sleep_score?: number | null
          resting_heartrate?: number | null
          recovery_time_hours?: number | null
          created_at?: string
        }
        Relationships: []
      }
      checkins: {
        Row: {
          id: string
          date: string
          leg_fatigue: number | null
          energy_level: number | null
          sleep_hours: number | null
          pain_areas: string[] | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          date: string
          leg_fatigue?: number | null
          energy_level?: number | null
          sleep_hours?: number | null
          pain_areas?: string[] | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          date?: string
          leg_fatigue?: number | null
          energy_level?: number | null
          sleep_hours?: number | null
          pain_areas?: string[] | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          id: string
          name: string
          equipment: string[]
          day_type: string
          sort_order: number
          sets: number
          reps: string
          form_cues: string[]
          common_mistakes: string[]
          running_benefit: string
          youtube_url: string | null
          notes: string | null
          is_ai_suggested: boolean
          ai_reasoning: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          equipment?: string[]
          day_type: string
          sort_order?: number
          sets: number
          reps: string
          form_cues?: string[]
          common_mistakes?: string[]
          running_benefit: string
          youtube_url?: string | null
          notes?: string | null
          is_ai_suggested?: boolean
          ai_reasoning?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          equipment?: string[]
          day_type?: string
          sort_order?: number
          sets?: number
          reps?: string
          form_cues?: string[]
          common_mistakes?: string[]
          running_benefit?: string
          youtube_url?: string | null
          notes?: string | null
          is_ai_suggested?: boolean
          ai_reasoning?: string | null
          created_at?: string
        }
        Relationships: []
      }
      workout_log: {
        Row: {
          id: string
          date: string
          planned_run_type: string | null
          planned_distance_miles: number | null
          planned_lift_type: string | null
          actual_strava_activity_id: number | null
          readiness_status: ReadinessStatus | null
          coach_message: string | null
          athlete_response: string | null
          completed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          date: string
          planned_run_type?: string | null
          planned_distance_miles?: number | null
          planned_lift_type?: string | null
          actual_strava_activity_id?: number | null
          readiness_status?: ReadinessStatus | null
          coach_message?: string | null
          athlete_response?: string | null
          completed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          date?: string
          planned_run_type?: string | null
          planned_distance_miles?: number | null
          planned_lift_type?: string | null
          actual_strava_activity_id?: number | null
          readiness_status?: ReadinessStatus | null
          coach_message?: string | null
          athlete_response?: string | null
          completed?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
