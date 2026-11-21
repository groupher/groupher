defmodule GroupherServer.CMS.Articles.CoAuthors.Commands.LeaveMember do
  @moduledoc """
  Lets the current co-author leave one Article, cancelling pending requests.

      Receipt -> Article / User / member / request locks -> exit event
  """

  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.CoAuthors.Commands.RemoveMember
  alias CMS.Model.{Article, ArticleCoAuthor}

  defmodule Confirmation do
    @moduledoc """
    Receipt confirmation stores the exiting membership snapshot for replay after deletion.

        committed exit -> member identity snapshot -> Receipt replay -> exited member result
    """
    use GroupherServer.CMS.Command.ConfirmationDefinition,
      operation: :article_co_author_member_leave,
      data_keys: ["article_id", "author_id", "joined_at", "member_id", "permissions", "revision"],
      field_types: %{
        "article_id" => :string,
        "author_id" => :integer,
        "joined_at" => :string,
        "member_id" => :string,
        "permissions" => :json,
        "revision" => :integer
      }
  end

  @pipeline operation: :article_co_author_member_leave,
            confirmation: Confirmation,
            target: :article,
            params: [:revision]
  receipt_pipeline run(article, revision, actor, command_id) do
    gate(fn canonical ->
      with {:ok, id} <- author_id(actor),
           %ArticleCoAuthor{id: member_id} <-
             Repo.get_by(ArticleCoAuthor, article_id: canonical.id, author_id: id) do
        RemoveMember.authorize_member(canonical, member_id, actor, :leave)
      else
        nil -> {:error, :article_co_author_not_found}
        {:error, _} = error -> error
      end
    end)

    change(fn canonical, operation ->
      with {:ok, author_id} <- author_id(actor),
           %ArticleCoAuthor{} = member <-
             Repo.get_by(ArticleCoAuthor, article_id: canonical.id, author_id: author_id),
           {:ok, removed} <-
             RemoveMember.remove_locked(
               canonical,
               member.id,
               revision,
               actor,
               operation,
               :leave
             ) do
        {:ok, removed}
      else
        nil -> {:error, :article_co_author_not_found}
        {:error, _} = error -> error
      end
    end)

    confirm(fn member ->
      {:ok,
       %Confirmation{
         data: %{
           "article_id" => member.article_id,
           "author_id" => member.author_id,
           "joined_at" => DateTime.to_iso8601(member.joined_at),
           "member_id" => member.id,
           "permissions" => member.permissions,
           "revision" => member.revision
         }
       }}
    end)

    present(fn %Confirmation{data: data} ->
      joined_at = DateTime.from_iso8601(data["joined_at"]) |> elem(1)

      {:ok,
       %ArticleCoAuthor{
         id: data["member_id"],
         article_id: data["article_id"],
         author_id: data["author_id"],
         joined_at: joined_at,
         permissions: data["permissions"],
         revision: data["revision"]
       }}
    end)
  end

  @doc "Removes the actor's current Article co-author membership."
  def execute(%Article{} = article, revision, %User{} = actor, command_id)
      when is_integer(revision) and revision > 0 and is_binary(command_id) do
    run(article, revision, actor, command_id)
  end

  def execute(_, _, _, _), do: {:error, :invalid_article_co_author_exit}

  defp author_id(%User{id: user_id}) do
    case Repo.get_by(CMS.Model.Author, user_id: user_id) do
      %CMS.Model.Author{id: id} -> {:ok, id}
      nil -> {:error, :article_co_author_not_found}
    end
  end
end
