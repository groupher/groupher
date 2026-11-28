defmodule GroupherServer.Seed.Article.Create do
  @moduledoc """
  Owns local Article fixture intent and verified references, never Article content writes.

      run/actor/community/key -> persisted commandId + input digest
        -> normal Dash Content Publisher -> Article Command
        -> verified owner + Snapshot provenance -> fixture references

  Recording metadata does not create or rewrite an Article, Author or BodyBag.
  Confirmed fixtures return canonical current WorkingCopy identities on repeat.
  """
  alias GroupherServer.{CMS, LocalTestActors, Repo}

  alias LocalTestActors.Communities

  @key ~r/\A[a-z][a-z0-9-]{0,39}\z/

  @doc "Requires the client protocol that claims dispatch before submitting content."
  def prepare_client(run, %{"protocol" => 2} = input), do: prepare(run, input)
  def prepare_client(_, _), do: {:error, :local_test_article_client_outdated}

  def prepare(run, input) do
    with {:ok, context} <- context(run, input) do
      case get_in(context.binding.raw, ["articles", context.fixture_key]) do
        nil ->
          entry = %{
            "key" => context.key,
            "commandId" => Ecto.UUID.generate(),
            "communityRef" => context.community.ref,
            "thread" => "post",
            "publish" => context.publish,
            "digest" => context.digest,
            "preparedAt" => DateTime.utc_now(:second) |> DateTime.to_iso8601(),
            "dispatchState" => "prepared",
            "status" => "pending"
          }

          with {:ok, _} <- put_entry(context, entry) do
            {:ok, prepared(context, entry)}
          end

        %{"digest" => digest} = entry when digest == context.digest ->
          case entry do
            %{"articleId" => article_id, "workingCopyId" => work_id} ->
              with {:ok, result} <-
                     canonical(context, entry, article_id, work_id, entry["snapshotId"]) do
                {:ok, %{existing: result}}
              end

            %{"status" => "pending"} ->
              case recover_confirmed(context, entry) do
                {:ok, {:found, result}} ->
                  {:ok, %{existing: result}}

                {:ok, :not_found} ->
                  if entry["dispatchState"] == "prepared" do
                    {:ok, prepared(context, entry)}
                  else
                    {:error, :local_test_article_recovery_required}
                  end

                {:error, _} = error ->
                  error
              end

            _ ->
              {:error, :invalid_local_test_article_fixture}
          end

        _ ->
          {:error, :local_test_article_fixture_conflict}
      end
    end
  end

  @doc "Marks one prepared operation as dispatched before the browser sends it downstream."
  def begin_dispatch(run, %{"commandId" => command_id, "attemptId" => attempt_id} = input)
      when is_binary(command_id) and is_binary(attempt_id) do
    with {:ok, context} <- context(run, input),
         {:ok, attempt_id} <- Ecto.UUID.cast(attempt_id),
         %{"digest" => digest, "commandId" => ^command_id, "status" => "pending"} = entry <-
           get_in(context.binding.raw, ["articles", context.fixture_key]),
         true <- digest == context.digest do
      case entry do
        %{"dispatchState" => "prepared"} ->
          updated =
            entry
            |> Map.put("dispatchState", "dispatched")
            |> Map.put("dispatchAttempt", attempt_id)

          with {:ok, _} <- put_entry(context, updated) do
            {:ok, %{commandId: command_id, status: "dispatched"}}
          end

        %{"dispatchState" => "dispatched", "dispatchAttempt" => ^attempt_id} ->
          {:ok, %{commandId: command_id, status: "dispatched"}}

        _ ->
          {:error, :local_test_article_recovery_required}
      end
    else
      {:error, _} = error -> error
      _ -> {:error, :local_test_article_recovery_required}
    end
  end

  def begin_dispatch(_, _), do: {:error, :invalid_local_test_article_input}

  def record(run, %{"articleId" => article_id, "workingCopyId" => work_id} = input) do
    with {:ok, context} <- context(run, input),
         %{"digest" => digest} = entry <-
           get_in(context.binding.raw, ["articles", context.fixture_key]),
         true <- digest == context.digest,
         true <- is_nil(entry["articleId"]) or entry["articleId"] == article_id,
         true <- is_nil(entry["workingCopyId"]) or entry["workingCopyId"] == work_id,
         snapshot_id <- input["snapshotId"],
         true <- context.publish == is_binary(snapshot_id),
         true <- is_nil(entry["snapshotId"]) or entry["snapshotId"] == snapshot_id,
         {:ok, result} <- canonical(context, entry, article_id, work_id, snapshot_id),
         {:ok, _} <-
           put_entry(
             context,
             Map.merge(entry, %{
               "articleId" => article_id,
               "workingCopyId" => work_id,
               "snapshotId" => snapshot_id,
               "status" => "confirmed"
             })
           ) do
      {:ok, result}
    else
      {:error, _} = error -> error
      _ -> {:error, :local_test_article_fixture_conflict}
    end
  end

  def record(_, _), do: {:error, :invalid_local_test_article_result}

  @doc "Identifies a pending operation that may have reached the Publisher."
  def unresolved?(entry) do
    entry["status"] == "pending" and entry["dispatchState"] != "prepared"
  end

  @doc "Cancels unsent prepared operations while the caller holds the run lock."
  def cancel_unsent(raw) do
    case raw["articles"] do
      nil ->
        raw

      articles when is_map(articles) ->
        updated =
          Map.new(articles, fn {key, entry} ->
            if entry["status"] == "pending" and entry["dispatchState"] == "prepared" do
              {key,
               entry |> Map.put("status", "cancelled") |> Map.put("dispatchState", "cancelled")}
            else
              {key, entry}
            end
          end)

        Map.put(raw, "articles", updated)
    end
  end

  @doc "Lists only retained fixture references; cleanup never deletes content by these IDs."
  def retained(bindings) do
    Enum.flat_map(bindings, fn binding ->
      Enum.map(binding.raw["articles"] || %{}, fn {_identity, entry} ->
        Map.take(entry, [
          "key",
          "commandId",
          "preparedAt",
          "dispatchState",
          "communityRef",
          "publish",
          "articleId",
          "workingCopyId",
          "snapshotId",
          "status"
        ])
        |> Map.put("ownerAlias", binding.raw["alias"])
        |> Map.put("operationRef", entry["commandId"])
      end)
    end)
  end

  defp context(_, %{"key" => key}) when not is_binary(key) do
    {:error, :invalid_local_test_article_input}
  end

  defp context(run, %{"alias" => name, "community" => slug, "thread" => "post"} = input) do
    key = input["key"] || "primary"
    title = input["title"] || "Local Article #{key}"
    markdown = input["markdown"] || "Local Article fixture for #{run}/#{name}/#{key}."
    publish = Map.get(input, "publish", false)

    with true <- is_binary(key) and Regex.match?(@key, key),
         true <- is_binary(title) and String.trim(title) != "" and byte_size(title) <= 1000,
         true <- is_binary(markdown) and byte_size(markdown) <= 512_000,
         true <- is_boolean(publish),
         {:ok, user, binding} <- GroupherServer.Seed.Run.actor(run, name),
         {:ok, community, _} <- Communities.require_admin(user, slug) do
      digest_input =
        if publish, do: ["post", title, markdown, "published"], else: ["post", title, markdown]

      digest =
        :crypto.hash(:sha256, Jason.encode!(digest_input))
        |> Base.encode16(case: :lower)

      {:ok,
       %{
         user: user,
         binding: binding,
         community: community,
         key: key,
         fixture_key: "#{community.ref}/post/#{key}",
         title: title,
         markdown: markdown,
         publish: publish,
         digest: digest
       }}
    else
      false -> {:error, :invalid_local_test_article_input}
      {:error, _} = error -> error
    end
  end

  defp context(_, _), do: {:error, :local_test_article_requires_post_and_community}

  defp prepared(context, entry) do
    %{
      ownerLogin: context.user.login,
      publish: context.publish,
      command: %{
        action:
          if(context.publish,
            do: "article.create_and_publish",
            else: "article.create"
          ),
        commandId: entry["commandId"],
        target: %{community: context.community.slug, thread: "post"},
        payload: %{
          title: context.title,
          content: %{format: "markdown", markdown: context.markdown},
          tagIds: []
        }
      }
    }
  end

  defp recover_confirmed(context, %{"commandId" => command_id} = entry) do
    with {:ok, result} <-
           CMS.find_article_creation_by_command(command_id, context.community.id, context.user) do
      case result do
        nil ->
          {:ok, :not_found}

        %{article_id: article_id, working_copy_id: work_id, snapshot_id: public_snapshot_id} ->
          snapshot_id = if context.publish, do: public_snapshot_id, else: nil

          with {:ok, result} <- canonical(context, entry, article_id, work_id, snapshot_id),
               {:ok, _} <-
                 put_entry(
                   context,
                   Map.merge(entry, %{
                     "articleId" => article_id,
                     "workingCopyId" => work_id,
                     "snapshotId" => snapshot_id,
                     "status" => "confirmed"
                   })
                 ) do
            {:ok, {:found, result}}
          end
      end
    else
      {:error, _} = error -> error
    end
  end

  defp recover_confirmed(_, _), do: {:error, :invalid_local_test_article_fixture}

  defp canonical(context, entry, article_id, work_id, snapshot_id) do
    input = %{
      article_id: article_id,
      working_copy_id: work_id,
      community_id: context.community.id,
      command_id: entry["commandId"],
      snapshot_id: snapshot_id,
      publish: context.publish
    }

    case CMS.verify_post_creation(input, context.user) do
      {:ok, result} ->
        {:ok,
         %{
           articleId: result.article_id,
           workingCopyId: result.working_copy_id,
           revision: result.revision,
           ownerLogin: context.user.login,
           community: context.community.slug,
           communityRef: context.community.ref,
           thread: "post",
           key: context.key,
           publish: context.publish,
           snapshotId: snapshot_id
         }}

      _ ->
        {:error, :local_test_article_provenance_mismatch}
    end
  end

  defp put_entry(context, entry) do
    articles = Map.put(context.binding.raw["articles"] || %{}, context.fixture_key, entry)

    context.binding
    |> Ecto.Changeset.change(raw: Map.put(context.binding.raw, "articles", articles))
    |> Repo.update()
  end
end
