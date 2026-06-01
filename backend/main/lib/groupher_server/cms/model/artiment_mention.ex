defmodule GroupherServer.CMS.Model.ArtimentMention do
  @moduledoc false

  alias __MODULE__

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS.Artiment.Threads
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @mentioner_types Threads.article_values_list() ++ [:comment]
  @mentioned_types Threads.article_values_list() ++ [:comment, :user, :url]
  @mentioned_scopes [:internal, :external]
  @mention_cases [:inline_mention, :link]

  @required_fields ~w(
    mentioner_type
    mentioner_id
    mentioner_community_id
    mentioned_scope
    mentioned_type
    mention_case
    mentioned_at
  )a

  @optional_fields ~w(
    mentioner_url
    mentioned_id
    mentioned_community_id
    mentioned_url
    mentioned_url_hash
    occurrences
    mentioner_snapshot
    mentioned_snapshot
    meta
  )a

  @type t :: %ArtimentMention{}

  schema "artiment_mentions" do
    field(:mentioner_type, Ecto.Enum, values: @mentioner_types)
    field(:mentioner_id, :id)
    field(:mentioner_community_id, :id)
    field(:mentioner_url, :string)

    field(:mentioned_scope, Ecto.Enum, values: @mentioned_scopes)
    field(:mentioned_type, Ecto.Enum, values: @mentioned_types)
    field(:mentioned_id, :id)
    field(:mentioned_community_id, :id)
    field(:mentioned_url, :string)
    field(:mentioned_url_hash, :string)

    field(:mention_case, Ecto.Enum, values: @mention_cases)
    field(:occurrences, {:array, :map}, default: [])
    field(:mentioner_snapshot, :map, default: %{})
    field(:mentioned_snapshot, :map, default: %{})
    field(:meta, :map, default: %{})
    field(:mentioned_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  def changeset(%ArtimentMention{} = mention, attrs) do
    mention
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_required(@required_fields)
    |> validate_internal_mention()
    |> validate_external_mention()
  end

  def update_changeset(%ArtimentMention{} = mention, attrs) do
    mention
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_internal_mention()
    |> validate_external_mention()
  end

  defp validate_internal_mention(changeset) do
    case get_field(changeset, :mentioned_scope) do
      :internal -> validate_required(changeset, [:mentioned_id])
      _ -> changeset
    end
  end

  defp validate_external_mention(changeset) do
    case get_field(changeset, :mentioned_scope) do
      :external -> validate_required(changeset, [:mentioned_url, :mentioned_url_hash])
      _ -> changeset
    end
  end
end
