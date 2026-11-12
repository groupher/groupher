defmodule GroupherServer.CMS.Model.ArticleBodyDocument do
  @moduledoc """
  Shares complete document fields and validation across historical and public bodies.

      trusted BodyBag -> shared document contract -> ArticleBody / ArticlePublicBody
  """
  import Ecto.Changeset

  @fields ~w(json schema_version markdown html markdown_toc plain_text thumbnail xml rss)a
  @required @fields -- [:xml, :rss]

  @doc "Declares the same complete document columns in each body schema."
  defmacro body_document_fields do
    quote do
      field(:json, :string)
      field(:schema_version, :integer, default: 1)
      field(:markdown, :string)
      field(:html, :string)
      field(:markdown_toc, :map)
      field(:plain_text, :string)
      field(:thumbnail, :map)
      field(:xml, :string)
      field(:rss, :string)
    end
  end

  @doc "Casts and validates all formats plus the caller's required ownership fields."
  def changeset(body, attrs, identity_fields) do
    body
    |> cast(attrs, identity_fields ++ @fields, empty_values: [])
    |> validate_required(identity_fields ++ @required)
    |> validate_number(:schema_version, greater_than: 0)
  end

  @doc "Copies the complete document without regenerating or dropping optional formats."
  def document(body), do: Map.take(body, @fields)
end
