defmodule GroupherServer.CMS.Gate do
  @moduledoc """
  Public facade for CMS operation admission.

  Gate exposes read admission, simple mutation checks, and transactional
  mutation callbacks:

    * `scope/4` compiles a query boundary without executing it;
    * `access_check/3` loads, locks, and checks one mutation resource.
    * `with_community_check/4` checks a Community and runs a callback in its lock;
    * `with_check/4` checks a resource and runs a callback in its lock boundary;
    * `with_community_check/5` checks an Article binding with an explicit Community;
    * `with_branch_check/6` checks a Doc binding with an explicit branch.

  Community Enable, Passport, and publish rate limiting are separate internal
  seams and are not re-exported from this facade.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Gate
        -> canonical lock + Access Context
        -> Lifecycle / Command callback
        -> Repo / Outbox intent

  Examples:

      iex> context = CMS.Gate.Context.Scope.Article.public(:post)
      iex> {:ok, query} = CMS.Gate.scope(GroupherServer.CMS.Model.Article, nil, :read, context)
      iex> %Ecto.Query{} = query

      iex> {:ok, _community} = CMS.Gate.access_check(actor, :update, community)

      iex> CMS.Gate.with_community_check(actor, :edit, community, article, fn canonical ->
      ...>   {:ok, canonical}
      ...> end)
  """

  alias __MODULE__.{Access, Scope}

  @doc "Builds a read query with a resource-specific Scope Context."
  @spec scope(Ecto.Queryable.t(), term(), atom(), GroupherServer.CMS.Gate.Context.Scope.t()) ::
          Ecto.Query.t() | {:error, ErrorCat.error()}
  def scope(queryable, actor, action, context) do
    Scope.scope(queryable, actor, action, context)
  end

  @doc """
  Loads, locks, and checks a resource inside the current mutation transaction.

  ## Examples

      CMS.Gate.access_check(actor, :update, community)
      #=> {:ok, canonical_community} | {:error, %CMS.Gate.Decision{}}
  """
  @spec access_check(term(), atom(), term()) ::
          {:ok, term()} | {:error, GroupherServer.CMS.Gate.Decision.t()}
  def access_check(actor, action, resource), do: Access.access_check(actor, action, resource)

  @doc """
  Runs resource authorization and a command callback in one aggregate transaction.

  The callback receives the canonical resource after the aggregate lock and must return
  `{:ok, result}` or `{:error, reason}`.

  ## Examples

      CMS.Gate.with_check(actor, :edit, comment, fn canonical ->
        {:ok, canonical}
      end)
  """
  @spec with_check(
          term(),
          atom(),
          struct(),
          (struct(), struct() -> {:ok, term()} | {:error, term()})
          | (struct() -> {:ok, term()} | {:error, term()})
        ) :: {:ok, term()} | {:error, term()}
  def with_check(actor, action, resource, callback),
    do: Access.with_check(actor, action, resource, callback)

  @doc """
  Runs a Community mutation callback inside the Community row lock.

  ## Examples

      CMS.Gate.with_community_check(actor, :update, community, fn canonical ->
        {:ok, canonical}
      end)
  """
  @spec with_community_check(
          term(),
          atom(),
          GroupherServer.CMS.Model.Community.t(),
          (GroupherServer.CMS.Model.Community.t() -> {:ok, term()} | {:error, term()})
        ) :: {:ok, term()} | {:error, term()}
  def with_community_check(actor, action, community, callback),
    do: Access.with_community_check(actor, action, community, callback)

  @doc """
  Runs an ordinary Article command against an explicit Community binding.

  ## Examples

      CMS.Gate.with_community_check(actor, :edit, community, article, fn canonical ->
        {:ok, canonical}
      end)
  """
  @spec with_community_check(
          term(),
          atom(),
          GroupherServer.CMS.Model.Community.t(),
          GroupherServer.CMS.Model.Article.t(),
          (GroupherServer.CMS.Model.Article.t() -> {:ok, term()} | {:error, term()})
        ) :: {:ok, term()} | {:error, term()}
  def with_community_check(actor, action, community, article, callback),
    do: Access.with_community_check(actor, action, community, article, callback)

  @doc """
  Runs a branch-scoped Doc command with an explicit Community and branch.

  ## Examples

      CMS.Gate.with_branch_check(actor, :edit, community, doc, branch_id, fn canonical ->
        {:ok, canonical}
      end)
  """
  @spec with_branch_check(
          term(),
          atom(),
          GroupherServer.CMS.Model.Community.t(),
          GroupherServer.CMS.Model.Article.t(),
          pos_integer(),
          (GroupherServer.CMS.Model.Article.t() -> {:ok, term()} | {:error, term()})
        ) :: {:ok, term()} | {:error, term()}
  def with_branch_check(actor, action, community, article, branch_id, callback),
    do: Access.with_branch_check(actor, action, community, article, branch_id, callback)
end
