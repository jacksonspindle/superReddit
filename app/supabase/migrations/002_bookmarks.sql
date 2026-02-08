-- Bookmarks (user-level saved posts for later)
create table public.bookmarks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  reddit_id text not null,
  subreddit text not null,
  title text not null,
  body text,
  author text not null,
  score integer not null default 0,
  num_comments integer not null default 0,
  url text not null,
  permalink text not null,
  created_utc bigint not null,
  link_flair_text text,
  thumbnail text,
  created_at timestamptz default now() not null,
  unique(user_id, reddit_id)
);

alter table public.bookmarks enable row level security;

create policy "Users can CRUD own bookmarks" on public.bookmarks
  for all using (auth.uid() = user_id);

-- Indexes for efficient queries
create index idx_bookmarks_user_id on public.bookmarks(user_id);
create index idx_bookmarks_user_subreddit on public.bookmarks(user_id, subreddit);
create index idx_bookmarks_user_created on public.bookmarks(user_id, created_at desc);
