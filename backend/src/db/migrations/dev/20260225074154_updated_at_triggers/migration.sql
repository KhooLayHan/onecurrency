CREATE OR REPLACE FUNCTION "update_updated_at_column"()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to mutable tables
CREATE TRIGGER "update_users_updated_at" BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION "update_updated_at_column"();

CREATE TRIGGER "update_wallets_updated_at" BEFORE UPDATE ON "wallets"
  FOR EACH ROW EXECUTE FUNCTION "update_updated_at_column"();

CREATE TRIGGER "update_sessions_updated_at" BEFORE UPDATE ON "sessions"
  FOR EACH ROW EXECUTE FUNCTION "update_updated_at_column"();

CREATE TRIGGER "update_accounts_updated_at" BEFORE UPDATE ON "accounts"
  FOR EACH ROW EXECUTE FUNCTION "update_updated_at_column"();