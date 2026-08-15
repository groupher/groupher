defmodule GroupherServer.CMS.Model.Embeds.ArticleEmotion.Macros do
  @moduledoc """
  Generates persisted counts and viewer projections for each artiment emotion.

  e.g:
    field(:beer_count, :integer, default: 0)
    field(:viewer_has_beered, :boolean, default: false, virtual: true)

  Business position:

      CMS context
        -> Macros schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  alias GroupherServer.CMS
  alias CMS.Model.Embeds

  @supported_emotions CMS.Artiment.Config.emotions()

  defmacro emotion_fields do
    @supported_emotions
    |> Enum.map(fn emotion ->
      quote do
        field(unquote(:"#{emotion}_count"), :integer, default: 0)
        field(unquote(:"#{emotion}_user_logins"), {:array, :string}, default: [])
        field(unquote(:"viewer_has_#{emotion}ed"), :boolean, default: false, virtual: true)
        embeds_many(unquote(:"latest_#{emotion}_users"), Embeds.User, on_replace: :delete)
      end
    end)
  end
end

defmodule GroupherServer.CMS.Model.Embeds.ArticleEmotion do
  @type t :: %__MODULE__{}

  @moduledoc """
  Embedded emotion counters and recent-user snapshots for an artiment.

  Business position:

      Artiment reaction write
        -> ArticleEmotion changeset
        -> Artiment row
        -> Viewer-aware GraphQL projection
  """
  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  import GroupherServer.CMS.Model.Embeds.ArticleEmotion.Macros

  @supported_emotions GroupherServer.CMS.Artiment.Config.emotions()
  @optional_fields Enum.map(@supported_emotions, &:"#{&1}_count") ++
                     Enum.map(@supported_emotions, &:"#{&1}_user_logins")

  @doc "default emotion status for article comment"
  # for create comment and test usage
  def default_emotions do
    @supported_emotions
    |> Enum.reduce([], fn emotion, acc ->
      acc ++
        [
          "#{emotion}_count": 0,
          "latest_#{emotion}_users": [],
          "#{emotion}_user_logins": [],
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
  end
end
