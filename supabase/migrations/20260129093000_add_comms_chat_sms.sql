/*
  # Add communications: chat + email/sms logs + sms metering
*/

ALTER TABLE shop_settings
  ADD COLUMN IF NOT EXISTS sms_monthly_allowance integer DEFAULT 200,
  ADD COLUMN IF NOT EXISTS sms_allow_overage boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_overage_rate numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_from text,
  ADD COLUMN IF NOT EXISTS sms_enabled boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  repair_order_id uuid REFERENCES repair_orders(id) ON DELETE SET NULL,
  thread_type text NOT NULL CHECK (thread_type IN ('ro','general','internal')) DEFAULT 'general',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin','customer')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  sender_auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbound_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('app','email','sms')),
  subject text,
  body text,
  status text NOT NULL DEFAULT 'queued',
  segments integer DEFAULT 1,
  provider_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sms_usage_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  month date NOT NULL,
  outbound_segments integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, month)
);

CREATE TABLE IF NOT EXISTS sms_opt_out (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('opted_in','opted_out')) DEFAULT 'opted_in',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, customer_id)
);

CREATE TABLE IF NOT EXISTS sms_overage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  month date NOT NULL,
  segments_over integer NOT NULL DEFAULT 0,
  rate_per_segment numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_shop_id ON chat_threads(shop_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_ro_id ON chat_threads(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_outbound_message_log_shop_id ON outbound_message_log(shop_id);
CREATE INDEX IF NOT EXISTS idx_sms_usage_monthly_shop_id ON sms_usage_monthly(shop_id);
CREATE INDEX IF NOT EXISTS idx_sms_opt_out_shop_id ON sms_opt_out(shop_id);

ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_message_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_usage_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_opt_out ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_overage_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION increment_sms_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  month_start date;
  allowance integer := 200;
  allow_overage boolean := false;
  over_rate numeric := 0;
  current_segments integer := 0;
BEGIN
  IF NEW.channel <> 'sms' THEN
    RETURN NEW;
  END IF;

  month_start := date_trunc('month', NEW.created_at)::date;
  SELECT COALESCE(sms_monthly_allowance, 200),
         COALESCE(sms_allow_overage, false),
         COALESCE(sms_overage_rate, 0)
    INTO allowance, allow_overage, over_rate
  FROM shop_settings
  WHERE shop_id = NEW.shop_id
  LIMIT 1;

  INSERT INTO sms_usage_monthly (shop_id, month, outbound_segments)
  VALUES (NEW.shop_id, month_start, COALESCE(NEW.segments, 1))
  ON CONFLICT (shop_id, month)
  DO UPDATE SET outbound_segments = sms_usage_monthly.outbound_segments + COALESCE(NEW.segments, 1),
                updated_at = now()
  RETURNING outbound_segments INTO current_segments;

  IF current_segments > allowance THEN
    IF NOT allow_overage THEN
      RAISE EXCEPTION 'SMS allowance exceeded';
    ELSE
      INSERT INTO sms_overage_events (shop_id, month, segments_over, rate_per_segment)
      VALUES (NEW.shop_id, month_start, current_segments - allowance, over_rate);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sms_usage ON outbound_message_log;
CREATE TRIGGER trigger_sms_usage
AFTER INSERT ON outbound_message_log
FOR EACH ROW
EXECUTE FUNCTION increment_sms_usage();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_threads' AND policyname='Admins manage chat threads') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage chat threads"
      ON chat_threads FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = chat_threads.shop_id AND admins.is_active = true))
      WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = chat_threads.shop_id AND admins.is_active = true))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_threads' AND policyname='Customers view their threads') THEN
    EXECUTE $policy$
      CREATE POLICY "Customers view their threads"
      ON chat_threads FOR SELECT
      TO authenticated
      USING (
        customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
        AND thread_type <> 'internal'
      )
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_threads' AND policyname='Customers create threads') THEN
    EXECUTE $policy$
      CREATE POLICY "Customers create threads"
      ON chat_threads FOR INSERT
      TO authenticated
      WITH CHECK (
        thread_type <> 'internal'
        AND customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
        AND shop_id IN (SELECT shop_id FROM customers WHERE auth_user_id = auth.uid())
      )
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_participants' AND policyname='Users manage own participation') THEN
    EXECUTE $policy$
      CREATE POLICY "Users manage own participation"
      ON chat_participants FOR ALL
      TO authenticated
      USING (auth_user_id = auth.uid())
      WITH CHECK (auth_user_id = auth.uid())
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_participants' AND policyname='Admins manage chat participants') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage chat participants"
      ON chat_participants FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM chat_threads t
        JOIN admins a ON a.shop_id = t.shop_id
        WHERE t.id = chat_participants.thread_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM chat_threads t
        JOIN admins a ON a.shop_id = t.shop_id
        WHERE t.id = chat_participants.thread_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_messages' AND policyname='Admins manage chat messages') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage chat messages"
      ON chat_messages FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM chat_threads t
        JOIN admins a ON a.shop_id = t.shop_id
        WHERE t.id = chat_messages.thread_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM chat_threads t
        JOIN admins a ON a.shop_id = t.shop_id
        WHERE t.id = chat_messages.thread_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_messages' AND policyname='Customers view and send messages') THEN
    EXECUTE $policy$
      CREATE POLICY "Customers view and send messages"
      ON chat_messages FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM chat_threads t
        WHERE t.id = chat_messages.thread_id
          AND t.thread_type <> 'internal'
          AND t.customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
      ))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_messages' AND policyname='Customers insert messages') THEN
    EXECUTE $policy$
      CREATE POLICY "Customers insert messages"
      ON chat_messages FOR INSERT
      TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM chat_threads t
        WHERE t.id = chat_messages.thread_id
          AND t.thread_type <> 'internal'
          AND t.customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
      ))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_attachments' AND policyname='Admins manage chat attachments') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage chat attachments"
      ON chat_attachments FOR ALL
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM chat_messages m
        JOIN chat_threads t ON t.id = m.thread_id
        JOIN admins a ON a.shop_id = t.shop_id
        WHERE m.id = chat_attachments.message_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM chat_messages m
        JOIN chat_threads t ON t.id = m.thread_id
        JOIN admins a ON a.shop_id = t.shop_id
        WHERE m.id = chat_attachments.message_id AND a.auth_user_id = auth.uid() AND a.is_active = true
      ))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_attachments' AND policyname='Customers view chat attachments') THEN
    EXECUTE $policy$
      CREATE POLICY "Customers view chat attachments"
      ON chat_attachments FOR SELECT
      TO authenticated
      USING (EXISTS (
        SELECT 1 FROM chat_messages m
        JOIN chat_threads t ON t.id = m.thread_id
        WHERE m.id = chat_attachments.message_id
          AND t.thread_type <> 'internal'
          AND t.customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
      ))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_attachments' AND policyname='Customers insert chat attachments') THEN
    EXECUTE $policy$
      CREATE POLICY "Customers insert chat attachments"
      ON chat_attachments FOR INSERT
      TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM chat_messages m
        JOIN chat_threads t ON t.id = m.thread_id
        WHERE m.id = chat_attachments.message_id
          AND t.thread_type <> 'internal'
          AND t.customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
      ))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='outbound_message_log' AND policyname='Admins manage outbound messages') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage outbound messages"
      ON outbound_message_log FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = outbound_message_log.shop_id AND admins.is_active = true))
      WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = outbound_message_log.shop_id AND admins.is_active = true))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='outbound_message_log' AND policyname='Customers insert outbound messages') THEN
    EXECUTE $policy$
      CREATE POLICY "Customers insert outbound messages"
      ON outbound_message_log FOR INSERT
      TO authenticated
      WITH CHECK (
        customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
        AND shop_id IN (SELECT shop_id FROM customers WHERE auth_user_id = auth.uid())
      )
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sms_usage_monthly' AND policyname='Admins view sms usage') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins view sms usage"
      ON sms_usage_monthly FOR SELECT
      TO authenticated
      USING (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = sms_usage_monthly.shop_id AND admins.is_active = true))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sms_opt_out' AND policyname='Admins manage sms opt out') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins manage sms opt out"
      ON sms_opt_out FOR ALL
      TO authenticated
      USING (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = sms_opt_out.shop_id AND admins.is_active = true))
      WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = sms_opt_out.shop_id AND admins.is_active = true))
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sms_opt_out' AND policyname='Customers manage own sms opt out') THEN
    EXECUTE $policy$
      CREATE POLICY "Customers manage own sms opt out"
      ON sms_opt_out FOR ALL
      TO authenticated
      USING (
        customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
        AND shop_id IN (SELECT shop_id FROM customers WHERE auth_user_id = auth.uid())
      )
      WITH CHECK (
        customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
        AND shop_id IN (SELECT shop_id FROM customers WHERE auth_user_id = auth.uid())
      )
    $policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sms_overage_events' AND policyname='Admins view sms overage') THEN
    EXECUTE $policy$
      CREATE POLICY "Admins view sms overage"
      ON sms_overage_events FOR SELECT
      TO authenticated
      USING (EXISTS (SELECT 1 FROM admins WHERE admins.auth_user_id = auth.uid() AND admins.shop_id = sms_overage_events.shop_id AND admins.is_active = true))
    $policy$;
  END IF;
END $$;
