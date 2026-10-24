defmodule GroupherServer.CMS.Review.Requests do
  @moduledoc """
  Owns the current CMS review request for each resource scope.

      locked resource command -> supersede old request -> insert fixed request
      -> worker result -> apply only while the request is current
  """

  import Ecto.Query

  alias GroupherServer.{AlertWall, CMS, Repo, ReviewBot}
  alias CMS.Review.{Effects, Results}
  alias CMS.Model.ArtimentReview

  @doc "Creates the current request inside the resource command's transaction."
  @spec create_in_transaction(map()) :: {:ok, ArtimentReview.t()} | {:error, term()}
  def create_in_transaction(attrs) when is_map(attrs) do
    with true <- Repo.in_transaction?(),
         {:ok, attrs} <- validate_attrs(attrs),
         {:ok, :pass} <- supersede_current(attrs),
         {:ok, request} <- insert_request(attrs),
         {:ok, _event} <- Effects.enqueue_artiment_review(request) do
      {:ok, request}
    else
      false -> {:error, CMS.ErrorCat.review_transition_requires_transaction()}
      {:error, _reason} = error -> error
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  def create_in_transaction(_attrs), do: {:error, CMS.ErrorCat.invalid_review_block()}

  @doc "Loads a request only while it is current and its private payload is live."
  @spec current(Ecto.UUID.t()) :: {:ok, ArtimentReview.t()} | {:error, term()}
  def current(request_id) when is_binary(request_id) do
    now = DateTime.utc_now(:second)

    case Repo.one(
           from(request in ArtimentReview,
             where:
               request.id == ^request_id and is_nil(request.outdated_at) and
                 request.payload_expires_at > ^now
           )
         ) do
      %ArtimentReview{} = request -> {:ok, request}
      nil -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  def current(_request_id), do: {:error, CMS.ErrorCat.invalid_review_block()}

  @doc "Returns the latest current review request for one canonical resource scope."
  def current_for_scope(attrs) when is_map(attrs) do
    query =
      attrs
      |> Map.put(:target_type, attrs.type)
      |> current_scope_query()
      |> order_by([request], desc: request.inserted_at, desc: request.id)
      |> limit(1)

    {:ok, Repo.one(query)}
  end

  def current_for_scope(_attrs), do: {:error, CMS.ErrorCat.invalid_review_block()}

  @doc "Lists current CMS requests that require human attention in one authorized scope."
  def pending_for_scope(attrs) when is_map(attrs) do
    query = from(request in ArtimentReview, where: is_nil(request.outdated_at))

    query =
      case Map.get(attrs, :community_id) do
        nil -> where(query, [request], is_nil(request.community_id))
        community_id -> where(query, [request], request.community_id == ^community_id)
      end

    query = order_by(query, [request], desc: request.inserted_at, desc: request.id)

    requests = Repo.all(query) |> Enum.filter(&pending_for_human?/1)
    {:ok, requests}
  end

  def pending_for_scope(_attrs), do: {:error, CMS.ErrorCat.invalid_review_block()}

  @doc "Fails expired queued work and clears its private payload so it remains reviewable."
  @spec expire_payloads(pos_integer()) :: {:ok, non_neg_integer()} | {:error, term()}
  def expire_payloads(batch_size) when is_integer(batch_size) and batch_size > 0 do
    now = DateTime.utc_now(:second)

    ids =
      Repo.all(
        from(request in ArtimentReview,
          where:
            is_nil(request.outdated_at) and request.payload_expires_at <= ^now and
              request.state in [:queued, :running],
          order_by: [asc: request.payload_expires_at, asc: request.id],
          limit: ^batch_size,
          select: request.id
        )
      )

    if ids == [] do
      {:ok, 0}
    else
      {count, _} =
        Repo.update_all(
          from(request in ArtimentReview,
            where:
              request.id in ^ids and is_nil(request.outdated_at) and
                request.state in [:queued, :running]
          ),
          set: [
            state: :failed,
            result: %{"error" => "payload_expired"},
            payload: %{},
            updated_at: now
          ]
        )

      {:ok, count}
    end
  end

  def expire_payloads(_batch_size), do: {:error, CMS.ErrorCat.invalid_review_block()}

  @doc "Runs one queued request through ReviewBot and stores only its bounded opinion."
  @spec process(Ecto.UUID.t()) ::
          {:ok, :stale | :completed | ArtimentReview.t()} | {:error, term()}
  def process(request_id) when is_binary(request_id) do
    case current(request_id) do
      {:ok, %ArtimentReview{state: :completed} = request} -> {:ok, request}
      {:ok, %ArtimentReview{} = request} -> run_current(request)
      {:error, _reason} -> {:ok, :stale}
    end
  end

  def process(_request_id), do: {:error, CMS.ErrorCat.invalid_review_block()}

  @doc "Ends all current requests for one target scope inside the owning resource transaction."
  @spec supersede_scope_in_transaction(map(), Ecto.UUID.t()) :: {:ok, :pass} | {:error, term()}
  def supersede_scope_in_transaction(attrs, operation_ref)
      when is_map(attrs) and is_binary(operation_ref) do
    with true <- Repo.in_transaction?(),
         query <- current_scope_query(Map.put(attrs, :target_type, attrs.type)),
         requests <- Repo.all(lock(query)),
         {:ok, :pass} <- supersede_wall_items(requests, operation_ref) do
      now = DateTime.utc_now(:second)

      Repo.update_all(query,
        set: [outdated_at: now, payload: %{}, updated_at: now]
      )

      {:ok, :pass}
    else
      false -> {:error, CMS.ErrorCat.review_transition_requires_transaction()}
      {:error, _reason} = error -> error
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  def supersede_scope_in_transaction(_attrs, _operation_ref) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  @doc "Returns and locks current requests for one typed target scope in an owner transaction."
  @spec current_for_scope_in_transaction(map()) :: {:ok, [ArtimentReview.t()]} | {:error, term()}
  def current_for_scope_in_transaction(attrs) when is_map(attrs) do
    with true <- Repo.in_transaction?(),
         query <- current_scope_query(Map.put(attrs, :target_type, attrs.type)) do
      {:ok, Repo.all(lock(query))}
    else
      false -> {:error, CMS.ErrorCat.review_transition_requires_transaction()}
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  def current_for_scope_in_transaction(_attrs) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  @doc "Claims one current request without allowing superseded or expired work to run."
  @spec claim_in_transaction(Ecto.UUID.t()) :: {:ok, ArtimentReview.t()} | {:error, term()}
  def claim_in_transaction(request_id) when is_binary(request_id) do
    with true <- Repo.in_transaction?(),
         %ArtimentReview{outdated_at: nil} = request <- lock_current(request_id),
         true <-
           DateTime.compare(request.payload_expires_at, DateTime.utc_now(:second)) == :gt,
         {:ok, claimed} <- claim(request) do
      {:ok, claimed}
    else
      false -> {:error, CMS.ErrorCat.invalid_review_block()}
      nil -> {:error, CMS.ErrorCat.invalid_review_block()}
      {:error, _reason} = error -> error
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  def claim_in_transaction(_request_id) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  @doc "Stores one completed opinion while the caller holds the resource transaction."
  @spec complete_in_transaction(Ecto.UUID.t(), map()) ::
          {:ok, ArtimentReview.t()} | {:error, term()}
  def complete_in_transaction(request_id, result) when is_binary(request_id) and is_map(result) do
    with true <- Repo.in_transaction?(),
         %ArtimentReview{state: state, outdated_at: nil} = request <- lock_current(request_id),
         true <- state == :running,
         {:ok, updated} <-
           request
           |> ArtimentReview.changeset(%{state: :completed, result: result, payload: %{}})
           |> Repo.update() do
      {:ok, updated}
    else
      false -> {:error, CMS.ErrorCat.invalid_review_block()}
      nil -> {:error, CMS.ErrorCat.invalid_review_block()}
      {:error, _reason} = error -> error
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  def complete_in_transaction(_request_id, _result) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  @doc "Stores a terminal provider failure and clears its private input payload."
  @spec fail_in_transaction(Ecto.UUID.t(), map()) :: {:ok, ArtimentReview.t()} | {:error, term()}
  def fail_in_transaction(request_id, failure) when is_binary(request_id) and is_map(failure) do
    with true <- Repo.in_transaction?(),
         %ArtimentReview{state: :running, outdated_at: nil} = request <- lock_current(request_id),
         {:ok, updated} <-
           request
           |> ArtimentReview.changeset(%{state: :failed, result: failure, payload: %{}})
           |> Repo.update() do
      {:ok, updated}
    else
      false -> {:error, CMS.ErrorCat.review_transition_requires_transaction()}
      nil -> {:error, CMS.ErrorCat.invalid_review_block()}
      {:error, _reason} = error -> error
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  def fail_in_transaction(_request_id, _failure) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  @doc "Marks a current completed request applied exactly once."
  @spec mark_applied_in_transaction(Ecto.UUID.t()) ::
          {:ok, ArtimentReview.t()} | {:error, term()}
  def mark_applied_in_transaction(request_id) when is_binary(request_id) do
    with true <- Repo.in_transaction?(),
         %ArtimentReview{state: :completed, applied_at: nil, outdated_at: nil} = request <-
           lock_current(request_id),
         {:ok, updated} <-
           request
           |> ArtimentReview.changeset(%{applied_at: DateTime.utc_now(:second)})
           |> Repo.update() do
      {:ok, updated}
    else
      false -> {:error, CMS.ErrorCat.review_transition_requires_transaction()}
      nil -> {:error, CMS.ErrorCat.invalid_review_block()}
      {:error, _reason} = error -> error
      _ -> {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  def mark_applied_in_transaction(_request_id) do
    {:error, CMS.ErrorCat.invalid_review_block()}
  end

  defp validate_attrs(attrs) do
    now = DateTime.utc_now(:second)

    attrs =
      Map.merge(
        %{
          id: Ecto.UUID.generate(),
          state: :queued,
          payload_expires_at: DateTime.add(now, 86_400, :second),
          payload: %{}
        },
        attrs
      )

    changeset = ArtimentReview.changeset(%ArtimentReview{}, attrs)

    if changeset.valid? do
      {:ok, attrs}
    else
      {:error, CMS.ErrorCat.invalid_review_block()}
    end
  end

  defp supersede_current(attrs) do
    now = DateTime.utc_now(:second)
    query = current_scope_query(attrs)
    requests = Repo.all(lock(query))

    with {:ok, :pass} <- supersede_wall_items(requests, attrs.id) do
      Repo.update_all(query,
        set: [outdated_at: now, payload: %{}, updated_at: now]
      )

      {:ok, :pass}
    end
  end

  defp insert_request(attrs) do
    request = %ArtimentReview{id: attrs.id}

    case Repo.insert(ArtimentReview.changeset(request, attrs)) do
      {:ok, request} -> {:ok, request}
      {:error, changeset} -> {:error, changeset}
    end
  end

  defp supersede_wall_items(requests, operation_ref) do
    Enum.reduce_while(requests, {:ok, :pass}, fn request, {:ok, :pass} ->
      case AlertWall.supersede_ai_source_in_transaction(request.id, operation_ref) do
        {:ok, :pass} -> {:cont, {:ok, :pass}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp lock(query), do: Ecto.Query.lock(query, "FOR UPDATE")

  defp run_current(%ArtimentReview{id: request_id} = request) do
    with {:ok, {:ok, _claimed}} <- Repo.transaction(fn -> claim_in_transaction(request_id) end),
         {:ok, payload} <- CMS.Review.Media.attach_signed_urls(request.payload),
         {:ok, opinion} <- ReviewBot.check(payload, request.policy_snapshot),
         {:ok, {:ok, applied}} <-
           Repo.transaction(fn ->
             Results.apply_in_transaction(request_id, normalize_opinion(opinion))
           end) do
      {:ok, applied}
    else
      {:ok, {:error, _reason}} -> {:ok, :stale}
      {:error, _reason} = error -> error
      other -> {:error, {:artiment_review_failed, other}}
    end
  end

  defp normalize_opinion(opinion) do
    %{
      "status" => Atom.to_string(opinion.status),
      "sus_notes" =>
        Enum.map(opinion.sus_notes, fn note ->
          %{
            "type" => to_string(note.type),
            "evidence" => note.evidence,
            "explanation" => note.explanation
          }
        end),
      "coverage" =>
        Map.new(opinion.coverage, fn {key, value} ->
          {Atom.to_string(key), Atom.to_string(value)}
        end),
      "summary" => opinion.summary
    }
  end

  defp claim(%ArtimentReview{state: :queued} = request) do
    request
    |> ArtimentReview.changeset(%{state: :running})
    |> Repo.update()
  end

  defp claim(%ArtimentReview{state: :running} = request), do: {:ok, request}
  defp claim(_request), do: {:error, CMS.ErrorCat.invalid_review_block()}

  defp current_scope_query(%{target_type: :article, article_id: article_id} = attrs) do
    query =
      from(request in ArtimentReview,
        where:
          request.target_type == :article and request.article_id == ^article_id and
            is_nil(request.outdated_at)
      )

    scope_query(query, attrs)
  end

  defp current_scope_query(%{target_type: :comment, comment_id: comment_id} = attrs) do
    query =
      from(request in ArtimentReview,
        where:
          request.target_type == :comment and request.comment_id == ^comment_id and
            is_nil(request.outdated_at)
      )

    scope_query(query, attrs)
  end

  defp current_scope_query(%{target_type: :doc, article_id: article_id, branch_id: branch_id}) do
    from(request in ArtimentReview,
      where:
        request.target_type == :doc and request.article_id == ^article_id and
          request.branch_id == ^branch_id and is_nil(request.outdated_at)
    )
  end

  defp current_scope_query(_attrs), do: from(request in ArtimentReview, where: false)

  defp scope_query(query, %{community_id: nil}) do
    where(query, [request], is_nil(request.community_id))
  end

  defp scope_query(query, %{community_id: community_id}) do
    where(query, [request], request.community_id == ^community_id)
  end

  defp scope_query(query, _attrs), do: query

  defp pending_for_human?(%ArtimentReview{state: :failed}), do: true

  defp pending_for_human?(%ArtimentReview{result: %{"status" => status}} = request)
       when status in ["suspect", "uncertain"] do
    not is_nil(request.applied_at)
  end

  defp pending_for_human?(%ArtimentReview{
         policy_snapshot: %{"review_mode" => "human_first", "trigger" => trigger},
         result: %{"status" => "clear"},
         applied_at: applied_at
       })
       when trigger in ["publish", "binding"] do
    not is_nil(applied_at)
  end

  defp pending_for_human?(_request), do: false

  defp lock_current(request_id) do
    Repo.one(
      from(request in ArtimentReview,
        where: request.id == ^request_id and is_nil(request.outdated_at),
        lock: "FOR UPDATE"
      )
    )
  end
end
