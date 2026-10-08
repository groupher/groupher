defmodule GroupherServer.Repo.Migrations.RenameClientIdentityColumns do
  use Ecto.Migration

  @prefix "cms"

  def change do
    rename table(:community_applications, prefix: @prefix),
      :idempotency_key,
      to: :submit_command_id

    rename index(:community_applications, [:user_id, :idempotency_key],
      prefix: @prefix,
      name: :community_applications_user_idempotency_index
    ),
      to: :community_applications_user_submit_command_index
  end
end
