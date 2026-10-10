defmodule GroupherServer.CMS.Articles.Commands.Create do
  @moduledoc """
  Creates and immediately publishes one stable Article through the command boundary.

      CMS.Articles
        -> CMS.Command receipt
        -> stable Draft creation
        -> Article or Doc publish
        -> FrontDesk public projection

  Command recovery stores only the stable Article UUID and reconstructs the same
  canonical public result; it never guesses an old Draft/Public physical row.
  """

  alias GroupherServer.{Accounts, Activity, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.{Articles, Communities, Command, Docs}
  alias CMS.Articles.Tags.Assignment
  alias CMS.FrontDesk
  alias CMS.Model.{Article, ArticleBinding, Community}
  alias CMS.Articles.RevisionResult
  alias CMS.Articles.Commands.RevisionConfirmation, as: Confirmation
  alias Helper.T

  @doc "Creates and publishes one stable Article under an idempotent command id."
  @spec execute(Community.t(), T.thread(), map(), User.t(), keyword() | map()) ::
          {:ok, map()} | {:error, term()}
  def execute(%Community{} = community, thread, attrs, %User{} = user, opts) do
    attrs = attrs |> drop_command_id() |> Map.drop([:author, :community, :communities])

    case option(opts, :command_id) do
      nil ->
        with {:ok, public} <- create_and_publish(community, thread, attrs, user, nil),
             {:ok, confirmation} <- confirmation_from_public(public, community, nil) do
          RevisionResult.build(confirmation, community)
        end

      command_id ->
        command = %Command{
          actor: user,
          command_id: command_id,
          operation: :article_create,
          target: {:article, community.id},
          params: %{thread: thread, attrs: attrs}
        }

        with {:ok, %Confirmation{} = confirmation} <-
               Command.execute(
                 command,
                 action: &create_action(&1, community, user),
                 confirmation: Confirmation
               ) do
          RevisionResult.build(confirmation, community)
        end
    end
  end

  defp create_action(
         %{command_id: command_id, params: %{thread: thread, attrs: attrs}},
         community,
         user
       ) do
    with {:ok, public} <- create_and_publish(community, thread, attrs, user, command_id) do
      confirmation_from_public(public, community, command_id)
    end
  end

  defp confirmation_from_public(public, community, command_id) do
    with {:ok, %Article{} = article} <- FrontDesk.article(public.article_id, mode: :internal),
         %ArticleBinding{inner_id: inner_id} when is_integer(inner_id) <-
           Repo.get_by(ArticleBinding, article_id: article.id, community_id: community.id),
         published_at when is_struct(published_at, DateTime) <- Map.get(public, :inserted_at),
         publication_version when is_integer(publication_version) <-
           Map.get(public, :publication_version, Map.get(public, :version, 1)) do
      {:ok,
       %Confirmation{
         article_id: article.id,
         revision_id: public.revision_id,
         community_id: community.id,
         author_id: article.author_id,
         inner_id: inner_id,
         thread: article.thread,
         publication_version: publication_version,
         published_at: published_at,
         command_id: command_id
       }}
    else
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp create_and_publish(community, :doc, attrs, user, command_id) do
    with {:ok, branch} <- CMS.Docs.Branch.resolve(community, []),
         {:ok, %{article: article, draft: draft}} <-
           Articles.create_stable_draft(community, :doc, attrs, user, branch_id: branch.id),
         {:ok, _} <-
           Repo.transact(fn -> sync_community_tags(community, article, attrs, command_id) end),
         {:ok, _published} <-
           Docs.publish_branch(article.id, branch.id, user,
             expected_draft_version: draft.version,
             expected_lifecycle_version: 1,
             community: community,
             causation_id: command_id
           ),
         {:ok, %Article{} = published} <- FrontDesk.article(article.id, mode: :internal),
         {:ok, public} <- public_projection(published, community),
         {:ok, _activity} <-
           Activity.log(Map.put(public, :community_id, community.id), :created, actor: user),
         {:ok, _community} <- Communities.update_count_field(community, :doc),
         {:ok, _user} <- Accounts.Publish.update_states(user, :doc) do
      {:ok, _throttle} = CMS.Gate.RateLimit.Publish.record(user)
      {:ok, public}
    end
  end

  defp create_and_publish(community, thread, attrs, user, command_id) do
    with {:ok, %{article: article, draft: draft}} <-
           Articles.create_stable_draft(community, thread, attrs, user),
         publish_opts =
           [
             expected_draft_version: draft.version,
             expected_lifecycle_version: 1,
             community: community,
             outbox_command_id: command_id,
             outbox_workflow_ref: "article-create:#{community.id}:#{article.id}"
           ] ++
             community_tag_opts(attrs),
         {:ok, %{article: published}} <-
           Articles.publish(article.id, user, publish_opts),
         {:ok, public} <- public_projection(published, community),
         {:ok, _activity} <-
           Activity.log(Map.put(public, :community_id, community.id), :created, actor: user) do
      {:ok, public}
    end
  end

  defp public_projection(%Article{thread: thread, id: article_id}, community) do
    case Repo.get_by(ArticleBinding, article_id: article_id, community_id: community.id) do
      %ArticleBinding{inner_id: inner_id} when is_integer(inner_id) ->
        FrontDesk.article(%{
          community: community.slug,
          thread: thread,
          inner_id: inner_id
        })

      _ ->
        {:error, CMS.Articles.ErrorCat.projection_not_updated()}
    end
  end

  defp sync_community_tags(community, article, attrs, command_id) do
    tag_ids = Map.get(attrs, :community_tags) || Map.get(attrs, "community_tags") || []

    identity =
      case Ecto.UUID.cast(command_id) do
        {:ok, command_id} -> {:command, command_id}
        :error -> {:workflow, "article-create:#{community.id}:#{article.id}"}
      end

    case Assignment.overwrite(
           community,
           article.thread,
           article,
           %{
             community_tags: tag_ids
           },
           identity: identity
         ) do
      {:ok, _article} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end

  defp community_tag_opts(attrs) do
    cond do
      Map.has_key?(attrs, :community_tags) ->
        [community_tags: Map.get(attrs, :community_tags) || []]

      Map.has_key?(attrs, "community_tags") ->
        [community_tags: Map.get(attrs, "community_tags") || []]

      true ->
        []
    end
  end

  defp drop_command_id(opts) when is_list(opts), do: Keyword.delete(opts, :command_id)
  defp drop_command_id(opts) when is_map(opts), do: Map.delete(opts, :command_id)
  defp drop_command_id(opts), do: opts

  defp option(opts, key) when is_map(opts), do: Map.get(opts, key)
  defp option(opts, key) when is_list(opts), do: Keyword.get(opts, key)
  defp option(_opts, _key), do: nil
end
