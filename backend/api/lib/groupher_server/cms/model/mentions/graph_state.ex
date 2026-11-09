defmodule GroupherServer.CMS.Model.Mentions.GraphState do
  @moduledoc """
  Stores the single global Mentions graph revision used as a query consistency fence.

      Mention write transaction
        -> increment the fixed revision row
        -> graph query checks the value before and after reading
  """

  use Ecto.Schema

  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @primary_key {:id, :id, autogenerate: false}

  schema "mentions_graph_state" do
    field(:revision, :integer, default: 0)
  end
end
