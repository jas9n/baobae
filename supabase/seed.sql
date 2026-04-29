insert into public.contestants (name, bio, display_order)
values
  ('Adrian', 'The gym rat with suspiciously great poetry.', 1),
  ('Blake', 'Quiet in the villa, chaotic in confessionals.', 2),
  ('Cassian', 'Always dressed like he knew the theme first.', 3),
  ('Dante', 'Flirts hard, folds under pressure.', 4),
  ('Elias', 'Soft-spoken strategist with main-character eye contact.', 5),
  ('Felix', 'Golden retriever energy in a designer jacket.', 6),
  ('Gavin', 'The wildcard who turns every group date into theater.', 7),
  ('Hayes', 'Too smooth to trust, too charming to ignore.', 8),
  ('Isaiah', 'Looks innocent until the recoupling starts.', 9),
  ('Julian', 'Romantic lead vibes with reality-TV timing.', 10)
on conflict do nothing;
