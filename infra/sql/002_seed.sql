-- Three demo estates so the portal has something to chew on.
INSERT INTO run (run_id, app_id, status, state) VALUES
  ('MOD-DEMO-001', 'polad',  'created', '{"demo": true}'::jsonb),
  ('MOD-DEMO-002', 'corebk', 'created', '{"demo": true}'::jsonb),
  ('MOD-DEMO-003', 'claims', 'created', '{"demo": true}'::jsonb)
ON CONFLICT (run_id) DO NOTHING;
