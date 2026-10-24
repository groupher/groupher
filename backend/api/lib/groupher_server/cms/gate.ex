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

  @doc """
  Builds a read query with a resource-specific Scope Context.

  ## Examples

      CMS.Gate.scope(Article, viewer, :read, ArticleScope.public(:post))
  """
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
  Loads and authorizes a resource inside the caller-owned pipeline transaction.

  ## Examples

      CMS.Gate.check_in_transaction(actor, :edit, comment)
  """
  @spec check_in_transaction(term(), atom(), term()) ::
          {:ok, term()} | {:error, GroupherServer.CMS.Gate.Decision.t()}
  def check_in_transaction(actor, action, resource) do
    Access.check_in_transaction(actor, action, resource)
  end

  @doc """
  Checks a Community workflow action inside the caller-owned transaction.

  Unlike `check_in_transaction/3`, this entry is for a durable workflow rather
  than a CommandPipeline gate stage.

  ## Examples

      CMS.Gate.check_community_workflow_in_transaction(actor, :import_docs, community)
  """
  @spec check_community_workflow_in_transaction(term(), atom(), term()) ::
          {:ok, term()} | {:error, GroupherServer.CMS.Gate.Decision.t()}
  def check_community_workflow_in_transaction(actor, action, community) do
    Access.check_community_workflow_in_transaction(actor, action, community)
  end

  @doc """
  Loads and checks a resource using its explicit Community inside the caller transaction.

  Use this overload when the mutation already knows which Community supplies
  the Article binding. The returned entity is the canonical row reloaded under
  the Gate lock; the caller still owns commit/rollback.

  ## Examples

      CMS.Gate.check_in_transaction(actor, :publish, article, community)
  """
  @spec check_in_transaction(term(), atom(), term(), term()) ::
          {:ok, term()} | {:error, GroupherServer.CMS.Gate.Decision.t()}
  def check_in_transaction(actor, action, resource, community) do
    Access.check_in_transaction(actor, action, resource, community)
  end

  @doc """
  Loads and checks an Article or Doc against an explicit Community and branch.

  Docs Commands pass the target `branch_id` explicitly so Gate never guesses a
  branch from the resource's Article ID. The canonical row is locked inside the
  existing mutation transaction; the caller owns commit/rollback.

  ## Examples

      CMS.Gate.check_in_transaction(actor, :edit, article, community, branch_id)
  """
  @spec check_in_transaction(term(), atom(), term(), term(), term()) ::
          {:ok, term()} | {:error, GroupherServer.CMS.Gate.Decision.t()}
  def check_in_transaction(actor, action, resource, community, branch_id) do
    Access.check_in_transaction(actor, action, resource, community, branch_id)
  end

  @doc """
  Loads and authorizes an Article or Comment interaction target in a pipeline gate stage.

  ## Examples

      CMS.Gate.check_interaction_in_transaction(actor, :upvote, article)
  """
  @spec check_interaction_in_transaction(term(), atom(), term()) ::
          {:ok, term()} | {:error, GroupherServer.CMS.Gate.Decision.t()}
  def check_interaction_in_transaction(actor, action, resource) do
    Access.check_interaction_in_transaction(actor, action, resource)
  end

  @doc """
  Loads and authorizes a Comment and its canonical parent inside the pipeline transaction.

  ## Examples

      CMS.Gate.check_comment_in_transaction(actor, :edit, comment)
  """
  @spec check_comment_in_transaction(term(), atom(), term()) ::
          {:ok, term()} | {:error, GroupherServer.CMS.Gate.Decision.t()}
  def check_comment_in_transaction(actor, action, comment) do
    Access.check_comment_in_transaction(actor, action, comment)
  end

  @doc """
  Checks a Community Application while joining the pipeline transaction.

  ## Examples

      CMS.Gate.check_application_in_transaction(actor, :review, application)
  """
  @spec check_application_in_transaction(term(), atom(), term()) ::
          {:ok, term()} | {:error, GroupherServer.CMS.Gate.Decision.t()}
  def check_application_in_transaction(actor, action, application) do
    Access.check_application_in_transaction(actor, action, application)
  end

  @doc """
  Checks authenticated Community creation while joining the pipeline transaction.

  ## Examples

      CMS.Gate.check_community_create_in_transaction(actor, %{slug: "my-community"})
  """
  @spec check_community_create_in_transaction(term(), term()) ::
          {:ok, term()} | {:error, GroupherServer.CMS.Gate.Decision.t()}
  def check_community_create_in_transaction(actor, target) do
    Access.check_community_create_in_transaction(actor, target)
  end

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
  def with_check(actor, action, resource, callback) do
    Access.with_check(actor, action, resource, callback)
  end

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
  def with_community_check(actor, action, community, callback) do
    Access.with_community_check(actor, action, community, callback)
  end

  @doc """
  Runs Community Application admission inside its canonical row lock.

  ## Examples

      CMS.Gate.with_application_check(actor, :review, application, fn canonical ->
        {:ok, canonical}
      end)
  """
  @spec with_application_check(term(), atom(), struct(), (struct() ->
                                                            {:ok, term()} | {:error, term()})) ::
          {:ok, term()} | {:error, term()}
  def with_application_check(actor, action, application, callback) do
    Access.with_application_check(actor, action, application, callback)
  end

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
  def with_community_check(actor, action, community, article, callback) do
    Access.with_community_check(actor, action, community, article, callback)
  end

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
  def with_branch_check(actor, action, community, article, branch_id, callback) do
    Access.with_branch_check(actor, action, community, article, branch_id, callback)
  end
end
