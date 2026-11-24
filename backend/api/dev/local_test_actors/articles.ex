defmodule GroupherServer.LocalTestActors.Articles do
  @moduledoc """
  Owns local Article fixture intent and verified references, never Article content writes.

      run/actor/community/key -> persisted commandId + input digest
        -> normal Dash Content Publisher -> Article Command
        -> verified owner + Snapshot provenance -> fixture references

  Recording metadata does not create or rewrite an Article, Author or BodyBag.
  Confirmed fixtures return canonical current WorkingCopy identities on repeat.
  """
  import Ecto.Query
  alias GroupherServer.{CMS, LocalTestActors, Repo}

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleEvent,
    ArticleSnapshot,
    ArticleWorkingCopy,
    Author
  }

  alias LocalTestActors.Communities

  @key ~r/\A[a-z][a-z0-9-]{0,39}\z/

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
              {:ok, prepared(context, entry)}

            _ ->
              {:error, :invalid_local_test_article_fixture}
          end

        _ ->
          {:error, :local_test_article_fixture_conflict}
      end
    end
  end

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

  @doc "Lists only retained fixture references; cleanup never deletes content by these IDs."
  def retained(bindings) do
    Enum.flat_map(bindings, fn binding ->
      Enum.map(binding.raw["articles"] || %{}, fn {_identity, entry} ->
        Map.take(entry, [
          "key",
          "commandId",
          "communityRef",
          "publish",
          "articleId",
          "workingCopyId",
          "snapshotId",
          "status"
        ])
        |> Map.put("ownerAlias", binding.raw["alias"])
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
         {:ok, user, binding} <- LocalTestActors.actor(run, name),
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

  defp canonical(context, entry, article_id, work_id, snapshot_id) do
    with {:ok, _} <- Ecto.UUID.cast(article_id),
         {:ok, _} <- Ecto.UUID.cast(work_id),
         %Article{thread: :post} = article <- Repo.get(Article, article_id),
         %Author{user_id: owner_id} <- Repo.get(Author, article.author_id),
         true <- owner_id == context.user.id,
         %ArticleWorkingCopy{
           article_id: ^article_id,
           created_by_id: ^owner_id,
           scope_type: :default
         } = work <- Repo.get(ArticleWorkingCopy, work_id),
         %ArticleBinding{} <-
           Repo.get_by(ArticleBinding, article_id: article_id, community_id: context.community.id),
         true <- creation_provenance?(context, entry, article_id, work_id),
         true <-
           not context.publish or
             published_provenance?(context, entry, article, work, snapshot_id) do
      {:ok,
       %{
         articleId: article.id,
         workingCopyId: work.id,
         revision: work.revision,
         ownerLogin: context.user.login,
         community: context.community.slug,
         communityRef: context.community.ref,
         thread: "post",
         key: context.key,
         publish: context.publish,
         snapshotId: snapshot_id
       }}
    else
      _ -> {:error, :local_test_article_provenance_mismatch}
    end
  end

  defp published_provenance?(context, entry, article, work, snapshot_id)
       when is_binary(snapshot_id) do
    with {:ok, _} <- Ecto.UUID.cast(snapshot_id),
         %ArticleSnapshot{
           id: ^snapshot_id,
           source_working_copy_id: work_id,
           causation_command_id: command_id
         } <- Repo.get(ArticleSnapshot, snapshot_id),
         true <- work_id == work.id and command_id == entry["commandId"],
         true <-
           Repo.exists?(
             from(e in ArticleEvent,
               where:
                 e.article_id == ^article.id and e.after_snapshot_id == ^snapshot_id and
                   e.type == :publish and
                   e.actor_id == ^context.user.id and
                   e.source_community_id == ^context.community.id
             )
           ),
         {:ok, public} <- CMS.Articles.Public.get(article),
         true <- public.snapshot_id == snapshot_id do
      true
    else
      _ -> false
    end
  end

  defp published_provenance?(_, _, _, _, _), do: false

  defp creation_provenance?(context, entry, article_id, work_id) do
    command_id = entry["commandId"]

    Repo.exists?(
      from(e in ArticleEvent,
        join: s in ArticleSnapshot,
        on: s.id == e.after_snapshot_id,
        where:
          e.article_id == ^article_id and e.working_copy_id == ^work_id and e.type == :create and
            e.actor_id == ^context.user.id and e.source_community_id == ^context.community.id and
            s.causation_command_id == ^command_id and s.source_working_copy_id == ^work_id
      )
    )
  end

  defp put_entry(context, entry) do
    articles = Map.put(context.binding.raw["articles"] || %{}, context.fixture_key, entry)

    context.binding
    |> Ecto.Changeset.change(raw: Map.put(context.binding.raw, "articles", articles))
    |> Repo.update()
  end
end
