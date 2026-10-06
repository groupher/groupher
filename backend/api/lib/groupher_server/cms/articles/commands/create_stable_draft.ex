defmodule GroupherServer.CMS.Articles.Commands.CreateStableDraft do
  @moduledoc """
  Creates the stable Article aggregate and its first mutable Draft workspace.

      CMS.Articles.create_stable_draft
        -> CreateStableDraft.execute
        -> Draft.Store.create
  """

  alias GroupherServer.CMS
  alias GroupherServer.Accounts.Model.User
  alias CMS.Articles
  alias GroupherServer.CMS.Articles.Draft.Store
  alias CMS.Command
  alias CMS.FrontDesk
  alias GroupherServer.CMS.Model.{Author, Community}
  alias CMS.Articles.Commands.CreateStableDraftConfirmation, as: Confirmation

  @spec execute(Community.t(), atom(), map(), User.t() | Author.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def execute(%Community{} = community, thread, attrs, %User{} = actor, opts) do
    with {:ok, author} <- target_author(actor) do
      case Keyword.get(opts, :command_id) do
        nil ->
          Store.create(community, thread, attrs, author, opts)

        command_id ->
          execute_command(community, thread, attrs, actor, author, command_id, opts)
      end
    end
  end

  def execute(%Community{} = community, thread, attrs, %Author{} = author, opts) do
    case Keyword.get(opts, :command_id) do
      nil -> Store.create(community, thread, attrs, author, opts)
      _command_id -> {:error, :command_actor_required}
    end
  end

  def execute(_community, _thread, _attrs, _actor, _opts), do: {:error, :invalid_actor}

  defp execute_command(community, thread, attrs, actor, author, command_id, opts) do
    command_opts = Keyword.delete(opts, :command_id)

    %Command{
      actor: actor,
      command_id: command_id,
      operation: :article_create_draft,
      target: {:article_draft, community.id},
      params: %{thread: thread, attrs: attrs, opts: Map.new(command_opts)}
    }
    |> Command.execute(
      action: fn _command ->
        with {:ok, %{article: article}} <-
               Store.create(community, thread, attrs, author, command_opts) do
          {:ok,
           %Confirmation{
             data: %{
               "article_id" => article.id,
               "branch_id" => Keyword.get(command_opts, :branch_id, 0)
             }
           }}
        end
      end,
      confirmation: Confirmation
    )
    |> present_confirmation()
  end

  defp present_confirmation(
         {:ok, %Confirmation{data: %{"article_id" => article_id, "branch_id" => branch_id}}}
       ) do
    with {:ok, article} <- FrontDesk.article(article_id, mode: :internal),
         {:ok, draft} <- Store.get(article, draft_opts(branch_id)) do
      {:ok, %{article: article, draft: draft}}
    else
      _ -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp present_confirmation(error), do: error

  defp draft_opts(branch_id) when is_integer(branch_id) and branch_id > 0 do
    [branch_id: branch_id]
  end

  defp draft_opts(_branch_id), do: []

  defp target_author(%User{} = user), do: Articles.Writer.ensure_author_exists(user)
end
