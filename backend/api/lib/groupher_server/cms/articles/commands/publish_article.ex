defmodule GroupherServer.CMS.Articles.Commands.PublishArticle do
  @moduledoc """
  Publishes one saved WorkingCopy revision or selects an existing immutable Snapshot.

      publishArticle -> Gate / expected Public head -> freeze if WorkingCopy source
        -> publishability check -> Public selection -> Receipt confirmation
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Articles.Commands.PublishArticleConfirmation, as: Confirmation
  alias CMS.Articles.WorkingCopy.Access, as: WorkingCopyAccess
  alias CMS.Articles.WorkingCopy.Publisher
  alias CMS.Model.{Article, ArticlePublic, ArticleSnapshot, Community}

  @pipeline operation: :article_publish_article,
            confirmation: Confirmation,
            target: :article,
            params: [:source, :expected_public_snapshot_id]

  receipt_pipeline run_receipt(
                     article,
                     source,
                     expected_public_snapshot_id,
                     community,
                     actor,
                     command_id
                   ) do
    gate(fn _article ->
      WorkingCopyAccess.check_in_transaction(actor, :publish, article, community)
    end)

    change(fn canonical_article ->
      with {:ok, :pass} <- WorkingCopyAccess.generic_snapshot_mutation(canonical_article) do
        case Publisher.publish_in_transaction(
               canonical_article,
               community,
               source,
               expected_public_snapshot_id,
               actor,
               command_id
             ) do
          {:error, :revision_conflict} ->
            {:error, CMS.ErrorCat.article_working_copy_revision_conflict()}

          result ->
            result
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

  def execute(
        %Article{} = article,
        %Community{} = community,
        source,
        expected_public_snapshot_id,
        %User{} = actor,
        command_id
      )
      when is_map(source) and is_binary(command_id) do
    with {:ok, _binding} <- CMS.Articles.Bindings.get(article, community),
         {:ok, :pass} <- WorkingCopyAccess.generic_snapshot_mutation(article) do
      run_receipt(
        article,
        source,
        expected_public_snapshot_id,
        community,
        actor,
        command_id
      )
    end
  end

  def execute(_article, _community, _source, _expected, _actor, _command_id),
    do: {:error, :invalid_publish_command}

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
