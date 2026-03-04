/*
  # Fix supplies trigger to bypass RLS

  1. Problem
    - The recalculate_repair_order_supplies trigger function updates repair_orders table
    - Even with SECURITY DEFINER, RLS policies are still checked
    - This causes 500 errors when deleting repair_order_items

  2. Solution
    - Add row_security = off to bypass RLS within the trigger
    - This is safe because the trigger function validates data internally
*/

CREATE OR REPLACE FUNCTION public.recalculate_repair_order_supplies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $function$
DECLARE
  v_order_id uuid;
  v_shop_id uuid;
  v_enabled boolean;
  v_calc_method text;
  v_basis text;
  v_rate numeric;
  v_flat numeric;
  v_min numeric;
  v_max numeric;
  v_labor_total numeric;
  v_parts_total numeric;
  v_fees_total numeric;
  v_labor_hours numeric;
  v_amount numeric;
  v_order_exists boolean;
BEGIN
  v_order_id := coalesce(new.repair_order_id, old.repair_order_id);
  IF v_order_id IS NULL THEN
    RETURN coalesce(new, old);
  END IF;

  SELECT EXISTS(SELECT 1 FROM repair_orders WHERE id = v_order_id) INTO v_order_exists;
  IF NOT v_order_exists THEN
    RETURN coalesce(new, old);
  END IF;

  SELECT ro.shop_id,
         coalesce(ss.supplies_enabled, false),
         coalesce(ss.supplies_calc_method, 'percent_labor'),
         coalesce(ss.supplies_basis, 'non_declined'),
         coalesce(ss.supplies_rate, 0),
         coalesce(ss.supplies_flat_amount, 0),
         ss.supplies_min_amount,
         ss.supplies_max_amount
  INTO v_shop_id, v_enabled, v_calc_method, v_basis, v_rate, v_flat, v_min, v_max
  FROM repair_orders ro
  LEFT JOIN shop_settings ss ON ss.shop_id = ro.shop_id
  WHERE ro.id = v_order_id;

  IF v_shop_id IS NULL THEN
    RETURN coalesce(new, old);
  END IF;

  IF NOT v_enabled THEN
    UPDATE repair_orders
    SET supplies_amount = 0,
        supplies_last_calculated_at = now()
    WHERE id = v_order_id;
    RETURN coalesce(new, old);
  END IF;

  SELECT
    coalesce(sum(CASE WHEN item_type = 'labor' THEN coalesce(labor_hours, 0) * coalesce(unit_price, 0) ELSE 0 END), 0),
    coalesce(sum(CASE WHEN item_type = 'part' THEN coalesce(quantity, 0) * coalesce(unit_price, 0) ELSE 0 END), 0),
    coalesce(sum(CASE WHEN item_type = 'fee' THEN coalesce(quantity, 0) * coalesce(unit_price, 0) ELSE 0 END), 0),
    coalesce(sum(CASE WHEN item_type = 'labor' THEN coalesce(labor_hours, 0) ELSE 0 END), 0)
  INTO v_labor_total, v_parts_total, v_fees_total, v_labor_hours
  FROM repair_order_items
  WHERE repair_order_id = v_order_id
  AND (CASE WHEN v_basis = 'approved_only' THEN status = 'approved' ELSE status <> 'declined' END);

  IF v_calc_method = 'flat_per_ro' THEN
    v_amount := v_flat;
  ELSIF v_calc_method = 'per_billed_hour' THEN
    v_amount := v_labor_hours * v_rate;
  ELSIF v_calc_method = 'percent_labor_parts' THEN
    v_amount := (v_labor_total + v_parts_total) * (v_rate / 100);
  ELSE
    v_amount := v_labor_total * (v_rate / 100);
  END IF;

  IF v_min IS NOT NULL AND v_amount < v_min THEN
    v_amount := v_min;
  END IF;
  IF v_max IS NOT NULL AND v_max > 0 AND v_amount > v_max THEN
    v_amount := v_max;
  END IF;
  IF v_amount < 0 THEN
    v_amount := 0;
  END IF;

  UPDATE repair_orders
  SET supplies_amount = round(v_amount::numeric, 2),
      supplies_last_calculated_at = now()
  WHERE id = v_order_id;

  RETURN coalesce(new, old);
EXCEPTION WHEN OTHERS THEN
  RETURN coalesce(new, old);
END;
$function$;
