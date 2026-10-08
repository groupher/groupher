defmodule GroupherServer.CMS.Articles.Commands.Pin do
  @moduledoc """
  Pins one ordinary Article binding after authorization and capacity validation.

      CMS.Articles.pin -> CMS.Command -> Gate -> capacity check -> PinnedArticle
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.Commands.{BindingConfirmation, BindingSupport}
  alias CMS.Command
  alias CMS.Model.{Article, ArticleBinding, Community, PinnedArticle}

  @doc "Executes or replays one authorized Community-local pin command."
  def execute(community, article_id, %User{} = actor, command_id) do
    with {:ok, article} <- BindingSupport.load_article(article_id),
         {:ok, :supported} <- BindingSupport.ensure_ordinary(article) do
      %Command{
        actor: actor,
        command_id: command_id,
        operation: :article_pin,
        target: article,
        params: %{community_id: community.id}
      }
      |> Command.execute(action: &pin_action(&1, community), confirmation: BindingConfirmation)
      |> BindingSupport.present_pin()
    end
  end

  defp pin_action(%{actor: actor, target: article, command_id: command_id}, community) do
    CMS.Gate.Access.with_community_check(actor, :pin, community, article, fn canonical ->
      with {:ok, :pass} <- ensure_capacity(community.id, canonical.thread),
           {:ok, _pin} <- insert_pin(canonical, community) do
        {:ok, BindingSupport.confirmation(canonical, community, command_id)}
      end
    end)
  end

  defp ensure_capacity(community_id, thread) do
    count =
      Repo.aggregate(
        from(pin in PinnedArticle,
          where: pin.community_id == ^community_id and pin.thread == ^thread
        ),
        :count
      )

    if count < Community.max_pinned_article_count_per_thread() do
      {:ok, :pass}
    else
      {:error, CMS.Articles.ErrorCat.too_much_pinned_article("too much pinned article")}
    end
  end

  defp insert_pin(%Article{} = article, %Community{} = community) do
    case Repo.get_by(ArticleBinding, article_id: article.id, community_id: community.id) do
      %ArticleBinding{} = binding -> upsert_pin(binding, community, article.thread)
      nil -> {:error, :article_binding_not_found}
    end
  end

  defp upsert_pin(binding, community, thread) do
    case Repo.get_by(PinnedArticle, article_binding_id: binding.id) do
      %PinnedArticle{} = pin ->
        {:ok, pin}

      nil ->
        %PinnedArticle{}
        |> PinnedArticle.changeset(%{
          article_binding_id: binding.id,
          community_id: community.id,
          thread: thread
        })
        |> Repo.insert()
    end
  end
end
