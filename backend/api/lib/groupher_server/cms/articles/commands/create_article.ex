defmodule GroupherServer.CMS.Articles.Commands.CreateArticle do
  @moduledoc """
  Creates the stable Article identity and its default editable WorkingCopy atomically.

      createArticle -> Community Gate -> Article / Binding / Lifecycle -> default WorkingCopy
        -> Receipt confirmation
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Articles.Commands.CreateArticleConfirmation, as: Confirmation
  alias CMS.Articles.Tags.Assignment
  alias CMS.Articles.WorkingCopy.Access, as: WorkingCopyAccess
  alias CMS.Articles.WorkingCopy.Store
  alias CMS.Model.{ArticleWorkingCopy, Community}

  @pipeline operation: :article_create_article,
            confirmation: Confirmation,
            target: :command_target,
            params: :command_params
  receipt_pipeline run_receipt(
                     community,
                     thread,
                     attrs,
                     actor,
                     opts,
                     command_id,
                     command_target,
                     command_params
                   ) do
    gate(fn _target -> CMS.Gate.check_in_transaction(actor, :create_article, community) end)

    change(fn canonical_community ->
      create_in_transaction(canonical_community, thread, attrs, actor, command_id)
    end)

    confirm(fn %{article: article, working_copy: working_copy} ->
      {:ok,
       %Confirmation{
         data: %{
           "article_id" => article.id,
           "working_copy_id" => working_copy.id,
           "command_id" => command_id
         }
       }}
    end)

    present(fn confirmation -> present_confirmation(confirmation, community, actor) end)
  end

  @doc "Creates a default WorkingCopy using one retry-safe user command."
  def execute(%Community{} = community, thread, attrs, %User{} = actor, opts)
      when is_map(attrs) and is_list(opts) and thread in [:post, :blog, :changelog] do
    command_id = Keyword.fetch!(opts, :command_id)

    attrs =
      Map.drop(attrs, [
        :article_id,
        "article_id",
        :author,
        "author",
        :community,
        "community",
        :communities,
        "communities",
        :community_id,
        "community_id"
      ])

    run_receipt(
      community,
      thread,
      attrs,
      actor,
      opts,
      command_id,
      {:article_working_copy, community.id},
      %{thread: thread, attrs: attrs}
    )
  end

  def execute(_community, thread, _attrs, %User{}, _opts) when thread == :doc,
    do: {:error, :unsupported_article_thread}

  def execute(_community, _thread, _attrs, _actor, _opts), do: {:error, :invalid_actor}

  defp create_in_transaction(community, thread, attrs, actor, command_id) do
    with {:ok, author} <- CMS.Articles.Persist.ensure_author_exists(actor),
         {:ok, article} <-
           CMS.Articles.Draft.Store.create_article_shell_loaded(
             community,
             thread,
             attrs,
             author,
             []
           ),
         work_attrs =
           attrs
           |> Map.merge(%{scope_kind: :default, scope_id: article.id}),
         {:ok, working_copy} <- Store.create_loaded(article, work_attrs, actor, community.id),
         {:ok, _binding_tags} <- sync_community_tags(community, article, attrs, command_id) do
      {:ok, %{article: article, working_copy: working_copy}}
    end
  end

  defp sync_community_tags(community, article, attrs, command_id) do
    case fetch(attrs, :community_tags) do
      :missing ->
        {:ok, :unchanged}

      {:present, tag_ids} ->
        Assignment.overwrite(
          community,
          article.thread,
          article,
          %{community_tags: tag_ids || []},
          identity: {:command, command_id}
        )
    end
  end

  defp fetch(attrs, key) do
    string_key = Atom.to_string(key)

    cond do
      Map.has_key?(attrs, key) -> {:present, Map.get(attrs, key)}
      Map.has_key?(attrs, string_key) -> {:present, Map.get(attrs, string_key)}
      true -> :missing
    end
  end

  defp present_confirmation(
         %Confirmation{
           data: %{"article_id" => article_id, "working_copy_id" => working_copy_id}
         },
         community,
         actor
       ) do
    with {:ok, article} <- CMS.FrontDesk.article(article_id, mode: :internal),
         {:ok, article} <- WorkingCopyAccess.access_check(actor, :edit, article, community),
         %ArticleWorkingCopy{article_id: ^article_id} = working_copy <-
           Repo.get(ArticleWorkingCopy, working_copy_id) do
      {:ok, %{article: article, working_copy: working_copy}}
    else
      {:error, _reason} -> {:error, CMS.ErrorCat.command_result_unavailable()}
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp present_confirmation(_confirmation, _community, _actor),
    do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
