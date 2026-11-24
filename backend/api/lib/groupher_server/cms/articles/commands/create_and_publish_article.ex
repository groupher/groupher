defmodule GroupherServer.CMS.Articles.Commands.CreateAndPublishArticle do
  @moduledoc """
  Creates and publishes an Article within one authenticated command and Receipt transaction.

      createAndPublishArticle -> Gate / publish admission -> Article + WorkingCopy
        -> saved content -> immutable Snapshot -> Public selection -> Receipt confirmation
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{CMS, Repo, Accounts}
  alias Accounts.Model.User
  alias CMS.Articles.Commands.CreateAndPublishArticleConfirmation, as: Confirmation
  alias CMS.Articles.Tags.Assignment
  alias CMS.Articles.WorkingCopy.{History, Publisher, Store}
  alias CMS.Model.{ArticleSnapshot, ArticleWorkingCopy, Community}

  @pipeline operation: :article_create_and_publish_article,
            confirmation: Confirmation,
            target: :command_target,
            params: :command_params

  receipt_pipeline run_receipt(
                     community,
                     thread,
                     attrs,
                     actor,
                     command_id,
                     history_context,
                     check_publish_admission?,
                     command_target,
                     command_params
                   ) do
    gate(fn _target -> CMS.Gate.check_in_transaction(actor, :create_article, community) end)

    change(fn canonical_community, operation_ref ->
      history_context = Map.put(history_context, :causation_command_id, command_id)

      if check_publish_admission? do
        with {:ok, _publish_admission} <-
               CMS.Gate.RateLimit.Publish.check_in_transaction(actor) do
          create_and_publish(
            canonical_community,
            thread,
            attrs,
            actor,
            operation_ref,
            history_context
          )
        end
      else
        create_and_publish(
          canonical_community,
          thread,
          attrs,
          actor,
          operation_ref,
          history_context
        )
      end
    end)

    confirm(fn result ->
      {:ok,
       %Confirmation{
         data: %{
           "article_id" => result.article.id,
           "working_copy_id" => result.working_copy.id,
           "snapshot_id" => result.snapshot.id,
           "command_id" => command_id
         }
       }}
    end)

    present(fn confirmation -> present_confirmation(confirmation) end)
  end

  @doc "Creates and publishes an ordinary Article as one Gate-authorized, retry-safe command."
  def execute(%Community{} = community, thread, attrs, %User{} = actor, opts)
      when is_map(attrs) and is_list(opts) and thread in [:post, :blog, :changelog] do
    command_id = Keyword.fetch!(opts, :command_id)
    check_publish_admission? = Keyword.get(opts, :check_publish_admission?, true)
    history_context = Keyword.get(opts, :history_context, %{source: :browser, service_ref: nil})

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
      command_id,
      history_context,
      check_publish_admission?,
      {:article_create_and_publish_article, community.id},
      %{thread: thread, attrs: attrs, history_context: history_context}
    )
  end

  def execute(_community, _thread, _attrs, _actor, _opts) do
    {:error, :invalid_create_publish_command}
  end

  defp create_and_publish(community, thread, attrs, actor, operation_ref, history_context) do
    with {:ok, author} <- CMS.Articles.Persist.ensure_author_exists(actor),
         {:ok, article} <-
           CMS.Articles.Identity.create_loaded(
             community,
             thread,
             attrs,
             author
           ),
         work_attrs <- Map.merge(attrs, %{scope_type: :default, scope_id: article.id}),
         {:ok, work} <- Store.create_loaded(article, work_attrs, actor, community.id),
         event_attrs = History.event_attrs(actor, operation_ref, community.id, history_context, 0),
         {:ok, _created} <-
           History.record_initial_in_transaction(
             article,
             work,
             actor,
             operation_ref,
             Map.put(event_attrs, :type, :create)
           ),
         {:ok, published} <-
           Publisher.publish_in_transaction(
             article,
             community,
             %{working_copy_id: work.id, revision: work.revision},
             nil,
             actor,
             operation_ref,
             history_context.causation_command_id
           ),
         {:ok, _published_event} <-
           History.record_publish_in_transaction(
             article,
             nil,
             published.snapshot.id,
             actor,
             operation_ref,
             %{event_attrs | operation_index: 1}
           ),
         {:ok, _binding_tags} <- sync_community_tags(community, article, attrs, operation_ref) do
      {:ok, Map.put(published, :working_copy, work)}
    end
  end

  defp sync_community_tags(community, article, attrs, operation_ref) do
    case fetch(attrs, :community_tags) do
      :missing ->
        {:ok, :unchanged}

      {:present, tag_ids} ->
        Assignment.overwrite(
          community,
          article.thread,
          article,
          %{community_tags: tag_ids || []},
          operation_ref: operation_ref
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

  defp present_confirmation(%Confirmation{
         data: %{
           "article_id" => article_id,
           "working_copy_id" => working_copy_id,
           "snapshot_id" => snapshot_id
         }
       }) do
    with {:ok, article} <- CMS.FrontDesk.article(article_id, mode: :internal),
         %ArticleWorkingCopy{} = work <- Repo.get(ArticleWorkingCopy, working_copy_id),
         true <- work.article_id == article.id,
         %ArticleSnapshot{} = snapshot <- Repo.get(ArticleSnapshot, snapshot_id),
         {:ok, public} <- CMS.Articles.Public.get(article) do
      if public.snapshot_id == snapshot_id do
        {:ok, %{article: article, working_copy: work, snapshot: snapshot, public: public}}
      else
        {:error, CMS.ErrorCat.command_result_unavailable()}
      end
    else
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp present_confirmation(_), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
