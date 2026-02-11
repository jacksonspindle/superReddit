-- Add onboarding tracking to profiles
ALTER TABLE public.profiles ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;

-- Backfill existing users who already have projects
UPDATE public.profiles SET onboarding_completed = true
WHERE id IN (SELECT DISTINCT user_id FROM public.projects);
