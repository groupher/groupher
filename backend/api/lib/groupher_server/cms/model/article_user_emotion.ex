defmodule GroupherServer.CMS.Model.ArticleUserEmotion do
  @moduledoc """
  Ecto schema for per-user article emotion reactions.

  Emotion rows are separate from upvotes so lightweight reaction state can be
  toggled without changing ranking/vote semantics.

  Business position:

      CMS context
        -> ArticleUserEmotion schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema

  import Ecto.Changeset
  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.{Article, DocBranch}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @supported_emotions CMS.Artiment.Config.emotions()
  @required_fields ~w(user_id received_user_id emotion article_id)a
  @optional_fields ~w(branch_id)a

  @type t :: %__MODULE__{}
  schema "articles_users_emotions" do
    belongs_to(:received_user, User, foreign_key: :received_user_id)
    belongs_to(:user, User, foreign_key: :user_id)
    belongs_to(:article, Article, type: Ecto.UUID)
    belongs_to(:branch, DocBranch)

    field(:emotion, :string)
    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(struct, attrs) do
    struct
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> normalize_emotion()
    |> validate_required(@required_fields)
    |> validate_inclusion(:emotion, Enum.map(@supported_emotions, &to_string/1))
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:received_user_id)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:branch_id)
    |> unique_constraint([:user_id, :article_id, :branch_id, :emotion],
      name: :articles_users_emotions_user_stable_article_emotion_index
    )
  end

  def update_changeset(struct, attrs), do: changeset(struct, attrs)

  defp normalize_emotion(changeset) do
    update_change(changeset, :emotion, fn
      emotion when is_atom(emotion) -> to_string(emotion)
      emotion -> emotion
    end)
  end
end
