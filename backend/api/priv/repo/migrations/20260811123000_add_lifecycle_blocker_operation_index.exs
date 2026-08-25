defmodule GroupherServer.Repo.Migrations.AddLifecycleBlockerOperationIndex do
  use Ecto.Migration

  def change do
    create unique_index(
             :community_lifecycle_blockers,
             [:created_by_operation_ref],
             prefix: "cms",
             name: :community_lifecycle_blockers_operation_ref_index
           )
  end
end
