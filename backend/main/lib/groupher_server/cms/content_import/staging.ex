defmodule GroupherServer.CMS.ContentImport.Staging do
  @moduledoc """
  Idempotently stages fixed-size BodyBag batches in PostgreSQL.

      bodyBag | skipped | failed
                  |
                  v
      lock Job + Item -> validate/cast -> persist Body row or item outcome
                  |
                  v
      recompute counts -> pending => staging
                       -> ready > 0 => ready
                       -> no importable content => failed

  A ready BodyBag cannot be replaced by a skip/failure, and the same external
  ref cannot be restaged with different bytes after completion.

  See `docs/bulk-import/article-publish-import-refactor.md` and
  `docs/bulk-import/import-error-handling.md`.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.CMS.Artiment.BodyBag
  alias GroupherServer.CMS.ContentImport.Jobs
  alias GroupherServer.CMS.ContentImport.Persistence.Job
  alias GroupherServer.CMS.ContentImport.Persistence.Job.Body, as: StagedBody
  alias GroupherServer.CMS.ContentImport.Persistence.Job.Item
  alias GroupherServer.CMS.Model.Community
  alias GroupherServer.Repo

  @max_batch_count 4
  @max_body_bytes 5 * 1024 * 1024

  @doc "Stages one bounded, unique-externalRef batch and returns the refreshed Job projection."
  @spec stage(Community.t(), Ecto.UUID.t(), [map()]) :: {:ok, map()} | {:error, term()}
  def stage(%Community{} = community, job_ref, items)
      when is_list(items) and length(items) in 1..@max_batch_count do
    with :ok <- validate_unique_refs(items) do
      Repo.transaction(fn ->
        with {:ok, job} <- Jobs.lock_job(community.id, job_ref),
             :ok <- ensure_stageable(job),
             :ok <- stage_items(job, items),
             {:ok, job} <- refresh_job(job, items) do
          Jobs.project(job)
        else
          {:error, reason} -> Repo.rollback(reason)
        end
      end)
    end
  end

  def stage(%Community{}, _job_ref, _items),
    do: {:error, {:custom, "BodyBag batch must contain between 1 and 4 items"}}

  defp validate_unique_refs(items) do
    refs = Enum.map(items, &value(&1, "external_ref"))

    if Enum.all?(refs, &(is_binary(&1) and &1 != "")) and length(Enum.uniq(refs)) == length(refs),
      do: :ok,
      else: {:error, {:custom, "BodyBag batch contains an invalid or duplicate externalRef"}}
  end

  defp ensure_stageable(%Job{status: status}) when status in [:staging, :ready, :completed],
    do: :ok

  defp ensure_stageable(job),
    do: {:error, {:custom, "ImportJob is not stageable from #{job.status}"}}

  defp stage_items(job, items) do
    Enum.reduce_while(items, :ok, fn input, :ok ->
      external_ref = value(input, "external_ref")

      case lock_item(job.id, external_ref) do
        {:ok, item} ->
          case stage_item(job, item, input) do
            :ok -> {:cont, :ok}
            {:error, reason} -> {:halt, {:error, reason}}
          end

        {:error, reason} ->
          {:halt, {:error, reason}}
      end
    end)
  end

  defp stage_item(job, item, input) do
    body_bag = value(input, "body_bag")
    skipped = value(input, "skipped")
    failed = value(input, "failed")

    case Enum.count([body_bag, skipped, failed], &is_map/1) do
      1 when is_map(body_bag) ->
        stage_body(job, item, body_bag)

      1 when is_map(skipped) ->
        stage_skip(item, value(skipped, "code"))

      1 when is_map(failed) ->
        stage_failure(
          job,
          item,
          value(failed, "code"),
          value(failed, "message"),
          value(failed, "stage")
        )

      _ ->
        {:error,
         {:custom, "Each staging item requires exactly one bodyBag, skipped, or failed value"}}
    end
  end

  defp stage_body(%Job{status: :completed}, item, attrs) do
    with {:ok, body_bag} <- BodyBag.cast(attrs, thread: :doc),
         true <- item.content_status == :ready and item.body_hash == body_bag.body_hash do
      :ok
    else
      false -> {:error, {:custom, "Completed ImportJob staging payload changed"}}
      {:error, reason} -> {:error, reason}
    end
  end

  defp stage_body(job, item, attrs) do
    case validate_document_metadata(item) do
      :ok -> stage_cast_body(job, item, attrs)
      {:error, {code, message}} -> stage_failure(job, item, code, message, "validation")
    end
  end

  defp stage_cast_body(job, item, attrs) do
    case BodyBag.cast(attrs, thread: :doc) do
      {:ok, body_bag} ->
        stage_validated_body(job, item, body_bag)

      {:error, changeset} ->
        stage_failure(
          job,
          item,
          "invalid_body_bag",
          changeset_message(changeset),
          "validation"
        )
    end
  end

  defp validate_document_metadata(item) do
    cond do
      String.length(item.title) not in 3..100 ->
        {:error,
         {"invalid_document_title", "Document title must contain between 3 and 100 characters."}}

      String.length(item.slug) not in 1..120 ->
        {:error,
         {"invalid_document_slug", "Document slug must contain between 1 and 120 characters."}}

      true ->
        :ok
    end
  end

  defp stage_validated_body(job, item, body_bag) do
    with body_map <- BodyBag.to_map(body_bag),
         {:ok, encoded} <- Jason.encode(body_map) do
      if byte_size(encoded) > @max_body_bytes do
        stage_skip(item, "content_too_large")
      else
        persist_validated_body(job, item, body_map, body_bag.body_hash, encoded)
      end
    end
  end

  defp persist_validated_body(job, item, body_map, body_hash, encoded) do
    with :ok <- persist_body(job, item, body_map, body_hash, byte_size(encoded)),
         {:ok, _item} <-
           item
           |> Item.changeset(%{
             body_hash: body_hash,
             content_status: :ready,
             error_code: nil,
             error_message: nil,
             error_stage: nil,
             skip_code: nil
           })
           |> Repo.update() do
      :ok
    end
  end

  defp changeset_message(changeset) do
    changeset
    |> Ecto.Changeset.traverse_errors(fn {message, options} ->
      Enum.reduce(options, message, fn {key, value}, current ->
        String.replace(current, "%{#{key}}", to_string(value))
      end)
    end)
    |> Enum.flat_map(fn {field, messages} ->
      Enum.map(messages, &"#{field} #{&1}")
    end)
    |> Enum.join("; ")
    |> case do
      "" -> "Document body failed validation."
      message -> String.slice(message, 0, 2_000)
    end
  end

  defp persist_body(job, item, body_map, body_hash, body_size_bytes) do
    case Repo.one(
           from(body in StagedBody,
             where: body.job_id == ^job.id and body.external_ref == ^item.external_ref,
             lock: "FOR UPDATE"
           )
         ) do
      %StagedBody{body_hash: ^body_hash} ->
        :ok

      %StagedBody{} ->
        {:error, {:custom, "BodyBag staging changed for an existing externalRef"}}

      nil ->
        attrs = %{
          body_bag: body_map,
          body_hash: body_hash,
          body_size_bytes: body_size_bytes,
          external_ref: item.external_ref,
          job_id: job.id,
          job_item_id: item.id
        }

        case %StagedBody{} |> StagedBody.changeset(attrs) |> Repo.insert() do
          {:ok, _body} -> :ok
          {:error, changeset} -> {:error, changeset}
        end
    end
  end

  defp stage_skip(%Item{content_status: :ready}, _code),
    do: {:error, {:custom, "A ready BodyBag cannot be replaced with a skip"}}

  defp stage_skip(item, "content_too_large") do
    case item
         |> Item.changeset(%{
           body_hash: nil,
           content_status: :skipped,
           error_code: nil,
           error_message: nil,
           error_stage: nil,
           skip_code: "content_too_large"
         })
         |> Repo.update() do
      {:ok, _item} -> :ok
      {:error, changeset} -> {:error, changeset}
    end
  end

  defp stage_skip(_item, _code),
    do: {:error, {:custom, "Only content_too_large may be skipped"}}

  defp stage_failure(
         %Job{status: :completed},
         %Item{
           content_status: :failed,
           error_code: code,
           error_message: message,
           error_stage: stage
         },
         code,
         message,
         stage
       ),
       do: :ok

  defp stage_failure(%Job{status: :completed}, _item, _code, _message, _stage),
    do: {:error, {:custom, "Completed ImportJob staging payload changed"}}

  defp stage_failure(_job, %Item{content_status: :ready}, _code, _message, _stage),
    do: {:error, {:custom, "A ready BodyBag cannot be replaced with a failure"}}

  defp stage_failure(_job, item, code, message, stage)
       when is_binary(code) and byte_size(code) > 0 and is_binary(message) and
              byte_size(message) > 0 and stage in ["source", "conversion", "validation"] do
    case item
         |> Item.changeset(%{
           body_hash: nil,
           content_status: :failed,
           error_code: String.slice(code, 0, 120),
           error_message: String.slice(message, 0, 2_000),
           error_stage: stage,
           skip_code: nil
         })
         |> Repo.update() do
      {:ok, _item} -> :ok
      {:error, changeset} -> {:error, changeset}
    end
  end

  defp stage_failure(_job, _item, _code, _message, _stage),
    do: {:error, {:custom, "A failed staging item requires code, message, and a valid stage"}}

  defp lock_item(job_id, external_ref) do
    case Repo.one(
           from(item in Item,
             where: item.job_id == ^job_id and item.external_ref == ^external_ref,
             lock: "FOR UPDATE"
           )
         ) do
      %Item{} = item -> {:ok, item}
      nil -> {:error, {:custom, "BodyBag source is not part of this ImportJob"}}
    end
  end

  defp refresh_job(%Job{status: :completed} = job, _items), do: {:ok, job}

  defp refresh_job(job, items) do
    counts =
      Item
      |> where([item], item.job_id == ^job.id)
      |> group_by([item], item.content_status)
      |> select([item], {item.content_status, count(item.id)})
      |> Repo.all()
      |> Map.new()

    ready = Map.get(counts, :ready, 0)
    skipped = Map.get(counts, :skipped, 0)
    failed = Map.get(counts, :failed, 0)
    pending = Map.get(counts, :pending, 0)
    total = ready + skipped + failed + pending
    results = item_results(job.id)

    attrs = %{
      progress:
        Map.merge(job.progress || %{}, %{
          "bodies" => %{
            "pending" => pending,
            "ready" => ready,
            "skipped" => skipped,
            "failed" => failed,
            "total" => total
          },
          "recentBatch" => recent_batch(job.id, items)
        }),
      result: Map.merge(job.result || %{}, results)
    }

    attrs =
      cond do
        pending > 0 ->
          Map.put(attrs, :status, :staging)

        ready > 0 ->
          Map.put(attrs, :status, :ready)

        true ->
          Map.merge(attrs, %{
            error_code: "no_importable_content",
            error_message: "No selected document could be imported. Review the document errors.",
            status: :failed
          })
      end

    job |> Job.changeset(attrs) |> Repo.update()
  end

  defp recent_batch(job_id, inputs) do
    refs = inputs |> Enum.map(&value(&1, "external_ref")) |> Enum.take(5)

    items_by_ref =
      Item
      |> where([item], item.job_id == ^job_id and item.external_ref in ^refs)
      |> Repo.all()
      |> Map.new(&{&1.external_ref, &1})

    Enum.map(refs, fn ref ->
      item = Map.fetch!(items_by_ref, ref)

      %{
        "label" => value(item.metadata || %{}, "sourcePath") || item.external_ref,
        "ref" => item.external_ref,
        "state" => recent_state(item.content_status)
      }
    end)
  end

  defp recent_state(:ready), do: "completed"
  defp recent_state(:failed), do: "failed"
  defp recent_state(:skipped), do: "skipped"

  defp item_results(job_id) do
    items =
      Item
      |> where([item], item.job_id == ^job_id)
      |> order_by([item], asc: item.id)
      |> Repo.all()

    %{
      "failedItems" =>
        items
        |> Enum.filter(&(&1.content_status == :failed))
        |> Enum.map(fn item ->
          %{
            "code" => item.error_code,
            "externalRef" => item.external_ref,
            "message" => item.error_message,
            "stage" => item.error_stage
          }
        end),
      "skipped" =>
        items
        |> Enum.filter(&(&1.content_status == :skipped))
        |> Enum.map(fn item ->
          %{
            "code" => item.skip_code,
            "externalRef" => item.external_ref,
            "message" => "Document exceeds the import capacity limit.",
            "stage" => "validation"
          }
        end)
    }
  end

  defp value(map, key), do: Map.get(map, key, Map.get(map, String.to_atom(key)))
end
