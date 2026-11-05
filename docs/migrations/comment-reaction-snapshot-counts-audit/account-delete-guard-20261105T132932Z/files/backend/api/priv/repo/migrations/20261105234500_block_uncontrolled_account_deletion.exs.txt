defmodule GroupherServer.Repo.Migrations.BlockUncontrolledAccountDeletion do
  @moduledoc """
  Blocks physical account deletion until an owning deletion workflow exists.

      DELETE / TRUNCATE account.users -> database guard -> reject before cascades
  """
  use Ecto.Migration

  def up do
    execute("""
    CREATE FUNCTION account.guard_users_physical_deletion() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT = 'account_users_physical_delete_forbidden',
        SCHEMA = 'account',
        TABLE = 'users',
        MESSAGE = 'Physical account deletion is disabled';
    END;
    $$;
    """)

    execute("""
    CREATE TRIGGER block_users_physical_delete
    BEFORE DELETE ON account.users FOR EACH ROW
    EXECUTE FUNCTION account.guard_users_physical_deletion();
    """)

    execute("""
    CREATE TRIGGER block_users_truncate
    BEFORE TRUNCATE ON account.users FOR EACH STATEMENT
    EXECUTE FUNCTION account.guard_users_physical_deletion();
    """)

    execute("ALTER TABLE account.users ENABLE ALWAYS TRIGGER block_users_physical_delete")
    execute("ALTER TABLE account.users ENABLE ALWAYS TRIGGER block_users_truncate")
  end

  def down do
    raise "Physical account deletion has no supported compatibility rollback"
  end
end
