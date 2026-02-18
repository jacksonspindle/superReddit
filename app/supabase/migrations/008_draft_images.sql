-- Add images column to generated_posts for storing draft image metadata
alter table public.generated_posts
  add column if not exists images jsonb default '[]'::jsonb;

-- Add link_url column for storing attached links
alter table public.generated_posts
  add column if not exists link_url text;
