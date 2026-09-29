defmodule GroupherServer.CMS.ViewTracker.Model.ViewerState do
  @moduledoc """
  Authenticated viewer projection owned by ViewTracker.

      synchronous counted view -> ViewerState -> cms.article_viewer_states
  """

  use Ecto.Schema

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Artiment.Threads
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @primary_key false

  schema "article_viewer_states" do
    field(:thread, Ecto.Enum, values: Threads.article_enums())
    field(:article_id, :id)
    belongs_to(:user, User, foreign_key: :user_id)
    timestamps(type: :utc_datetime, updated_at: false)
  end
end
