defmodule GroupherServer.Repo.Migrations.StableCommentDeliveryIdentity do
  @moduledoc "Comment delivery metadata is stable while Doc body deliveries retain branch identity."
  use Ecto.Migration

  def up do
    for table <- [:mentions, :notifications] do
      create(
        constraint(table, :comment_delivery_has_no_body_branch,
          prefix: "messaging",
          check: "comment_id IS NULL OR branch_id IS NULL"
        )
      )
    end
  end

  def down do
    raise "Stable comment delivery has no compatibility rollback"
  end
end
