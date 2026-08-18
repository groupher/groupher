defmodule GroupherServer.CMS.Gate.Scope.Document do
  @moduledoc """
  Compiles ArticleDocument access through its Article and Community ancestors.

  Business position:

      ArticleDocument query
        -> Gate Scope
        -> public Document boundary

  Example:

      iex> context = GroupherServer.CMS.Gate.Context.Scope.Document.public(:post)
      iex> %Ecto.Query{} = scope(Ecto.Queryable.to_query(GroupherServer.CMS.Model.ArticleDocument), nil, :read, context)
  """

  alias GroupherServer.CMS.Const
  alias GroupherServer.CMS.Gate.Scope.{ArticleSchema, CommunityChain}
  alias GroupherServer.CMS.Gate.Scope.Policy

  require Const

  @behaviour Policy

  @actions [:read, :list]

  @doc "Compiles ArticleDocument ancestor and branch predicates into an Ecto query."
  @spec scope(Ecto.Query.t(), term(), atom(), GroupherServer.CMS.Gate.Context.Scope.Document.t()) ::
          Ecto.Query.t() | {:error, atom()}
  @impl Policy
  def scope(%Ecto.Query{} = query, actor, action, %{thread: thread} = context)
      when action in @actions do
    branch_ref =
      if thread == :doc,
        do: Map.get(context, :branch_id) || Map.get(context, :branch_policy),
        else: nil

    with {:ok, article_schema} <- ArticleSchema.fetch(thread),
         {:ok, policy_mode} <- policy_mode(context),
         stage <- Map.get(context, :stage, :public),
         %Ecto.Query{} = scoped <-
           CommunityChain.document(
             query,
             thread,
             article_schema,
             policy_mode,
             stage,
             branch_ref
           ),
         %Ecto.Query{} = scoped <- CommunityChain.community_actor(scoped, policy_mode, actor) do
      scoped
    end
  end

  def scope(_query, _actor, action, _context) when action in @actions,
    do: {:error, Const.gate_error(:scope_context_missing)}

  def scope(_query, _actor, _action, _context), do: {:error, :unknown_action}

  defp policy_mode(%{policy_mode: mode})
       when mode in [:public, :owner_management, :moderator_management, :operations],
       do: {:ok, mode}

  defp policy_mode(_context), do: {:error, Const.gate_error(:scope_context_missing)}
end
