defmodule GroupherServer.CMS.Model.Embeds.CommentEmotion.Macros do
  @moduledoc """
  Generates persisted counts and viewer projections for each comment emotion.

  e.g:
    field(:beer_count, :integer, default: 0)
    field(:viewer_has_beered, :boolean, default: false, virtual: true)

  Business position:

      CMS context
        -> Macros schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  @supported_emotions GroupherServer.CMS.Artiment.Config.comment_emotions()

  @doc "Generates the count and viewer projection fields for each comment emotion."
  defmacro emotion_fields do
    @supported_emotions
    |> Enum.map(fn emotion ->
      quote do
        field(unquote(:"#{emotion}_count"), :integer, default: 0)
        field(unquote(:"viewer_has_#{emotion}ed"), :boolean, default: false, virtual: true)
      end
    end)
  end
end

defmodule GroupherServer.CMS.Model.Embeds.CommentEmotion do
  @type t :: %__MODULE__{}

  @moduledoc """
  Embedded emotion counters and recent-user snapshots for a comment.

  Business position:

      Comment reaction write
        -> CommentEmotion changeset
        -> Comment row
        -> Viewer-aware GraphQL projection
  """
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  import GroupherServer.CMS.Model.Embeds.CommentEmotion.Macros
  @supported_emotions GroupherServer.CMS.Artiment.Config.comment_emotions()
  @optional_fields Enum.map(@supported_emotions, &:"#{&1}_count")

  @doc "default emotion status for article comment"
  # for create comment and test usage
  def default_emotions do
    @supported_emotions
    |> Enum.reduce([], fn emotion, acc ->
      acc ++
        [
          "#{emotion}_count": 0,
          "latest_#{emotion}_users": [],
          "viewer_has_#{emotion}ed": false
        ]
    end)
    |> Enum.into(%{})
  end

  @doc false
  def default_persisted_emotions do
    @supported_emotions
    |> Enum.reduce(%{}, fn emotion, acc ->
      Map.merge(acc, %{
        :"#{emotion}_count" => 0,
        :"viewer_has_#{emotion}ed" => false
      })
    end)
  end

  embedded_schema do
    emotion_fields()
  end

  def changeset(struct, params) do
    struct
    |> cast(params, @optional_fields)

    # |> cast_embed(:latest_downvote_users, required: false, with: &Embeds.User.changeset/2)
    # |> ...
  end
end
