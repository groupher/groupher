defmodule GroupherServer.CMS.ContentImport.Persistence.Connection do
  @moduledoc """
  Persisted, community-scoped pointer to an external platform source.

  Credentials are deliberately represented only by `credential_locator`;
  tokens and private keys are rejected from the public configuration map.

  See `docs/bulk-import/content-import-architecture.md` for the persistence boundary.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.Community
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @platforms ~w(github archive notion sanity)a
  @statuses ~w(active disabled)a
  @required_fields ~w(community_id platform source_ref connection_key status)a
  @optional_fields ~w(config credential_locator)a
  @sensitive_fragments ~w(token secret password authorization private_key credential)

  @type t :: %__MODULE__{}

  schema "content_import_connections" do
    field(:hash_id, Ecto.UUID, autogenerate: true)
    belongs_to(:community, Community)

    field(:platform, Ecto.Enum, values: @platforms)
    field(:source_ref, :string)
    field(:connection_key, :string, default: "default")
    field(:status, Ecto.Enum, values: @statuses, default: :active)
    field(:config, :map, default: %{})
    field(:credential_locator, :string)

    timestamps(type: :utc_datetime)
  end

  @doc "Returns the external source platforms accepted by the persistence contract."
  @spec platforms() :: [atom()]
  def platforms, do: @platforms

  @doc "Builds a credential-safe, community-scoped external source connection changeset."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = connection, attrs) do
    connection
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:platform, @platforms)
    |> validate_inclusion(:status, @statuses)
    |> validate_length(:source_ref, min: 1, max: 1_000)
    |> validate_length(:connection_key, min: 1, max: 120)
    |> validate_length(:credential_locator, max: 500)
    |> validate_secret_free_config()
    |> foreign_key_constraint(:community_id)
    |> unique_constraint([:community_id, :platform, :source_ref, :connection_key],
      name: :content_import_connections_source_index
    )
    |> unique_constraint(:hash_id)
  end

  defp validate_secret_free_config(changeset) do
    validate_change(changeset, :config, fn :config, config ->
      if sensitive_key?(config),
        do: [config: "must not contain credentials or authorization secrets"],
        else: []
    end)
  end

  defp sensitive_key?(map) when is_map(map) do
    Enum.any?(map, fn {key, value} ->
      normalized_key = key |> to_string() |> String.downcase()

      Enum.any?(@sensitive_fragments, &String.contains?(normalized_key, &1)) or
        sensitive_key?(value)
    end)
  end

  defp sensitive_key?(values) when is_list(values), do: Enum.any?(values, &sensitive_key?/1)
  defp sensitive_key?(_value), do: false
end
