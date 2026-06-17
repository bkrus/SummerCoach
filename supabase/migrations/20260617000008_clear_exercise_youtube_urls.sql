-- Clear all hardcoded YouTube URLs from seeded exercises so they use the search fallback
UPDATE exercises SET youtube_url = NULL WHERE is_ai_suggested = false;
