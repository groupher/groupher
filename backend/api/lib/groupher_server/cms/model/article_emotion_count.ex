defmodule GroupherServer.CMS.Model.ArticleEmotionCount do
  @moduledoc """
  Typed public count for one Article emotion.

  The Interactions domain remains the owner. This row is its sortable public
  projection and is updated in the same transaction as the interaction fact.

      Interactions owner transaction
        -> CMS.ArticleStats.apply_emotion_count/2
        -> cms.article_emotion_counts
        -> GraphQL ArticleStats.emotionCounts
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Artiment.Threads
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @primary_key false
  @emotion_types CMS.Artiment.Config.emotions() -- [:upvote, :collect]
  @required_fields ~w(thread article_id type count)a

  schema "article_emotion_counts" do
    field(:thread, Ecto.Enum, values: Threads.article_enums(), primary_key: true)
    field(:article_id, :id, primary_key: true)
    field(:type, Ecto.Enum, values: @emotion_types, primary_key: true)
    field(:count, :integer, default: 0)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(emotion_count, attrs) do
    emotion_count
    |> cast(attrs, @required_fields)
    |> validate_required(@required_fields)
    |> validate_number(:count, greater_than_or_equal_to: 0)
    |> unique_constraint([:thread, :article_id, :type], name: :article_emotion_counts_pkey)
  end
end
