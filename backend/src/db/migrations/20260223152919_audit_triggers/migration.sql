CREATE OR REPLACE FUNCTION "audit_trigger_func"()
RETURNS TRIGGER AS $$
DECLARE
  "current_user_id" BIGINT;
  "current_session_id" BIGINT;
BEGIN
  -- Get current user/session from application context
  current_user_id := NULLIF(current_setting('app.current_user_id', true), '')::BIGINT;
  current_session_id := NULLIF(current_setting('app.current_session_id', true), '')::BIGINT;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO "audit_logs" (
      user_id, session_id, action, entity_type, entity_id, new_values, created_at
    ) VALUES (
      current_user_id, current_session_id,
      TG_TABLE_NAME || '.created', TG_TABLE_NAME, NEW.id,
      to_jsonb(NEW) - 'password', NOW()
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD IS DISTINCT FROM NEW THEN
      INSERT INTO "audit_logs" (
        user_id, session_id, action, entity_type, entity_id,
        old_values, new_values, created_at
      ) VALUES (
        current_user_id, current_session_id,
        TG_TABLE_NAME || '.updated', TG_TABLE_NAME, NEW.id,
        to_jsonb(OLD) - 'password', to_jsonb(NEW) - 'password', NOW()
      );
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO "audit_logs" (
      user_id, session_id, action, entity_type, entity_id, old_values, created_at
    ) VALUES (
      current_user_id, current_session_id,
      TG_TABLE_NAME || '.deleted', TG_TABLE_NAME, OLD.id,
      to_jsonb(OLD) - 'password', NOW()
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER "audit_users" AFTER INSERT OR UPDATE OR DELETE ON "users"
  FOR EACH ROW EXECUTE FUNCTION "audit_trigger_func"();

CREATE TRIGGER "audit_wallets" AFTER INSERT OR UPDATE OR DELETE ON "wallets"
  FOR EACH ROW EXECUTE FUNCTION "audit_trigger_func"();

CREATE TRIGGER "audit_deposits" AFTER INSERT OR UPDATE ON "deposits"
  FOR EACH ROW EXECUTE FUNCTION "audit_trigger_func"();

-- * NOTE: Will uncomment once `blockchain_transactions` table schema is ready 
-- CREATE TRIGGER "audit_blockchain_transactions" AFTER INSERT OR UPDATE ON "blockchain_transactions"
--   FOR EACH ROW EXECUTE FUNCTION "audit_trigger_func"();

CREATE TRIGGER "audit_user_roles" AFTER INSERT OR DELETE ON "user_roles"
  FOR EACH ROW EXECUTE FUNCTION "audit_trigger_func"();