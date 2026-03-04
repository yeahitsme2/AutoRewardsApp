/*
  # Fix unreserve transaction type to decrement reserved quantity

  ## Summary
  The update_stock_from_transaction trigger function did not handle the 'unreserve'
  transaction type. This meant that when a part was unreserved (either manually or
  when a repair order item was deleted), the reserved count in part_locations was
  never decremented, making inventory quantities appear lower than they actually are.

  ## Changes
  - Modified: update_stock_from_transaction() trigger function now handles 'unreserve'
    by applying delta_reserved = -NEW.quantity, matching the inverse of 'reserve'
*/

CREATE OR REPLACE FUNCTION public.update_stock_from_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  allow_negative boolean := false;
  delta_on_hand numeric := 0;
  delta_reserved numeric := 0;
BEGIN
  SELECT COALESCE(shop_settings.allow_negative_stock, false)
    INTO allow_negative
  FROM shop_settings
  WHERE shop_id = NEW.shop_id
  LIMIT 1;

  IF NEW.transaction_type = 'receive' THEN
    delta_on_hand := NEW.quantity;
  ELSIF NEW.transaction_type = 'adjust' THEN
    delta_on_hand := NEW.quantity;
  ELSIF NEW.transaction_type = 'reserve' THEN
    delta_reserved := NEW.quantity;
  ELSIF NEW.transaction_type = 'unreserve' THEN
    delta_reserved := -NEW.quantity;
  ELSIF NEW.transaction_type = 'release' THEN
    delta_reserved := -NEW.quantity;
  ELSIF NEW.transaction_type = 'consume' THEN
    delta_on_hand := -NEW.quantity;
    delta_reserved := -NEW.quantity;
  END IF;

  INSERT INTO part_locations (part_id, location_id, on_hand, reserved)
  VALUES (NEW.part_id, NEW.location_id, delta_on_hand, delta_reserved)
  ON CONFLICT (part_id, location_id)
  DO UPDATE SET
    on_hand = part_locations.on_hand + delta_on_hand,
    reserved = part_locations.reserved + delta_reserved,
    updated_at = now();

  IF NOT allow_negative THEN
    PERFORM 1 FROM part_locations
    WHERE part_id = NEW.part_id
      AND location_id = NEW.location_id
      AND on_hand < 0;
    IF FOUND THEN
      RAISE EXCEPTION 'Negative stock not allowed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
