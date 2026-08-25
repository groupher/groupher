defmodule GroupherServer.CMS.Communities.Const do
  @moduledoc """
  Closed community lifecycle and setup vocabulary.

      Community command -> Communities.Const -> lifecycle persistence
  """

  use GroupherServer.Const

  enum lifecycle_state do
    [
      setting_up: :setting_up,
      setup_failed: :setup_failed,
      active: :active,
      read_only: :read_only,
      suspended: :suspended,
      archived: :archived,
      pending_destroy: :pending_destroy,
      destroy: :destroy
    ]
  end

  enum lifecycle_blocker_type do
    [
      owner_archive: :owner_archive,
      moderation_suspend: :moderation_suspend,
      moderation_archive: :moderation_archive,
      ops_legal_hold: :ops_legal_hold
    ]
  end

  enum(lifecycle_blocker_end_type, do: [released: :released, terminated: :terminated])
  @pending_states %{normal: 0, applying: 1}

  @spec pending_state(:normal | :applying) :: 0 | 1
  def pending_state(state), do: Map.fetch!(@pending_states, state)
end
