defmodule GroupherServer.CMS.Gate.Context.Scope.Ticket do
  @moduledoc """
  Carries the Community and visibility mode that a Ticket read asks Gate to enforce.

      public or internal read intent
        -> typed Community Ticket context
        -> Gate.Scope.Ticket admission
  """

  alias GroupherServer.CMS
  alias CMS.Model.Community

  @enforce_keys [:community_id, :community_slug, :visibility]
  defstruct [:community_id, :community_slug, :visibility]

  @type t :: %__MODULE__{
          community_id: pos_integer(),
          community_slug: String.t(),
          visibility: :public | :internal
        }

  @doc "Builds a public Ticket query scope for one Community."
  def public(%Community{id: id, slug: slug}) when is_integer(id) and is_binary(slug) do
    %__MODULE__{community_id: id, community_slug: slug, visibility: :public}
  end

  @doc "Builds an internal Ticket query scope for one Community."
  def internal(%Community{id: id, slug: slug}) when is_integer(id) and is_binary(slug) do
    %__MODULE__{community_id: id, community_slug: slug, visibility: :internal}
  end
end
