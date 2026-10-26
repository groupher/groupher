defmodule GroupherServer.CMS.Model.Embeds.ArticleMeta do
  @type t :: %__MODULE__{}

  @moduledoc """
  Embedded operational metadata shared by article-like CMS threads.

  It carries engagement projections, comment sequencing, and
  thread identity alongside the thread's primary schema.

  Business position:

      CMS context
        -> ArticleMeta schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS

  alias CMS.Artiment.Threads

  @optional_fields ~w(thread is_edited is_comment_locked comments_participant_user_ids upvoted_user_ids is_sunk can_undo_sink last_active_at next_floor next_comment_inner_id)a

  @doc "for test usage"
  def default_meta do
    %{
      thread: :post,
      is_edited: false,
      is_comment_locked: false,
      folded_comment_count: 0,
      comments_participant_user_ids: [],
      upvoted_user_ids: [],
      is_sunk: false,
      can_undo_sink: true,
      last_active_at: nil,
      next_floor: 0,
      next_comment_inner_id: 0
    }
  end

  embedded_schema do
    field(:thread, Ecto.Enum, values: Threads.article_enums())
    field(:is_edited, :boolean, default: false)
    field(:is_comment_locked, :boolean, default: false)
    field(:folded_comment_count, :integer, default: 0)

    field(:upvoted_user_ids, {:array, :integer}, default: [])

    field(:comments_participant_user_ids, {:array, :integer}, default: [])

    field(:is_sunk, :boolean, default: false)
    field(:can_undo_sink, :boolean, default: false)
    # if undo_sink, can recover last active_at from here
    field(:last_active_at, :utc_datetime, default: nil)
    field(:next_floor, :integer, default: 0)
    field(:next_comment_inner_id, :integer, default: 0)
  end

  def changeset(struct, params) do
    struct
    |> cast(params, @optional_fields)
  end
end
