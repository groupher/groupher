defmodule GroupherServer.CMS.Articles.BindingTrashPersist do
  @moduledoc """
  Stores non-Doc Community-local hide facts in the caller-owned transaction.

      authorized Command -> locked Binding -> hide / restore fact

  Gate, Activity, Receipt and Outbox belong to the calling Command.
  """
  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.ErrorCat
  alias CMS.Model.{Article, ArticleBinding, ArticleBindingTrash, Community}

  @threads [:post, :blog, :changelog]

  @doc "Creates or returns the Community-local hide fact for an ordinary Article Binding. Requires the caller's transaction and locked Binding."
  def hide(%Article{thread: thread} = article, %Community{} = community, %User{} = actor)
      when thread in @threads do
    with {:ok, binding} <- lock_binding(article, community) do
      now = DateTime.utc_now(:second)

      attrs = %{
        id: Ecto.UUID.generate(),
        community_id: community.id,
        article_id: article.id,
        binding_id: binding.id,
        actor_id: actor.id,
        revision: 1,
        hidden_at: now,
        inserted_at: now,
        updated_at: now
      }

      case Repo.insert_all(ArticleBindingTrash, [attrs], on_conflict: :nothing, returning: true) do
        {1, [row]} ->
          {:ok, %{row: row, binding: binding, changed?: true}}

        {0, []} ->
          case Repo.one(
                 from(t in ArticleBindingTrash,
                   where: t.binding_id == ^binding.id,
                   lock: "FOR UPDATE"
                 )
               ) do
            %ArticleBindingTrash{} = row -> {:ok, %{row: row, binding: binding, changed?: false}}
            nil -> {:error, ErrorCat.binding_trash_revision_conflict()}
          end
      end
    end
  end

  def hide(%Article{}, %Community{}, %User{}), do: {:error, :unsupported_thread}
  def hide(_, _, _), do: {:error, :invalid_article_binding}

  @doc "Removes the matching revision-1 Community hide fact under the caller's transaction."
  def restore(%Article{thread: thread} = article, %Community{} = community, id, "1")
      when thread in @threads and is_binary(id) do
    with {:ok, id} <- Ecto.UUID.cast(id),
         {:ok, binding} <- lock_binding(article, community),
         %ArticleBindingTrash{} = row <-
           Repo.one(
             from(t in ArticleBindingTrash,
               where:
                 t.id == ^id and t.community_id == ^community.id and t.article_id == ^article.id and
                   t.binding_id == ^binding.id and t.revision == 1,
               lock: "FOR UPDATE"
             )
           ),
         {:ok, _} <- Repo.delete(row) do
      {:ok, %{row: row, binding: binding, changed?: true}}
    else
      nil -> {:error, ErrorCat.binding_trash_revision_conflict()}
      :error -> {:error, ErrorCat.invalid_command_input()}
      {:error, _} = error -> error
    end
  end

  def restore(%Article{thread: thread}, %Community{}, _id, _revision) when thread in @threads do
    {:error, ErrorCat.invalid_binding_trash_revision()}
  end

  def restore(%Article{}, %Community{}, _, _), do: {:error, :unsupported_thread}
  def restore(_, _, _, _), do: {:error, :invalid_article_binding}

  defp lock_binding(%Article{} = article, %Community{} = community) do
    if Repo.in_transaction?() do
      case Repo.one(
             from(b in ArticleBinding,
               where:
                 b.article_id == ^article.id and
                   b.community_id == ^community.id,
               lock: "FOR UPDATE"
             )
           ) do
        %ArticleBinding{} = binding -> {:ok, binding}
        nil -> {:error, ErrorCat.binding_not_found()}
      end
    else
      {:error, :transaction_required}
    end
  end
end
