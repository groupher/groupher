defmodule GroupherServer.CMS.Articles.CommunityTrashQuery do
  @moduledoc """
  Reads one Community's authorized ordinary Binding Trash without expanding Article bodies.

      Community ref + actor + thread -> Passport -> paged local Trash facts
  """
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.ErrorCat
  alias CMS.Model.{Article, ArticleBindingTrash, ArticlePublic, Community}
  alias Helper.ORM
  alias Helper.ORM.Pagi.Order

  @ordinary [:post, :blog, :changelog]

  def page(%Community{} = community, actor, thread, pagi) when thread in @ordinary do
    with {:ok, :pass} <- authorize(community, actor, thread),
         {:ok, page} <-
           ORM.pagi(query(community, thread), pagi,
             for: ArticleBindingTrash,
             surface: "community.article.trash",
             query_fingerprint: Base.encode64(:erlang.term_to_binary({community.id, thread})),
             cursor_value_func: fn {row, _title}, fields -> Map.take(row, fields) end,
             order: %Order{
               fields: [:inserted_at, :id],
               directions: [:desc, :desc],
               cursor_fields: [:inserted_at, :id]
             }
           ) do
      {:ok,
       Map.update!(
         page,
         :entries,
         &Enum.map(&1, fn {row, title} -> project(row, thread, title) end)
       )}
    end
  end

  def page(%Community{}, _actor, thread, _pagi) when thread in [:doc, :ticket],
    do: {:error, ErrorCat.unsupported_community_trash_thread()}

  def page(_, _, _, _), do: {:error, ErrorCat.unsupported_community_trash_thread()}

  def get(%Community{} = community, actor, thread, id)
      when thread in @ordinary and is_binary(id) do
    with {:ok, :pass} <- authorize(community, actor, thread),
         {:ok, id} <- Ecto.UUID.cast(id),
         {row, title} <-
           Repo.one(
             from([trash, _article, _public] in query(community, thread), where: trash.id == ^id)
           ) do
      {:ok, project(row, thread, title)}
    else
      nil -> {:error, ErrorCat.binding_not_found()}
      :error -> {:error, ErrorCat.binding_not_found()}
      {:error, _} -> {:error, ErrorCat.binding_not_found()}
    end
  end

  def get(%Community{}, _actor, _thread, _id),
    do: {:error, ErrorCat.unsupported_community_trash_thread()}

  def get(_, _, _, _), do: {:error, ErrorCat.unsupported_community_trash_thread()}

  def authorize(%Community{} = community, actor, thread) when thread in @ordinary do
    with {:ok, scope} <- CMS.Passport.load_community_scope(actor, community),
         {:ok, true} <-
           CMS.Passport.allowed?(actor, scope, "community.article.trash.read", thread) do
      {:ok, :pass}
    else
      _ -> {:error, CMS.Gate.ErrorCat.permission_denied()}
    end
  end

  def authorize(_, _, _), do: {:error, ErrorCat.unsupported_community_trash_thread()}

  defp query(community, thread) do
    from(trash in ArticleBindingTrash,
      join: article in Article,
      on: article.id == trash.article_id,
      left_join: public in ArticlePublic,
      on: public.article_id == article.id,
      where: trash.community_id == ^community.id and article.thread == ^thread,
      select: {trash, public.title}
    )
  end

  defp project(row, thread, title) do
    %{
      id: row.id,
      article_id: row.article_id,
      community_id: row.community_id,
      binding_id: row.binding_id,
      thread: thread,
      status: :effective,
      public_visible: false,
      record_revision: "1",
      created_at: row.inserted_at,
      hidden_at: row.hidden_at,
      title: title
    }
  end
end
