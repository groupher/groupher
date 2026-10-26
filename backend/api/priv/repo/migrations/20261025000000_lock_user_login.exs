defmodule GroupherServer.Repo.Migrations.LockUserLogin do
  use Ecto.Migration

  def up do
    alter table(:users, prefix: "account") do
      modify(:login, :string, null: false)
    end

    execute("""
    CREATE FUNCTION account.prevent_user_login_change() RETURNS trigger AS $$
    BEGIN
      IF NEW.login IS DISTINCT FROM OLD.login THEN
        RAISE EXCEPTION 'user login is immutable';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """)

    execute("""
    CREATE TRIGGER prevent_user_login_change
    BEFORE UPDATE ON account.users
    FOR EACH ROW EXECUTE FUNCTION account.prevent_user_login_change();
    """)
  end

  def down do
    execute("DROP TRIGGER prevent_user_login_change ON account.users")
    execute("DROP FUNCTION account.prevent_user_login_change()")

    alter table(:users, prefix: "account") do
      modify(:login, :string, null: true)
    end
  end
end
