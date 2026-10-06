defmodule GroupherServer.CMS.Articles.Commands.RevisionConfirmation do
  @moduledoc """
  Immutable revision anchor shared by Article create and update commands.

      Article create / update
        -> RevisionConfirmation
        -> RevisionResult.build/2
        -> revision-rooted Article result
  """

  @behaviour GroupherServer.CMS.Command.ConfirmationCodec
  alias GroupherServer.CMS.Articles.Commands.ArticleConfirmationCodec, as: Codec
  alias GroupherServer.CMS.Command.Confirmation, as: ConfirmationCodec

  @operations [:article_create, :article_update]
  @fields %{
    "article_id" => :string,
    "revision_id" => :string,
    "community_id" => :integer,
    "author_id" => :integer,
    "inner_id" => :integer,
    "thread" => :string,
    "publication_version" => :integer,
    "published_at" => :datetime,
    "command_id" => :string
  }
  @enforce_keys Map.keys(@fields) |> Enum.map(&String.to_atom/1)
  defstruct @enforce_keys

  @impl true
  def operations, do: @operations

  @impl true
  def encode(%__MODULE__{} = value, operation) when operation in @operations do
    Codec.encode_payload(operation, %{
      "article_id" => value.article_id,
      "revision_id" => value.revision_id,
      "community_id" => value.community_id,
      "author_id" => value.author_id,
      "inner_id" => value.inner_id,
      "thread" => Atom.to_string(value.thread),
      "publication_version" => value.publication_version,
      "published_at" => DateTime.to_iso8601(value.published_at),
      "command_id" => value.command_id
    })
  rescue
    _ -> {:error, :invalid_confirmation}
  end

  def encode(_, _), do: {:error, :confirmation_mismatch}

  @impl true
  def decode(payload, operation) when operation in @operations do
    with {:ok, payload} <- Codec.decode_payload(payload, operation, @fields),
         {:ok, published_at, 0} <- DateTime.from_iso8601(payload["published_at"]),
         {:ok, thread} <- decode_thread(payload["thread"]) do
      {:ok,
       struct!(__MODULE__,
         article_id: payload["article_id"],
         revision_id: payload["revision_id"],
         community_id: payload["community_id"],
         author_id: payload["author_id"],
         inner_id: payload["inner_id"],
         thread: thread,
         publication_version: payload["publication_version"],
         published_at: published_at,
         command_id: payload["command_id"]
       )}
    else
      _ -> ConfirmationCodec.decode_error()
    end
  end

  def decode(_, _), do: ConfirmationCodec.decode_error()

  defp decode_thread(value) when value in ~w(post blog changelog doc) do
    {:ok, String.to_existing_atom(value)}
  end

  defp decode_thread(_), do: {:error, :invalid_thread}
end
