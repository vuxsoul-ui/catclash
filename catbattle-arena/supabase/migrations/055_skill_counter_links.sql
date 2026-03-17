ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS counter_to UUID NULL REFERENCES public.skills(id);

ALTER TABLE public.match_history
  ADD COLUMN IF NOT EXISTS skills_cancelled BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_skills_counter_to ON public.skills (counter_to);
