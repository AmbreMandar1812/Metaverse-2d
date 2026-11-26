INSERT INTO "Element" ("id", "width", "height", "static", "imageUrl")
VALUES
    ('builtin_fern', 1, 1, true, '/elements/fern.svg'),
    ('builtin_lamp', 1, 1, true, '/elements/lamp.svg'),
    ('builtin_bench', 1, 1, true, '/elements/bench.svg')
ON CONFLICT ("id") DO NOTHING;
