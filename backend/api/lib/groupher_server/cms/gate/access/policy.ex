defmodule GroupherServer.CMS.Gate.Access.Policy do
  @moduledoc """
  Stable Gate Access entrypoint for resource-specific pure admission policies.

      Gate.Access.Check
        -> Gate.Access.Policy
        -> resource policy
        -> allow / deny result
  """

  alias __MODULE__.{Article, Comment, Community}

  @doc "Evaluates a Community admission policy."
  defdelegate community(actor, action, resource, context), to: Community, as: :check_access

  @doc "Evaluates an Article admission policy."
  defdelegate article(actor, action, context), to: Article, as: :check_access

  @doc "Evaluates a Comment admission policy."
  defdelegate comment(actor, action, context), to: Comment, as: :check_access
end
