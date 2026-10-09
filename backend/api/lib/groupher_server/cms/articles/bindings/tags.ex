defmodule GroupherServer.CMS.Articles.Bindings.Tags do
  @moduledoc """
  Owns Community-local tags attached to one explicit ArticleBinding.

      ArticleBinding command/query
        -> Bindings.Tags
        -> ArticleBindingTag assignments
        -> CommunityTag results
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{ArticleBinding, ArticleBindingTag, CommunityTag}

  @doc "Lists tags assigned to one ArticleBinding."
  @spec list(ArticleBinding.t()) :: {:ok, [CommunityTag.t()]} | {:error, term()}
  def list(%ArticleBinding{id: binding_id}) when is_integer(binding_id) do
    tags =
      CommunityTag
      |> join(:inner, [tag], assignment in ArticleBindingTag, on: assignment.tag_id == tag.id)
      |> where([_tag, assignment], assignment.article_binding_id == ^binding_id)
      |> order_by([tag, _assignment], asc: tag.id)
      |> Repo.all()

    {:ok, tags}
  end

  @doc "Replaces tags attached to one ArticleBinding inside an existing owner transaction."
  @spec replace(ArticleBinding.t(), [pos_integer() | String.t()]) ::
          {:ok, ArticleBinding.t()} | {:error, term()}
  def replace(%ArticleBinding{} = binding, tag_ids) when is_list(tag_ids) do
    if Repo.in_transaction?() do
      with {:ok, normalized_ids} <- normalize_tag_ids(tag_ids),
           {:ok, valid_ids} <- validate_tag_ids(binding, normalized_ids) do
        Repo.delete_all(
          from(tag in ArticleBindingTag, where: tag.article_binding_id == ^binding.id)
        )

        Enum.each(valid_ids, fn tag_id ->
          %ArticleBindingTag{}
          |> ArticleBindingTag.changeset(%{
            article_binding_id: binding.id,
            tag_id: tag_id
          })
          |> Repo.insert!()
        end)

        {:ok, binding}
      end
    else
      {:error, :article_binding_transaction_required}
    end
  end

  def replace(%ArticleBinding{}, _tag_ids), do: {:error, :invalid_community_tags}

  defp validate_tag_ids(binding, normalized_ids) do
    valid_ids =
      CommunityTag
      |> where([tag], tag.id in ^normalized_ids and tag.community_id == ^binding.community_id)
      |> select([tag], tag.id)
      |> Repo.all()

    if Enum.sort(valid_ids) == Enum.sort(normalized_ids) do
      {:ok, valid_ids}
    else
      {:error, :invalid_community_tags}
    end
  end

  defp normalize_tag_ids(tag_ids) do
    Enum.reduce_while(tag_ids, [], fn
      id, acc when is_integer(id) and id > 0 ->
        {:cont, [id | acc]}

      id, acc when is_binary(id) ->
        case Integer.parse(id) do
          {parsed, ""} when parsed > 0 -> {:cont, [parsed | acc]}
          _ -> {:halt, :error}
        end

      _id, _acc ->
        {:halt, :error}
    end)
    |> case do
      :error -> {:error, :invalid_community_tags}
      ids -> {:ok, ids |> Enum.uniq() |> Enum.reverse()}
    end
  end
end
