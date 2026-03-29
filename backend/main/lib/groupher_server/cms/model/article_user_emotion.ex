defmodule GroupherServer.CMS.Model.ArticleUserEmotion do
  @moduledoc false

  use Ecto.Schema

  import Ecto.Changeset
  import Helper.Utils, only: [get_config: 2]
  import GroupherServer.CMS.Helper.Macros

  import GroupherServer.CMS.Helper.Constraints,
    only: [
      articles_emotion_unique_key_constraint: 1,
      articles_exactly_one_ref_constraint: 2,
      articles_foreign_key_constraint: 1
    ]

  alias GroupherServer.Accounts.Model.User
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @supported_emotions get_config(:article, :emotions)
  @article_threads get_config(:article, :threads)

  @required_fields ~w(user_id received_user_id emotion)a
  @optional_fields Enum.map(@article_threads, &:"#{&1}_id")

  @type t :: %__MODULE__{}
  schema "articles_users_emotions" do
    belongs_to(:received_user, User, foreign_key: :received_user_id)
    belongs_to(:user, User, foreign_key: :user_id)

    field(:emotion, :string)
    article_belongs_to_fields()

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
    |> articles_emotion_unique_key_constraint()
    |> articles_foreign_key_constraint()
    |> articles_exactly_one_ref_constraint(:articles_users_emotions)
  end

  def update_changeset(struct, attrs), do: changeset(struct, attrs)

  defp normalize_emotion(changeset) do
    update_change(changeset, :emotion, fn
      emotion when is_atom(emotion) -> to_string(emotion)
      emotion -> emotion
    end)
  end
end
