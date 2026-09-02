-- Fix: search_path mutável em função SECURITY DEFINER (advisor warning)
-- Run this in Supabase Dashboard > SQL Editor

alter function public.is_supervisor() set search_path = public;
