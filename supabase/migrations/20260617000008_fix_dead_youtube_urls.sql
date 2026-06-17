-- Remove YouTube URLs that return 404 — these will fall back to YouTube search in the app
UPDATE exercises SET youtube_url = NULL WHERE name = 'Single-Leg Romanian Deadlift';
UPDATE exercises SET youtube_url = NULL WHERE name = 'TRX Single-Leg Squats';
UPDATE exercises SET youtube_url = NULL WHERE name = 'Goblet Squats';
UPDATE exercises SET youtube_url = NULL WHERE name = 'TRX Hamstring Curls';
UPDATE exercises SET youtube_url = NULL WHERE name = 'TRX Hip Press';
UPDATE exercises SET youtube_url = NULL WHERE name = 'Hip Flexor Stretch Circuit';
UPDATE exercises SET youtube_url = NULL WHERE name = 'TRX Hip Flexor Stretch';
UPDATE exercises SET youtube_url = NULL WHERE name = 'Foam Rolling — Full Lower Body';
UPDATE exercises SET youtube_url = NULL WHERE name = 'Hip 90/90 Stretch';
UPDATE exercises SET youtube_url = NULL WHERE name = 'Glute Activation Circuit';
UPDATE exercises SET youtube_url = NULL WHERE name = 'Ankle Mobility Drills';
UPDATE exercises SET youtube_url = NULL WHERE name = 'Diaphragmatic Breathing';
