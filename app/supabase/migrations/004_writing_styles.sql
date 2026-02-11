-- Add writing_styles column to projects
ALTER TABLE public.projects ADD COLUMN writing_styles text[] NOT NULL DEFAULT '{}';
