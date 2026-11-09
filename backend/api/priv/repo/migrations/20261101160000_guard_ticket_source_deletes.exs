defmodule GroupherServer.Repo.Migrations.GuardTicketSourceDeletes do
  use Ecto.Migration

  @cms "cms"

  def up do
    execute("""
    DO $$
    BEGIN
      CREATE ROLE cms_ticket_write NOLOGIN;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
    $$
    """)

    execute("GRANT cms_ticket_write TO CURRENT_USER")
    execute("GRANT USAGE ON SCHEMA #{@cms} TO cms_ticket_write")
    execute("GRANT SELECT, DELETE ON #{@cms}.ticket_sources TO cms_ticket_write")

    execute("""
    CREATE OR REPLACE FUNCTION #{@cms}.ticket_source_delete_role_guard()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF current_user <> 'cms_ticket_write' THEN
        RAISE EXCEPTION 'ticket_source_delete_requires_controlled_role'
          USING ERRCODE = '42501', CONSTRAINT = 'ticket_source_delete_role_guard';
      END IF;

      RETURN OLD;
    END;
    $$
    """)

    execute("""
    CREATE TRIGGER ticket_source_delete_role_guard
    BEFORE DELETE ON #{@cms}.ticket_sources
    FOR EACH ROW EXECUTE FUNCTION #{@cms}.ticket_source_delete_role_guard()
    """)
  end

  def down do
    raise "TicketSource deletion guard is irreversible; restore the pre-cutover database snapshot"
  end
end
