-- Fase 9 (part A): add the super_admin role value.
-- Kept in its own migration: a newly added enum value cannot be used until this
-- transaction commits, so everything that references it lives in part B.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
