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
  alias CMS.Command
  alias CMS.Model.{Article, Community}
  alias Helper.T

  @doc "Creates and publishes one stable Article under an idempotent command id."
  @spec create(Community.t(), T.thread(), map(), User.t(), keyword() | map()) ::
          {:ok, map()} | {:error, term()}
  def create(%Community{} = community, thread, attrs, %User{} = user, opts) do
    with {:ok, command_id} <- Command.resolve_command_id(option(opts, :command_id)) do
      attrs = drop_command_id(attrs)

      Command.create_user(user, command_id,
        command: :article_create,
        resource: :article,
        owner: community,
        input: %{thread: thread, attrs: attrs},
        recovery: fn receipt -> recover_public(receipt, community) end
      )
      |> Command.run(fn %{input: %{thread: command_thread, attrs: command_attrs}} ->
        with {:ok, public} <- create_and_publish(community, command_thread, command_attrs, user) do
          {:ok, public, %{result_key: public.article_id}}
        end
      end)
    end
  end

  defp create_and_publish(community, :doc, attrs, user) do
    with {:ok, branch} <- CMS.Docs.Branch.resolve(community, []),
         {:ok, %{article: article, draft: draft}} <-
           CMS.Articles.create_stable_draft(community, :doc, attrs, user, branch_id: branch.id),
         :ok <- sync_community_tags(community, article, attrs),
         {:ok, _published} <-
           CMS.Docs.publish_branch(article.id, branch.id, user,
             expected_draft_version: draft.version,
             expected_lifecycle_version: 1
           ),
         %Article{} = published <- Repo.get(Article, article.id),
         {:ok, public} <- public_projection(published, community),
         {:ok, _activity} <- Activity.log(public, :created, actor: user),
         {:ok, _community} <- CMS.Communities.update_count_field(community, :doc),
         {:ok, _user} <- Accounts.Publish.update_states(user, :doc) do
      {:ok, _throttle} = CMS.Gate.RateLimit.Publish.record(user)
      {:ok, public}
    end
  end

  defp create_and_publish(community, thread, attrs, user) do
    with {:ok, %{article: article, draft: draft}} <-
           CMS.Articles.create_stable_draft(community, thread, attrs, user),
         publish_opts =
           [expected_draft_version: draft.version, expected_lifecycle_version: 1] ++
             community_tag_opts(attrs),
         {:ok, %{article: published}} <-
           CMS.Articles.publish(article.id, user, publish_opts),
         {:ok, public} <- public_projection(published, community),
         {:ok, _activity} <- Activity.log(public, :created, actor: user) do
      {:ok, public}
    end
  end

  defp recover_public(%{result_key: article_id}, community) when is_binary(article_id) do
    case Repo.get(Article, article_id) do
      %Article{} = article ->
        case public_projection(article, community) do
          {:ok, public} ->
            {:ok, public}

          {:error, _reason} ->
            {:ok,
             %{
               id: article.id,
               article_id: article.id,
               inner_id: article.inner_id,
               thread: article.thread,
               stage: :unavailable
             }}
        end

      nil ->
        {:error, CMS.ErrorCat.command_id_conflict()}
    end
  end

  defp recover_public(_receipt, _community),
    do: {:error, CMS.ErrorCat.command_id_conflict()}

  defp public_projection(%Article{inner_id: inner_id, thread: thread}, community)
       when is_integer(inner_id) do
    CMS.FrontDesk.article(%{
      community: community.slug,
      thread: thread,
      inner_id: inner_id
    })
  end

  defp public_projection(_article, _community),
    do: {:error, CMS.Articles.ErrorCat.projection_not_updated()}

  defp sync_community_tags(community, article, attrs) do
    tag_ids = Map.get(attrs, :community_tags) || Map.get(attrs, "community_tags") || []

    case CMS.Communities.overwrite_tags(community, article.thread, article, %{
           community_tags: tag_ids
         }) do
      {:ok, _article} -> :ok
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
