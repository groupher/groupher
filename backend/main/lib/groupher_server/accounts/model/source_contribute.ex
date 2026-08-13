defmodule GroupherServer.Accounts.Model.SourceContribute do
  @moduledoc """
  Ecto schema for source-specific account contribution records.

  These rows let account/statistics code attribute contribution activity back to
  the originating content source.

  Business position:

      Accounts context
        -> SourceContribute schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  alias __MODULE__

  use Ecto.Schema
  import Ecto.Changeset

  @optional_fields ~w(web server mobile we_app h5)a

  @type t :: %SourceContribute{}
  embedded_schema do
    field(:web, :boolean)
    field(:server, :boolean)
    field(:mobile, :boolean)
    field(:we_app, :boolean)
    field(:h5, :boolean)
  end

  @doc false
  def changeset(%SourceContribute{} = source_contribute, attrs) do
    source_contribute
    |> cast(attrs, @optional_fields)
  end
end
