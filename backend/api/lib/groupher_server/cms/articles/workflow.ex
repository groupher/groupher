defmodule GroupherServer.CMS.Articles.Workflow do
  @moduledoc """
  Publish-adjacent helpers that do not own Article content lifecycle.

  Draft/Publish own content writes. Trash owns soft deletion, restore and
  permanent deletion; this module only owns the bounded multi-step publish
  transaction and first-publish finalization.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Articles.Workflow (multi-step publish transaction)
        -> Repo / domain event
  """

  alias GroupherServer.{CMS, Repo, Accounts}
  alias Accounts.Model.User

  alias CMS.Model.{
    Article,
    Author,
    ArticlePublic,
    ArticleWorkingCopy,
    Community
  }

  alias CMS.Articles.WorkingCopy.Publisher
  alias Helper.ORM

  @doc "Runs an Article workflow in the current transaction or opens one."
  def transaction(fun) when is_function(fun, 0) do
    if Repo.in_transaction?() do
      {:ok, fun.()}
    else
      Repo.transaction(fun)
    end
  end

  @doc "Publishes one Gate-authorized Article and commits all first-publish side effects atomically."
  def publish(%Article{} = article, %Author{} = author, actor, opts) do
    with %User{} = user <- publish_user(actor, author),
         {:ok, %Community{} = community} <- publish_community(article, opts),
         {:ok, source} <- publish_source(article, opts),
         current_public <- Repo.get(ArticlePublic, article.id),
         expected_public_snapshot_id <-
           Keyword.get(
             opts,
             :expected_public_snapshot_id,
             current_public && current_public.snapshot_id
           ),
         command_id <- publish_command_id(opts) do
      result =
        transaction(fn ->
          Publisher.publish_in_transaction(
            article,
            community,
            source,
            expected_public_snapshot_id,
            user,
            command_id
          )
        end)

      case result do
        {:ok, {:ok, published}} -> {:ok, published}
        {:ok, {:error, reason}} -> {:error, reason}
        {:error, reason} -> {:error, reason}
      end
    else
      {:error, _reason} = error -> error
      _ -> {:error, :invalid_publish_context}
    end
  end

  defp publish_user(%User{} = user, _author), do: user

  defp publish_user(_actor, %Author{user_id: user_id}) do
    case Repo.get(User, user_id) do
      %User{} = user -> user
      nil -> nil
    end
  end

  defp publish_community(_article, community: %Community{} = community), do: {:ok, community}

  defp publish_community(_article, community_id: community_id) when is_integer(community_id) do
    case CMS.FrontDesk.community(community_id, mode: :internal) do
      {:ok, %Community{} = community} -> {:ok, community}
      {:error, _reason} -> {:error, CMS.Communities.ErrorCat.not_exist()}
    end
  end

  defp publish_community(article, _opts) do
    case Map.get(article, :community) do
      %Community{} = community -> {:ok, community}
      _ -> {:error, :binding_context_required}
    end
  end

  defp publish_source(article, opts) do
    case Keyword.get(opts, :source) do
      %{working_copy_id: _id, revision: _revision} = source ->
        {:ok, source}

      %{snapshot_id: _id} = source ->
        {:ok, source}

      nil ->
        case Repo.get_by(ArticleWorkingCopy,
               article_id: article.id,
               scope_kind: :default,
               scope_id: article.id
             ) do
          %ArticleWorkingCopy{id: id, revision: revision} ->
            {:ok, %{working_copy_id: id, revision: revision}}

          nil ->
            {:error, :working_copy_not_found}
        end

      _ ->
        {:error, :invalid_publish_source}
    end
  end

  defp publish_command_id(opts) do
    Keyword.get(opts, :command_id) || Keyword.get(opts, :outbox_command_id) ||
      Ecto.UUID.generate()
  end

  @doc "Returns or creates the CMS Author row associated with a User."
  @spec ensure_author_exists(User.t()) :: {:ok, Author.t()}
  def ensure_author_exists(%User{} = user) do
    case ORM.find_by(Author, user_id: user.id) do
      {:ok, author} ->
        {:ok, author}

      {:error, _} ->
        %Author{user_id: user.id}
        |> Ecto.Changeset.change()
        |> Ecto.Changeset.unique_constraint(:user_id)
        |> Ecto.Changeset.foreign_key_constraint(:user_id)
        |> Repo.insert()
    end
  end
end
