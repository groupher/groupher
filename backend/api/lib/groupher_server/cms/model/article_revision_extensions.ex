defmodule GroupherServer.CMS.Model.ArticleRevisionExtensions do
  @moduledoc """
  Defines the legacy Docs immutable extension schema.

      ArticleRevision -> thread extension -> deterministic materialization

  The schemas share mechanics only; each physical table remains a strong typed
  owner rather than a generic JSON payload.
  """

  defmacro __using__(opts) do
    table = Keyword.fetch!(opts, :table)
    fields = Keyword.fetch!(opts, :fields)

    quote bind_quoted: [table: table, fields: fields] do
      use Ecto.Schema
      import Ecto.Changeset

      alias GroupherServer.CMS

      alias CMS.Model.ArticleRevision
      alias Helper.Constant.DBPrefix

      @primary_key false
      @foreign_key_type Ecto.UUID
      @schema_prefix DBPrefix.cms()
      @extension_fields fields
      @type t :: %__MODULE__{}

      schema table do
        belongs_to(:revision, ArticleRevision, primary_key: true)

        for {name, type} <- fields do
          field(name, type)
        end
      end

      @doc "Builds the immutable typed extension associated with one Article Revision."
      @spec changeset(t(), map()) :: Ecto.Changeset.t()
      def changeset(%__MODULE__{} = extension, attrs) do
        extension
        |> cast(attrs, [:revision_id | Keyword.keys(@extension_fields)])
        |> validate_required([:revision_id])
        |> foreign_key_constraint(:revision_id)
      end
    end
  end
end

defmodule GroupherServer.CMS.Model.DocRevision do
  @moduledoc """
  Immutable Doc-specific content shared by branch versions.

      DocDraft -> DocRevision -> DocBranchVersion
  """
  use GroupherServer.CMS.Model.ArticleRevisionExtensions,
    table: "doc_revisions",
    fields: [
      subtitle: :string,
      link_addr: :string,
      template_key: :string,
      cover_url: :string,
      cover_url_dark: :string
    ]
end
