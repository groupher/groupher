defmodule GroupherServer.CMS.Review.RequestSubmission do
  @moduledoc """
  Creates one CMS request per pinned system or community policy scope.

  Business position:

      CMS publish/edit command
        -> immutable content and policy snapshot
          -> scoped ArtimentReview rows
            -> review Effect
  """

  alias GroupherServer.ReviewBot
  alias GroupherServer.{AlertWall, CMS, Repo}
  alias CMS.Model.ArtimentReview

  @doc "Creates scoped requests with immutable content and complete configuration snapshots."
  @spec register_in_transaction(map(), map(), map(), :publish | :edit | :recheck | :binding) ::
          {:ok, [ArtimentReview.t()]} | {:error, term()}
  def register_in_transaction(target, content, configs, trigger)
      when is_map(target) and is_map(content) and is_map(configs) and
             trigger in [:publish, :edit, :recheck, :binding] do
    register_in_transaction(target, content, configs, trigger, :all)
  end

  def register_in_transaction(_target, _content, _configs, _trigger) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  @doc "Creates one request for a specific policy scope inside the caller transaction."
  @spec register_in_transaction(
          map(),
          map(),
          map(),
          :publish | :edit | :recheck | :binding,
          :all | :system | {:community, pos_integer()}
        ) ::
          {:ok, [ArtimentReview.t()]} | {:error, term()}
  def register_in_transaction(target, content, configs, trigger, requested_scope)
      when is_map(target) and is_map(content) and is_map(configs) and
             trigger in [:publish, :edit, :recheck, :binding] and
             (requested_scope == :all or requested_scope == :system or
                (trigger in [:recheck, :binding] and is_tuple(requested_scope) and
                   tuple_size(requested_scope) == 2 and elem(requested_scope, 0) == :community and
                   is_integer(elem(requested_scope, 1)))) do
    CMS.Comments.Summary.for_lifecycle(
      Map.get(target, :lifecycle),
      Map.get(target, :operation_ref),
      fn ->
        with true <- Repo.in_transaction?(),
             {:ok, operation_ref} <- Ecto.UUID.cast(Map.get(target, :operation_ref)),
             {:ok, scopes} <- review_policy_snapshots(configs, trigger, requested_scope),
             {:ok, attrs} <- target_attrs(target, content, scopes, operation_ref),
             {:ok, :pass} <- end_previous_wall_items(target, trigger),
             {:ok, requests} <- insert_scoped_requests(attrs, target) do
          {:ok, requests}
        else
          false -> {:error, CMS.ErrorCat.review_transition_requires_transaction()}
          {:error, _reason} = error -> error
          _ -> {:error, CMS.ErrorCat.invalid_review_block()}
        end
      end
    )
  end

  def register_in_transaction(_target, _content, _configs, _trigger, _scope) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  defp review_policy_snapshots(configs, trigger, scope) do
    case ReviewBot.policy_snapshots(configs, trigger, scope) do
      {:ok, snapshots} -> {:ok, snapshots}
      {:error, _reason} -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp target_attrs(target, content, scopes, operation_ref) do
    with {:ok, payload} <- normalize_content(content),
         {:ok, common} <- validate_target(target) do
      {:ok,
       Enum.map(scopes, fn scope ->
         Map.merge(common, %{
           operation_ref: operation_ref,
           community_id: scope.community_id,
           policy_snapshot: scope.policy_snapshot,
           payload: payload
         })
       end)}
    end
  end

  defp validate_target(%{type: :article, article_id: article_id})
       when is_binary(article_id) do
    {:ok,
     %{
       target_type: :article,
       article_id: article_id
     }}
  end

  defp validate_target(%{type: :comment, comment_id: comment_id})
       when is_integer(comment_id) do
    {:ok,
     %{
       target_type: :comment,
       comment_id: comment_id
     }}
  end

  defp validate_target(_target) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  defp normalize_content(%{title: title, body: body} = content)
       when is_binary(title) and is_binary(body) do
    {:ok,
     %{"text" => %{"title" => title, "body" => body}, "images" => Map.get(content, :images, [])}}
  end

  defp normalize_content(%{"title" => title, "body" => body} = content)
       when is_binary(title) and is_binary(body) do
    {:ok,
     %{"text" => %{"title" => title, "body" => body}, "images" => Map.get(content, "images", [])}}
  end

  defp normalize_content(_content) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  defp insert_scoped_requests(scopes, target) do
    Enum.reduce_while(scopes, {:ok, []}, fn attrs, {:ok, requests} ->
      case CMS.Review.Requests.create_in_transaction(attrs) do
        {:ok, request} ->
          case apply_initial_hold(request, target) do
            {:ok, :pass} -> {:cont, {:ok, [request | requests]}}
            {:error, reason} -> {:halt, {:error, reason}}
          end

        {:error, reason} ->
          {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, requests} -> {:ok, Enum.reverse(requests)}
      {:error, reason} -> {:error, reason}
    end
  end

  defp apply_initial_hold(
         %ArtimentReview{policy_snapshot: %{"scope" => "system"}},
         _target
       ) do
    {:ok, :pass}
  end

  defp apply_initial_hold(
         %ArtimentReview{policy_snapshot: %{"review_mode" => "immediate"}},
         _target
       ) do
    {:ok, :pass}
  end

  defp apply_initial_hold(%ArtimentReview{} = request, %{lifecycle: lifecycle}) do
    if CMS.Review.Requests.shared_comment_community_request?(request) do
      {:ok, :pass}
    else
      with {:ok, scope_key} <- restriction_scope(request),
           {:ok, _restriction} <-
             CMS.Review.Restrictions.apply(lifecycle, %{
               scope_key: scope_key,
               type: :ai_review_hold,
               artiment_review_id: request.id,
               operation_ref: request.operation_ref,
               source_ref: "request:#{request.id}:ai_review_hold",
               source: :request,
               applied_at: DateTime.utc_now(:second)
             }) do
        {:ok, :pass}
      else
        {:error, _reason} = error -> error
      end
    end
  end

  defp apply_initial_hold(_request, _target) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  defp restriction_scope(request), do: {:ok, request_scope(request)}

  defp request_scope(%ArtimentReview{community_id: nil}), do: "platform"
  defp request_scope(%ArtimentReview{community_id: id}), do: "community:#{id}"

  defp end_previous_wall_items(_target, trigger) when trigger in [:recheck, :binding] do
    {:ok, :pass}
  end

  defp end_previous_wall_items(%{type: :article, article_id: id}, _trigger) do
    with {:ok, :pass} <-
           CMS.Review.Requests.mark_content_changed_in_transaction(%{
             type: :article,
             article_id: id
           }) do
      AlertWall.mark_content_changed_in_transaction(:article, id, Ecto.UUID.generate())
    end
  end

  defp end_previous_wall_items(%{type: :comment, comment_id: id}, _trigger) do
    with {:ok, :pass} <-
           CMS.Review.Requests.mark_content_changed_in_transaction(%{
             type: :comment,
             comment_id: id
           }) do
      AlertWall.mark_content_changed_in_transaction(:comment, to_string(id), Ecto.UUID.generate())
    end
  end
end
