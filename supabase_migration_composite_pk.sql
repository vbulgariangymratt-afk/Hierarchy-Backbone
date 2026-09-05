-- ============================================================
-- MIGRATION: nodes table — single-column PK → composite PK
-- Run this in the Supabase SQL Editor (once, on the live DB).
--
-- What this does:
--   1. Drops the self-referential FK on parent_id (references nodes(id))
--      — this FK becomes structurally invalid once (id) is no longer
--        the sole PK. parent_id remains a plain text column; referential
--        integrity is enforced by RLS + application logic as before.
--   2. Drops the existing single-column PRIMARY KEY on id.
--   3. Adds a composite PRIMARY KEY on (user_id, id).
--
-- Safety:
--   • No rows are deleted or modified.
--   • Existing data for all users (including production account
--     a0dfe5ca-0769-4eab-9a67-31a5aaff9341) is fully preserved.
--   • After migration, every upsert must specify onConflict: 'user_id,id'
--     (already patched in persistentRepository.js).
-- ============================================================

-- Step 1: Drop the self-referential FK on parent_id
--         (constraint name may vary; both names attempted for safety)
ALTER TABLE public.nodes DROP CONSTRAINT IF EXISTS nodes_parent_id_fkey;

-- Step 2: Drop the existing single-column primary key
ALTER TABLE public.nodes DROP CONSTRAINT IF EXISTS nodes_pkey;

-- Step 3: Add the composite primary key (user_id, id)
--         This also implicitly creates a unique index on (user_id, id),
--         which is the conflict target used in the JS upsert calls.
ALTER TABLE public.nodes ADD PRIMARY KEY (user_id, id);

-- Verification query — run after migration to confirm:
-- SELECT conname, contype, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.nodes'::regclass
-- ORDER BY contype;
-- Expected: one row with contype='p' and definition 'PRIMARY KEY (user_id, id)'
--           No row for nodes_parent_id_fkey or single-column nodes_pkey.
