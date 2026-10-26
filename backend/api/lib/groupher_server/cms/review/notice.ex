defmodule GroupherServer.CMS.Review.Notice do
  @moduledoc """
  Gives a content author the current review state without exposing review rules or evidence.

      author + CMS target -> active review blocks/current checks -> status notice
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    Article,
    ArticleReviewBlock,
    ArtimentReview,
    Author,
    Comment,
    CommentReviewBlock,
    DocReviewBlock
  }

  @doc "Returns only the state that the target's author may see."
  def for_author(%{type: type} = target, %{id: user_id}) when is_integer(user_id) do
    with {:ok, block_schema, target_field, target_id, community_id, branch_id} <-
           target_query(target),
         {:ok, :pass} <- authorize_author(type, target, user_id) do
      blocks =
        block_schema
        |> where([block], field(block, ^target_field) == ^target_id and is_nil(block.resolved_at))
        |> block_scope(type, community_id)
        |> branch(branch_id)
        |> Repo.all()

      requests =
        ArtimentReview
        |> where(
          [request],
          field(request, ^target_field) == ^target_id and is_nil(request.replaced_at)
        )
        |> scope(community_id)
        |> branch(branch_id)
        |> Repo.all()

      {:ok, status(blocks, requests)}
    end
  end

  def for_author(_target, _actor), do: {:error, CMS.Passport.ErrorCat.permission_denied()}

  defp target_query(%{type: :article, article_id: id, community_id: community_id})
       when is_binary(id), do: {:ok, ArticleReviewBlock, :article_id, id, community_id, nil}

  defp target_query(%{type: :comment, comment_id: id, community_id: community_id})
       when is_integer(id), do: {:ok, CommentReviewBlock, :comment_id, id, community_id, nil}

  defp target_query(%{type: :doc, article_id: id, branch_id: branch_id})
       when is_binary(id) and is_integer(branch_id),
       do: {:ok, DocReviewBlock, :article_id, id, nil, branch_id}

  defp target_query(_target), do: {:error, CMS.ErrorCat.invalid_review_block()}

  defp authorize_author(:comment, %{comment_id: id}, user_id) do
    case Repo.get(Comment, id) do
      %Comment{author_id: ^user_id} -> {:ok, :pass}
      _ -> {:error, CMS.Passport.ErrorCat.permission_denied()}
    end
  end

  defp authorize_author(type, %{article_id: id}, user_id) when type in [:article, :doc] do
    case Repo.one(
           from(article in Article,
             join: author in Author,
             on: author.id == article.author_id,
             where: article.id == ^id and author.user_id == ^user_id,
             select: article.id
           )
         ) do
      ^id -> {:ok, :pass}
      _ -> {:error, CMS.Passport.ErrorCat.permission_denied()}
    end
  end

  defp scope(query, nil), do: where(query, [row], is_nil(row.community_id))

  defp scope(query, community_id) do
    where(query, [row], is_nil(row.community_id) or row.community_id == ^community_id)
  end

  defp block_scope(query, :doc, _community_id), do: query
  defp block_scope(query, _type, community_id), do: scope(query, community_id)

  defp branch(query, nil), do: query
  defp branch(query, branch_id), do: where(query, [row], row.branch_id == ^branch_id)

  defp status(blocks, requests) do
    types = Enum.map(blocks, & &1.type)
    failed = Enum.find(requests, &(&1.state == :failed))

    cond do
      :manual_hold in types ->
        %{status: "restricted", failure_code: nil}

      :ai_suspect in types or :awaiting_human in types ->
        %{status: "waiting_human", failure_code: nil}

      failed ->
        %{status: "failed", failure_code: failure_code(failed)}

      :awaiting_ai in types or Enum.any?(requests, &(&1.state in [:queued, :running])) ->
        %{status: "checking", failure_code: nil}

      true ->
        nil
    end
  end

  defp failure_code(request) do
    Map.get(request.result || %{}, "code") || Map.get(request.result || %{}, "error")
  end
end
