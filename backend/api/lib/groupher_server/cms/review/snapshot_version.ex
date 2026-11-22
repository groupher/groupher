defmodule GroupherServer.CMS.Review.SnapshotVersion do
  @moduledoc """
  Derives the stable public review version for an immutable Article Snapshot.

  A WorkingCopy revision is local to that editable copy and can restart at 1
  after a fork. Reports therefore identify the public Snapshot, not its source
  WorkingCopy revision.

  Business position:

      ArticlePublic.snapshot_id -> SnapshotVersion -> Article / report target
  """

  @max_version 2_147_483_646

  @doc "Returns the stable positive integer version derived from a Snapshot UUID."
  @spec from_id(Ecto.UUID.t()) :: pos_integer()
  def from_id(snapshot_id) when is_binary(snapshot_id) do
    <<value::unsigned-big-64, _rest::binary>> =
      :crypto.hash(:sha256, Ecto.UUID.dump!(snapshot_id))

    rem(value, @max_version) + 1
  end
end
