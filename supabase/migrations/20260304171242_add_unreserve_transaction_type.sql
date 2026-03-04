/*
  # Add unreserve transaction type

  ## Summary
  The inventory_transactions table has a CHECK constraint on transaction_type that did not
  include 'unreserve'. This migration drops the old constraint and adds a new one that
  includes 'unreserve' so that parts can be released back to stock from a repair order.

  ## Changes
  - Modified: inventory_transactions.transaction_type CHECK constraint now allows 'unreserve'
*/

ALTER TABLE inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_transaction_type_check
    CHECK (transaction_type = ANY (ARRAY[
      'receive'::text,
      'adjust'::text,
      'reserve'::text,
      'unreserve'::text,
      'consume'::text,
      'release'::text
    ]));
