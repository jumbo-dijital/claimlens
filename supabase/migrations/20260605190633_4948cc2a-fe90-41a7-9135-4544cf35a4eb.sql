UPDATE public.audit_log
SET details = jsonb_set(
  details,
  '{changes,images}',
  jsonb_build_object(
    'from', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('angle', e->>'angle', 'url', '[image omitted]'))
      FROM jsonb_array_elements(details->'changes'->'images'->'from') e
    ), '[]'::jsonb),
    'to', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('angle', e->>'angle', 'url', '[image omitted]'))
      FROM jsonb_array_elements(details->'changes'->'images'->'to') e
    ), '[]'::jsonb)
  )
)
WHERE details ? 'changes'
  AND details->'changes' ? 'images';