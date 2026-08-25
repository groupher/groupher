defmodule GroupherServer.Repo.Migrations.RemoveRemoteIpFromUsers do
  use Ecto.Migration

  def up do
    execute("ALTER TABLE IF EXISTS account.users DROP COLUMN IF EXISTS remote_ip")
    execute("ALTER TABLE IF EXISTS public.users DROP COLUMN IF EXISTS remote_ip")
  end

  def down do
    execute("ALTER TABLE IF EXISTS account.users ADD COLUMN IF NOT EXISTS remote_ip varchar")
    execute("ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS remote_ip varchar")
  end
end
