/*
  # Fix Repair Order Items - Remove Conflicting ALL Policy

  1. Changes
    - Drop the "Admins manage repair order items" policy with cmd=ALL
    - This policy was conflicting with the specific DELETE policy
    - The specific INSERT/SELECT/UPDATE/DELETE policies are sufficient

  2. Security
    - Specific policies for each operation remain in place
    - Admins retain full access via individual policies
*/

-- Drop the conflicting ALL policy
DROP POLICY IF EXISTS "Admins manage repair order items" ON repair_order_items;
