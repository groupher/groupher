defmodule GroupherServer.CMS.ReviewBlocks do
  @moduledoc """
  CMS-owned review holds attached to resource IDs and evaluated by Gate.

  Business position:

      CMS resource Lifecycle command
        -> direct target restriction rows
          -> Gate and public projections read active holds
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleLifecycle,
    ArticleReviewBlock,
    Comment,
    CommentLifecycle,
    CommentReviewBlock,
    Community,
    DocBranch,
    DocLifecycle,
    DocReviewBlock
  }

  @public_states [:published, :archived]

  @doc "Adds one direct resource restriction inside the locked CMS resource transaction."
  def apply(lifecycle, attrs) when is_map(attrs) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, schema, target_attrs} <- restriction_target(lifecycle, attrs),
         {:ok, :pass} <- validate_scope(lifecycle, target_attrs),
         attrs <- attrs |> defaults() |> Map.delete(:scope_key) |> Map.merge(target_attrs),
         {:ok, restriction} <- insert_or_get(schema, attrs),
         {:ok, :pass} <- recompute(lifecycle),
         {:ok, _event} <- enqueue_visibility_change(lifecycle, target_attrs, attrs.source_ref) do
      {:ok, restriction}
    end
  end

  def apply(_lifecycle, _attrs), do: {:error, CMS.ErrorCat.invalid_review_block()}

  @doc "Resolves selected restrictions within the locked resource and scope."
  def end_blocks(lifecycle, scope_key, ids, operation_ref, resolution)
      when is_binary(scope_key) and is_list(ids) and is_binary(operation_ref) and
             is_binary(resolution) and resolution != "" do
    with {:ok, :pass} <- require_transaction(),
         {:ok, schema, target_attrs} <- restriction_target(lifecycle, %{scope_key: scope_key}),
         {:ok, restrictions} <- load_active(schema, target_attrs, ids),
         {:ok, :pass} <- resolve_rows(restrictions, operation_ref, resolution),
         {:ok, :pass} <- recompute(lifecycle),
         {:ok, _event} <- enqueue_visibility_change(lifecycle, target_attrs, operation_ref) do
      {:ok, :pass}
    end
  end

  def end_blocks(_lifecycle, _scope_key, _ids, _operation_ref, _resolution) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  @doc "Returns active restrictions for one resource scope."
  def active_for(lifecycle, scope_key) when is_binary(scope_key) do
    with {:ok, :pass} <- require_transaction(),
         {:ok, schema, target_attrs} <- restriction_target(lifecycle, %{scope_key: scope_key}) do
      query = where_target(schema, target_attrs)

      {:ok,
       Repo.all(
         from(restriction in query,
           where: is_nil(restriction.resolved_at),
           order_by: restriction.id,
           lock: "FOR UPDATE"
         )
       )}
    end
  end

  def active_for(_lifecycle, _scope_key), do: {:error, CMS.ErrorCat.invalid_review_block()}

  @doc "Links a CMS AI suspicion to the AlertWall item created for its request."
  def link_item_for_artiment_review_in_transaction(artiment_review_id, item_id)
      when is_binary(artiment_review_id) and is_integer(item_id) do
    with {:ok, :pass} <- require_transaction() do
      {updated, _} =
        Repo.update_all(
          from(restriction in ArticleReviewBlock,
            where:
              restriction.artiment_review_id == ^artiment_review_id and
                restriction.type == :ai_suspect and
                is_nil(restriction.item_id)
          ),
          set: [item_id: item_id]
        )

      {comment_updated, _} =
        Repo.update_all(
          from(restriction in CommentReviewBlock,
            where:
              restriction.artiment_review_id == ^artiment_review_id and
                restriction.type == :ai_suspect and
                is_nil(restriction.item_id)
          ),
          set: [item_id: item_id]
        )

      {doc_updated, _} =
        Repo.update_all(
          from(restriction in DocReviewBlock,
            where:
              restriction.artiment_review_id == ^artiment_review_id and
                restriction.type == :ai_suspect and
                is_nil(restriction.item_id)
          ),
          set: [item_id: item_id]
        )

      if updated + comment_updated + doc_updated > 0 do
        {:ok, :pass}
      else
        {:error, CMS.ErrorCat.review_block_not_found()}
      end
    end
  end

  def link_item_for_artiment_review_in_transaction(_artiment_review_id, _item_id) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  @doc "Recomputes CMS projections after a restriction transition."
  def recompute(%ArticleLifecycle{article_id: article_id}) do
    if Repo.in_transaction?() and Repo.get(Article, article_id) do
      {:ok, :pass}
    else
      {:error, CMS.ErrorCat.lifecycle_not_found()}
    end
  end

  def recompute(%CommentLifecycle{comment_id: comment_id}) do
    with true <- Repo.in_transaction?(),
         %Comment{article_id: article_id} <- Repo.get(Comment, comment_id),
         %Article{} = article <- Repo.get(Article, article_id),
         {:ok, :pass} <- CMS.ArticleStats.record_comment_change(article) do
      {:ok, :pass}
    else
      false -> {:error, CMS.ErrorCat.review_transition_requires_transaction()}
      nil -> {:error, CMS.ErrorCat.lifecycle_not_found()}
      {:error, _reason} = error -> error
    end
  end

  def recompute(%DocLifecycle{} = lifecycle) do
    with {:ok, :pass} <- require_transaction(),
         attrs <- %{article_id: lifecycle.article_id, branch_id: lifecycle.branch_id},
         visible? <- lifecycle.state in @public_states and not active_doc?(attrs),
         {:ok, _result} <-
           Repo.query(
             "UPDATE cms.doc_publics SET visible = $1 WHERE article_id = $2 AND branch_id = $3",
             [visible?, Ecto.UUID.dump!(lifecycle.article_id), lifecycle.branch_id]
           ) do
      {:ok, :pass}
    end
  end

  def recompute(_lifecycle), do: {:error, CMS.ErrorCat.invalid_review_block()}

  defp defaults(attrs) do
    attrs
    |> Map.put_new(:source, :request)
    |> Map.put_new(:applied_at, DateTime.utc_now(:second))
    |> Map.put_new(:version, 1)
  end

  defp restriction_target(%ArticleLifecycle{article_id: id}, attrs) do
    with {:ok, community_id} <- scope_community_id(attrs) do
      {:ok, ArticleReviewBlock, %{article_id: id, community_id: community_id}}
    end
  end

  defp restriction_target(%CommentLifecycle{comment_id: id}, attrs) do
    with {:ok, community_id} <- scope_community_id(attrs) do
      {:ok, CommentReviewBlock, %{comment_id: id, community_id: community_id}}
    end
  end

  defp restriction_target(%DocLifecycle{article_id: article_id, branch_id: branch_id}, %{
         scope_key: "platform"
       }) do
    {:ok, DocReviewBlock, %{article_id: article_id, branch_id: branch_id}}
  end

  defp restriction_target(_lifecycle, _attrs) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  defp scope_community_id(%{community_id: nil}), do: {:ok, nil}
  defp scope_community_id(%{community_id: id}) when is_integer(id) and id > 0, do: {:ok, id}
  defp scope_community_id(%{scope_key: "platform"}), do: {:ok, nil}

  defp scope_community_id(%{scope_key: "community:" <> id}) do
    case Integer.parse(id) do
      {community_id, ""} when community_id > 0 -> {:ok, community_id}
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp scope_community_id(_attrs), do: {:error, CMS.ErrorCat.invalid_review_block()}

  defp validate_scope(%ArticleLifecycle{article_id: article_id}, %{community_id: nil}) do
    if Repo.get(Article, article_id) do
      {:ok, :pass}
    else
      {:error, CMS.ErrorCat.lifecycle_not_found()}
    end
  end

  defp validate_scope(%ArticleLifecycle{article_id: article_id}, %{community_id: community_id}) do
    if Repo.exists?(
         from(binding in ArticleBinding,
           where: binding.article_id == ^article_id and binding.community_id == ^community_id
         )
       ) do
      {:ok, :pass}
    else
      {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp validate_scope(%CommentLifecycle{comment_id: comment_id}, %{community_id: nil}) do
    if Repo.get(Comment, comment_id) do
      {:ok, :pass}
    else
      {:error, CMS.ErrorCat.lifecycle_not_found()}
    end
  end

  defp validate_scope(%CommentLifecycle{comment_id: comment_id}, %{community_id: community_id}) do
    if Repo.exists?(
         from(comment in Comment,
           where: comment.id == ^comment_id and comment.community_id == ^community_id
         )
       ) do
      {:ok, :pass}
    else
      {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp validate_scope(%DocLifecycle{}, _attrs), do: {:ok, :pass}
  defp validate_scope(_lifecycle, _attrs), do: {:error, CMS.ErrorCat.invalid_review_block()}

  defp insert_or_get(ArticleReviewBlock, attrs) do
    insert_or_get_row(
      ArticleReviewBlock.changeset(%ArticleReviewBlock{}, attrs),
      ArticleReviewBlock,
      attrs
    )
  end

  defp insert_or_get(CommentReviewBlock, attrs) do
    insert_or_get_row(
      CommentReviewBlock.changeset(%CommentReviewBlock{}, attrs),
      CommentReviewBlock,
      attrs
    )
  end

  defp insert_or_get(DocReviewBlock, attrs) do
    insert_or_get_row(
      DocReviewBlock.changeset(%DocReviewBlock{}, attrs),
      DocReviewBlock,
      attrs
    )
  end

  defp insert_or_get_row(changeset, schema, attrs) do
    case Repo.insert(changeset, mode: :savepoint) do
      {:ok, row} ->
        {:ok, row}

      {:error, changeset} ->
        case Repo.one(
               where_target(schema, attrs)
               |> where(
                 [restriction],
                 restriction.source_ref == ^attrs.source_ref and is_nil(restriction.resolved_at)
               )
             ) do
          %{type: type, subject_ref: existing_subject_ref} = row ->
            if type == attrs.type and existing_subject_ref == Map.get(attrs, :subject_ref) do
              {:ok, row}
            else
              {:error, CMS.ErrorCat.lifecycle_state_conflict()}
            end

          nil ->
            {:error, changeset}
        end
    end
  end

  defp load_active(schema, attrs, ids) do
    if ids == [] do
      {:ok, []}
    else
      load_active_rows(schema, attrs, ids)
    end
  end

  defp load_active_rows(schema, attrs, ids) do
    rows =
      Repo.all(
        where_target(schema, attrs)
        |> where([restriction], restriction.id in ^ids and is_nil(restriction.resolved_at))
        |> order_by([restriction], asc: restriction.id)
        |> lock("FOR UPDATE")
      )

    if length(rows) == length(Enum.uniq(ids)) do
      {:ok, rows}
    else
      {:error, CMS.ErrorCat.review_block_not_found()}
    end
  end

  defp resolve_rows(rows, operation_ref, resolution) do
    Enum.reduce_while(rows, {:ok, :pass}, fn row, {:ok, :pass} ->
      now = DateTime.utc_now(:second)

      attrs = %{
        resolved_at: now,
        resolved_by_ref: operation_ref,
        resolution: resolution,
        version: row.version + 1
      }

      case update_restriction(row, attrs) do
        {:ok, _updated} -> {:cont, {:ok, :pass}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp update_restriction(%ArticleReviewBlock{} = row, attrs) do
    row |> ArticleReviewBlock.changeset(attrs) |> Repo.update()
  end

  defp update_restriction(%CommentReviewBlock{} = row, attrs) do
    row |> CommentReviewBlock.changeset(attrs) |> Repo.update()
  end

  defp update_restriction(%DocReviewBlock{} = row, attrs) do
    row |> DocReviewBlock.changeset(attrs) |> Repo.update()
  end

  defp where_target(schema, attrs) do
    Enum.reduce(attrs, schema, fn
      {key, nil}, query -> where(query, [restriction], is_nil(field(restriction, ^key)))
      {key, value}, query -> where(query, [restriction], field(restriction, ^key) == ^value)
    end)
  end

  defp active_doc?(%{article_id: article_id, branch_id: branch_id}) do
    Repo.exists?(
      from(restriction in DocReviewBlock,
        where:
          restriction.article_id == ^article_id and restriction.branch_id == ^branch_id and
            is_nil(restriction.resolved_at)
      )
    )
  end

  defp enqueue_visibility_change(
         %DocLifecycle{article_id: article_id, branch_id: branch_id},
         _target,
         key
       ) do
    with %Article{} <- Repo.get(Article, article_id),
         %DocBranch{community_id: community_id} <- Repo.get(DocBranch, branch_id),
         %Community{} = community <- Repo.get(CMS.Model.Community, community_id),
         %ArticleBinding{inner_id: inner_id} <-
           Repo.get_by(ArticleBinding, article_id: article_id, community_id: community_id),
         {:ok, event} <-
           CMS.Articles.Effects.enqueue(
             "article.visibility_changed",
             "article",
             article_id,
             {:workflow, "review:doc:#{article_id}:#{branch_id}"},
             %{
               "community" => community.slug,
               "community_id" => community.id,
               "thread" => "doc",
               "inner_id" => inner_id,
               "branch_id" => branch_id
             },
             effect_key: "review:#{key}"
           ) do
      {:ok, event}
    else
      nil -> {:error, CMS.ErrorCat.lifecycle_not_found()}
      {:error, _reason} = error -> error
    end
  end

  defp enqueue_visibility_change(
         %ArticleLifecycle{article_id: article_id},
         %{community_id: community_id},
         key
       ) do
    enqueue_article_visibility(article_id, community_id, key)
  end

  defp enqueue_visibility_change(
         %CommentLifecycle{comment_id: comment_id},
         %{community_id: community_id},
         key
       ) do
    with %Comment{article_id: article_id} <- Repo.get(Comment, comment_id) do
      enqueue_article_visibility(article_id, community_id, key)
    else
      nil -> {:error, CMS.ErrorCat.lifecycle_not_found()}
    end
  end

  defp enqueue_visibility_change(%_lifecycle{}, _target, _key), do: {:ok, :pass}

  defp enqueue_article_visibility(article_id, community_id, key) do
    with %Article{thread: thread} <- Repo.get(Article, article_id) do
      query = from(binding in ArticleBinding, where: binding.article_id == ^article_id)

      query =
        if is_nil(community_id),
          do: query,
          else: where(query, [binding], binding.community_id == ^community_id)

      query
      |> Repo.all()
      |> Enum.reduce_while({:ok, :pass}, fn binding, {:ok, :pass} ->
        community = Repo.get(Community, binding.community_id)

        case community do
          %Community{} = community ->
            case CMS.Articles.Effects.enqueue(
                   "article.visibility_changed",
                   "article",
                   article_id,
                   {:workflow, "review:#{article_id}:#{community.id}"},
                   %{
                     "community" => community.slug,
                     "community_id" => community.id,
                     "thread" => Atom.to_string(thread),
                     "inner_id" => binding.inner_id
                   },
                   effect_key: "review:#{key}:#{community.id}"
                 ) do
              {:ok, _event} -> {:cont, {:ok, :pass}}
              {:error, reason} -> {:halt, {:error, reason}}
            end

          nil ->
            {:halt, {:error, CMS.ErrorCat.lifecycle_not_found()}}
        end
      end)
    else
      nil -> {:error, CMS.ErrorCat.lifecycle_not_found()}
    end
  end

  defp require_transaction do
    if Repo.in_transaction?() do
      {:ok, :pass}
    else
      {:error, CMS.ErrorCat.review_transition_requires_transaction()}
    end
  end
end
