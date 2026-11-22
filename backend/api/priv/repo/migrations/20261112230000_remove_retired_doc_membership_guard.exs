defmodule GroupherServer.Repo.Migrations.RemoveRetiredDocMembershipGuard do
  use Ecto.Migration

  def up do
    execute("DROP FUNCTION cms.guard_doc_membership_owner()")
  end

  def down do
    raise "Retired Branch membership guards have no compatibility path"
  end
end
