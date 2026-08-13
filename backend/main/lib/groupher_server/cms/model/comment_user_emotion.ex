defmodule GroupherServer.CMS.Model.CommentUserEmotion do
  @moduledoc """
  Ecto schema for per-user comment emotion reactions.

  This keeps expressive reaction state independent from comment upvote state.

  Business position:

      CMS context
        -> CommentUserEmotion schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema

  import Ecto.Changeset
    import GroupherServer.CMS.Helper.Constraints, only: [comment_emotion_unique_key_constraint: 1]

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.Comment
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @supported_emotions GroupherServer.CMS.Artiment.Config.comment_emotions()

  @required_fields ~w(comment_id user_id received_user_id emotion)a

  @type t :: %__MODULE__{}
  schema "comments_users_emotions" do
    belongs_to(:comment, Comment, foreign_key: :comment_id)
    belongs_to(:received_user, User, foreign_key: :received_user_id)
    belongs_to(:user, User, foreign_key: :user_id)

    field(:emotion, :string)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(struct, attrs) do
    struct
    |> cast(attrs, @required_fields)
    |> normalize_emotion()
    |> validate_required(@required_fields)
    |> validate_inclusion(:emotion, Enum.map(@supported_emotions, &to_string/1))
    |> foreign_key_constraint(:comment_id)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:received_user_id)
    |> comment_emotion_unique_key_constraint()
  end

  def update_changeset(struct, attrs), do: changeset(struct, attrs)

  defp normalize_emotion(changeset) do
    update_change(changeset, :emotion, fn
      emotion when is_atom(emotion) -> to_string(emotion)
      emotion -> emotion
    end)
  end
end
