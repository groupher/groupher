defmodule GroupherServer.CMS.Articles.Public do
  @moduledoc """
  Owns the atomic current Snapshot selection and its independent public body.

      locked Article + immutable Snapshot -> Public + PublicBody -> public readers

  Publish owns admission, Receipt and effects. Rebuild only repairs the currently
  selected version; neither path commits independently of its caller.
  """
  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.Body

  alias CMS.Model.{
    Article,
    ArticleBodyDocument,
    ArticleSnapshot,
    ArticlePublic,
    ArticlePublicBody
  }

  @doc "Selects a same-Article Snapshot and atomically copies its complete public projection."
  def select_snapshot(article, snapshot, actor, opts \\ [])

  def select_snapshot(
        %Article{id: article_id},
        %ArticleSnapshot{id: snapshot_id, article_id: article_id},
        actor,
        opts
      ) do
    in_transaction(fn ->
      with %Article{} <- lock_article(article_id),
           previous = lock_public(article_id),
           %ArticleSnapshot{} = snapshot <-
             Repo.get_by(ArticleSnapshot, id: snapshot_id, article_id: article_id) do
        write(
          previous,
          snapshot,
          actor.id,
          Keyword.get(opts, :published_at, DateTime.utc_now(:second))
        )
      else
        nil -> {:error, :snapshot_not_found}
      end
    end)
  end

  def select_snapshot(_, _, _, _), do: {:error, :snapshot_owner_mismatch}

  @doc "Rebuilds only the requested current Snapshot under the publication locks, preserving publication facts."
  def rebuild(%Article{id: article_id}, snapshot_id) do
    in_transaction(fn ->
      with %Article{} <- lock_article(article_id),
           %ArticlePublic{snapshot_id: ^snapshot_id} = public <- lock_public(article_id),
           %ArticleSnapshot{} = snapshot <-
             Repo.get_by(ArticleSnapshot, id: snapshot_id, article_id: article_id) do
        write(public, snapshot, public.published_by_id, public.published_at)
      else
        %ArticlePublic{} -> {:error, :public_conflict}
        nil -> {:error, :public_not_found}
      end
    end)
  end

  @doc "Reads the public head, matching body and immutable metadata in one SQL snapshot."
  def current(article_id) do
    query =
      from(p in ArticlePublic,
        join: b in ArticlePublicBody,
        on: b.article_id == p.article_id and b.snapshot_id == p.snapshot_id,
        join: s in ArticleSnapshot,
        on: s.article_id == p.article_id and s.id == p.snapshot_id,
        where: p.article_id == ^article_id,
        select: {%{p | body: b}, s}
      )

    case Repo.one(query) do
      nil -> {:error, :public_not_found}
      pair -> {:ok, pair}
    end
  end

  @doc "Reads the exact selected public body; missing projections never fall back to history."
  def body(%ArticlePublic{
        article_id: article_id,
        snapshot_id: snapshot_id,
        body: %ArticlePublicBody{article_id: article_id, snapshot_id: snapshot_id} = body
      }) do
    {:ok, ArticleBodyDocument.document(body)}
  end

  def body(%ArticlePublic{article_id: article_id, snapshot_id: snapshot_id}) do
    case Repo.get_by(ArticlePublicBody, article_id: article_id, snapshot_id: snapshot_id) do
      nil -> {:error, :public_body_missing}
      body -> {:ok, ArticleBodyDocument.document(body)}
    end
  end

  @doc "Loads the current public selection for a stable Article."
  @spec get(Article.t()) :: {:ok, ArticlePublic.t()} | {:error, :not_found}
  def get(%Article{id: article_id}) do
    case Repo.get(ArticlePublic, article_id) do
      %ArticlePublic{} = public -> {:ok, public}
      nil -> {:error, :not_found}
    end
  end

  defp write(previous, snapshot, actor_id, published_at) do
    document = Body.document(snapshot)

    attrs = %{
      article_id: snapshot.article_id,
      snapshot_id: snapshot.id,
      published_at: published_at,
      published_by_id: actor_id,
      title: snapshot.title,
      digest: snapshot.digest,
      slug: snapshot.slug,
      plain_text: document.plain_text,
      thumbnail: document.thumbnail
    }

    with {:ok, public} <-
           (previous || %ArticlePublic{})
           |> ArticlePublic.changeset(attrs)
           |> Repo.insert_or_update(),
         body = Repo.get(ArticlePublicBody, snapshot.article_id) || %ArticlePublicBody{},
         {:ok, body} <-
           body
           |> ArticlePublicBody.changeset(
             Map.merge(document, %{article_id: snapshot.article_id, snapshot_id: snapshot.id})
           )
           |> Repo.insert_or_update() do
      {:ok, %{public | body: body}}
    end
  end

  defp lock_article(id), do: Repo.one(from(a in Article, where: a.id == ^id, lock: "FOR UPDATE"))

  defp lock_public(id) do
    Repo.one(from(p in ArticlePublic, where: p.article_id == ^id, lock: "FOR UPDATE"))
  end

  defp in_transaction(fun) do
    if Repo.in_transaction?(), do: Repo.transact(fun), else: {:error, :transaction_required}
  end
end
