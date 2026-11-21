defmodule GroupherServer.CMS.Passport.Scope.Article do
  @moduledoc """
  Authorization facts bound to an actor and an already loaded Article.

      canonical Article + actor -> Article scope -> Passport allowed?

  Membership contains only this actor's current row and its revision, or nil.
  """
  @enforce_keys [:actor_id, :article_id, :owner_user_id, :global, :membership]
  defstruct [:actor_id, :article_id, :owner_user_id, :global, :membership]

  @type t :: %__MODULE__{}
end
