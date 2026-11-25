defmodule GroupherServer.CMS.Articles.Commands.PublishArticle do
  @moduledoc """
  Publishes one saved WorkingCopy revision or selects an existing immutable Snapshot.

      publishArticle -> Gate / expected Public head -> freeze if WorkingCopy source
        -> publishability check -> Public selection -> Receipt confirmation
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{CMS, Repo, Accounts}
  alias Accounts.Model.User
  alias CMS.Articles.Commands.PublishArticleConfirmation, as: Confirmation
  alias CMS.Articles.WorkingCopy.Access, as: WorkingCopyAccess
  alias CMS.Articles.{Publication, WorkingCopy.History}
  alias CMS.Model.{Article, ArticlePublic, ArticleSnapshot, Community}

  @pipeline operation: :article_publish_article,
            confirmation: Confirmation,
            target: :article,
            params: [:source, :expected_public_snapshot_id, :history_context]

  receipt_pipeline run_receipt(
                     article,
                     source,
                     expected_public_snapshot_id,
                     community,
                     actor,
                     command_id,
                     history_context
                   ) do
    gate(fn _article ->
      WorkingCopyAccess.check_in_transaction(actor, :publish, article, community)
    end)

    change(fn canonical_article, operation_ref ->
      history_context = Map.put(history_context, :causation_command_id, command_id)

      with {:ok, :pass} <- WorkingCopyAccess.generic_snapshot_mutation(canonical_article) do
        case Publication.publish_in_transaction(
               canonical_article,
               community,
               source,
               expected_public_snapshot_id,
               actor,
               operation_ref,
               history_context.causation_command_id
             ) do
          {:error, :revision_conflict} ->
            {:error, CMS.ErrorCat.article_working_copy_revision_conflict()}

          {:ok, result} ->
            event_attrs =
              History.event_attrs(actor, operation_ref, community.id, history_context, 0)

            case History.record_publish_in_transaction(
                   canonical_article,
                   expected_public_snapshot_id,
                   result.snapshot.id,
                   actor,
                   operation_ref,
                   event_attrs
                 ) do
              {:ok, _event} -> {:ok, result}
              {:error, _reason} = error -> error
            end

          {:error, _reason} = error ->
            error
        end
      end
    end)

    confirm(fn result ->
      {:ok,
       %Confirmation{
         data: %{
           "article_id" => result.article.id,
           "snapshot_id" => result.snapshot.id,
           "published_by_id" => actor.id,
           "published_at" => DateTime.to_iso8601(result.public.published_at),
           "command_id" => command_id
         }
       }}
    end)

    present(fn confirmation -> present_confirmation(confirmation) end)
  end

  @doc "Publishes a saved WorkingCopy revision or same-Article Snapshot after Gate and publication admission."
  def execute(
        article,
        community,
        source,
        expected_public_snapshot_id,
        actor,
        command_id,
        history_context \\ %{source: :browser, service_ref: nil}
      )

  def execute(
        %Article{} = article,
        %Community{} = community,
        source,
        expected_public_snapshot_id,
        %User{} = actor,
        command_id,
        %{source: history_source, service_ref: service_ref} = history_context
      )
      when is_map(source) and is_binary(command_id) and
             history_source in [:browser, :import, :system] and
             (is_nil(service_ref) or is_binary(service_ref)) do
    with {:ok, _binding} <- CMS.Articles.Bindings.get(article, community),
         {:ok, :pass} <- WorkingCopyAccess.generic_snapshot_mutation(article) do
      run_receipt(
        article,
        source,
        expected_public_snapshot_id,
        community,
        actor,
        command_id,
        history_context
      )
    end
  end

  def execute(_article, _community, _source, _expected, _actor, _command_id, _history_context) do
    {:error, :invalid_publish_command}
  end

  defp present_confirmation(%Confirmation{
         data: %{
           "article_id" => article_id,
           "snapshot_id" => snapshot_id,
           "published_by_id" => published_by_id,
           "published_at" => published_at
         }
       }) do
    with {:ok, article} <- CMS.FrontDesk.article(article_id, mode: :internal),
         %ArticlePublic{snapshot_id: ^snapshot_id, published_by_id: ^published_by_id} = public <-
           Repo.get(ArticlePublic, article_id),
         %ArticleSnapshot{} = snapshot <- Repo.get(ArticleSnapshot, snapshot_id),
         true <- DateTime.to_iso8601(public.published_at) == published_at do
      {:ok, %{article: article, public: public, snapshot: snapshot}}
    else
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp present_confirmation(_), do: {:error, CMS.ErrorCat.command_result_unavailable()}
end
