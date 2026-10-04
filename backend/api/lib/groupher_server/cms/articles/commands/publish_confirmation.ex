defmodule GroupherServer.CMS.Articles.Commands.PublishConfirmation do
  @moduledoc """
  Immutable result of one Article publish operation.

      publish action -> Confirmation.encode -> Receipt -> Confirmation.decode
  """

  @behaviour GroupherServer.CMS.Command.ConfirmationCodec

  alias GroupherServer.CMS.Command.Confirmation, as: Codec

  @schema_version 1
  @fields [
    "schema_version",
    "operation",
    "article_id",
    "revision_id",
    "publication_version",
    "first_publish",
    "changed_fields",
    "published_by_id",
    "published_at"
  ]

  @enforce_keys [
    :article_id,
    :revision_id,
    :publication_version,
    :first_publish?,
    :changed_fields,
    :published_by_id,
    :published_at
  ]
  defstruct @enforce_keys

  @type t :: %__MODULE__{
          article_id: String.t(),
          revision_id: String.t(),
          publication_version: integer(),
          first_publish?: boolean(),
          changed_fields: list(atom()),
          published_by_id: integer(),
          published_at: DateTime.t()
        }

  @impl true
  def operations, do: [:article_publish]

  @impl true
  def encode(%__MODULE__{} = value, :article_publish) do
    payload = %{
      "schema_version" => @schema_version,
      "operation" => Codec.operation_tag(:article_publish),
      "article_id" => value.article_id,
      "revision_id" => value.revision_id,
      "publication_version" => value.publication_version,
      "first_publish" => value.first_publish?,
      "changed_fields" => Enum.map(value.changed_fields, &Atom.to_string/1),
      "published_by_id" => value.published_by_id,
      "published_at" => DateTime.to_iso8601(value.published_at)
    }

    if Codec.json_safe?(payload), do: {:ok, payload}, else: {:error, :invalid_confirmation}
  end

  def encode(_value, _operation), do: {:error, :confirmation_mismatch}

  @impl true
  def decode(payload, :article_publish) when is_map(payload) do
    with :ok <- Codec.strict_keys(payload, @fields),
         true <- payload["schema_version"] == @schema_version,
         "article.publish" <- payload["operation"],
         true <- is_binary(payload["article_id"]),
         true <- is_binary(payload["revision_id"]),
         true <- is_integer(payload["publication_version"]),
         true <- is_boolean(payload["first_publish"]),
         {:ok, changed_fields} <- decode_changed_fields(payload["changed_fields"]),
         true <- is_integer(payload["published_by_id"]),
         {:ok, published_at, 0} <- DateTime.from_iso8601(payload["published_at"]) do
      {:ok,
       struct!(__MODULE__,
         article_id: payload["article_id"],
         revision_id: payload["revision_id"],
         publication_version: payload["publication_version"],
         first_publish?: payload["first_publish"],
         changed_fields: changed_fields,
         published_by_id: payload["published_by_id"],
         published_at: published_at
       )}
    else
      _ -> Codec.decode_error()
    end
  end

  def decode(_payload, _operation), do: Codec.decode_error()

  defp decode_changed_fields(fields) when is_list(fields) do
    allowed = ~w(title digest slug body_hash typed_fields tags cover_edit content_hash)a
    allowed_strings = Enum.map(allowed, &Atom.to_string/1)

    if Enum.all?(fields, &(&1 in allowed_strings)),
      do: {:ok, Enum.map(fields, &String.to_existing_atom/1)},
      else: {:error, :invalid_changed_fields}
  rescue
    ArgumentError -> {:error, :invalid_changed_fields}
  end

  defp decode_changed_fields(_), do: {:error, :invalid_changed_fields}
end
