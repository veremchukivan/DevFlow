UPDATE "project_view_preferences"
SET
  "visible_task_fields" = COALESCE(
    (
      SELECT jsonb_agg(value)
      FROM jsonb_array_elements("visible_task_fields") AS fields(value)
      WHERE value <> '"labels"'::jsonb
    ),
    '[]'::jsonb
  ),
  "updated_at" = now()
WHERE "visible_task_fields" @> '["labels"]'::jsonb;
