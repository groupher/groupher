defmodule GroupherServer.CMS.Model.Embeds.ReferenceTask do
  @type t :: %__MODULE__{}

  @moduledoc """
  Embedded mention and bidirectional-link tasks produced from artiment content.

  Business position:

      CMS context
        -> ReferenceTask schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  use Ecto.Schema
  use Accessible
  import Ecto.Changeset

  @optional_fields ~w(bi_link_tasks mention_user_tasks)a

  # thread, article_id, block_id, author_id, reference_thread, reference_article_id

  @doc "for test usage"
  def default_meta do
    %{
      # bi_link_tasks: [],
      # mention_user_tasks: []
    }
  end

  embedded_schema do
    field(:article_id, :id)
    field(:block_id, :string)

    field(:reference_article_id, :id)
    # 可选
    field(:reference_block_id, :string)

    field(:is_finished, :boolean, default: false)
  end

  def changeset(struct, params) do
    struct
    |> cast(params, @optional_fields)
  end
end
