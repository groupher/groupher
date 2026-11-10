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

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.{Articles, Communities, Docs}
  alias CMS.Articles.{Bindings, Effects, RevisionResult, Tags.Assignment}
  alias CMS.FrontDesk
  alias CMS.Model.{Article, ArticleBinding, Community}
  alias CMS.Articles.Commands.RevisionConfirmation, as: Confirmation
  alias Helper.T

  @pipeline operation: :article_create,
            confirmation: Confirmation,
            target: :command_target,
            params: :command_params
  receipt_pipeline run_receipt(
                     community,
                     thread,
                     attrs,
                     user,
                     opts,
                     command_id,
                     command_target,
                     command_params
                   ) do
    gate(fn _target -> CMS.Gate.check_in_transaction(user, :create_article, community) end)

    change(fn canonical_community ->
      create_and_publish(canonical_community, thread, attrs, user, command_id)
    end)

    confirm(fn public ->
      confirmation_from_public(public, community, command_id)
    end)

    present(fn confirmation -> RevisionResult.build(confirmation, community) end)
  end

  @doc "Creates and publishes one stable Article under an idempotent command id."
  @spec execute(Community.t(), T.thread(), map(), User.t(), keyword() | map()) ::
          {:ok, map()} | {:error, term()}
  def execute(%Community{} = community, :doc, attrs, %User{} = user, opts) do
    attrs = attrs |> drop_command_id() |> Map.drop([:author, :community, :communities])

    run_receipt(
      community,
      :doc,
      attrs,
      user,
      opts,
      option(opts, :command_id),
      {:article, community.id},
      %{thread: :doc, attrs: attrs}
    )
  end

  def execute(_community, _thread, _attrs, _user, _opts),
    do: {:error, :unsupported_article_thread}

  defp confirmation_from_public(public, community, command_id) do
    with {:ok, %Article{} = article} <- FrontDesk.article(public.article_id, mode: :internal),
         {:ok, %ArticleBinding{inner_id: inner_id}} when is_integer(inner_id) <-
           Bindings.fetch_binding(article.id, community.id),
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
           Articles.Commands.CreateStableDraft.create_in_transaction(
             community,
             :doc,
             attrs,
             user,
             branch_id: branch.id
           ),
         {:ok, _} <- sync_community_tags(community, article, attrs, command_id),
         {:ok, _published} <-
           Docs.Commands.PublishBranch.publish_after_gate(article.id, branch.id, user,
             expected_draft_version: draft.version,
             expected_lifecycle_version: 1,
             community: community,
             causation_id: command_id
           ),
         {:ok, %Article{} = published} <- FrontDesk.article(article.id, mode: :internal),
         {:ok, public} <- public_projection(published, community),
         {:ok, _activity} <-
           Effects.activity(Map.put(public, :community_id, community.id), :created, actor: user),
         {:ok, _community} <- Communities.update_count_field(community, :doc),
         {:ok, updated_user} <- Accounts.publish_update_states(user, :doc),
         {:ok, :pass} <- Accounts.publish_revalidate_user(updated_user) do
      {:ok, _throttle} = CMS.Gate.RateLimit.Publish.record(user)
      {:ok, public}
    end
  end

  defp public_projection(%Article{thread: thread, id: article_id}, community) do
    case Bindings.fetch_binding(article_id, community.id) do
      {:ok, %ArticleBinding{inner_id: inner_id}} when is_integer(inner_id) ->
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

  defp drop_command_id(opts) when is_list(opts), do: Keyword.delete(opts, :command_id)
  defp drop_command_id(opts) when is_map(opts), do: Map.delete(opts, :command_id)
  defp drop_command_id(opts), do: opts

  defp option(opts, key) when is_map(opts), do: Map.get(opts, key)
  defp option(opts, key) when is_list(opts), do: Keyword.get(opts, key)
  defp option(_opts, _key), do: nil
end
