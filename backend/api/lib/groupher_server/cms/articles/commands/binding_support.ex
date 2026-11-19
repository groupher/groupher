defmodule GroupherServer.CMS.Articles.Commands.BindingSupport do
  @moduledoc """
  Shares Article loading, confirmation presentation, and cache invalidation across binding commands.

      Commands.Mirror/Move/Unmirror/Pin/Unpin
        -> BindingSupport
        -> FrontDesk / Query / Outbox
  """

  alias GroupherServer.CMS
  alias CMS.Articles.{Bindings, Commands.BindingConfirmation, Effects}
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias CMS.FrontDesk
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias CMS.Model.{Article, ArticleBinding, Community, PinnedArticle}

  def load_article(article_id) when is_binary(article_id) do
    case FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{} = article} -> {:ok, article}
      {:error, _reason} -> {:error, GateErrorCat.resource_not_found()}
    end
  end

  def ensure_ordinary(%Article{thread: :doc}), do: {:error, :unsupported_for_doc}

  def ensure_ordinary(%Article{thread: :ticket}) do
    {:error, ArticleErrorCat.ticket_binding_unsupported()}
  end

  def ensure_ordinary(%Article{}), do: {:ok, :supported}

  def confirmation(article, community, command_id) do
    %BindingConfirmation{
      data: %{
        "article_id" => article.id,
        "community_id" => community.id,
        "command_id" => command_id
      }
    }
  end

  def present_binding({:ok, %BindingConfirmation{data: data}}) do
    case Bindings.fetch_binding(data["article_id"], data["community_id"]) do
      {:ok, %ArticleBinding{} = binding} ->
        {:ok, Map.put(binding, :command_id, data["command_id"])}

      {:error, _reason} ->
        {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  def present_binding(error), do: error

  def present_article({:ok, %BindingConfirmation{data: data}}) do
    case FrontDesk.article(data["article_id"], mode: :internal) do
      {:ok, %Article{} = article} -> {:ok, Map.put(article, :command_id, data["command_id"])}
      {:error, _reason} -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  def present_article(error), do: error

  def present_pin({:ok, %BindingConfirmation{data: data}}) do
    case Bindings.fetch_pin(data["article_id"], data["community_id"]) do
      {:ok, %PinnedArticle{} = pin} ->
        {:ok, Map.put(pin, :command_id, data["command_id"])}

      {:error, _reason} ->
        {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  def present_pin(error), do: error

  def present_done({:ok, %BindingConfirmation{}}), do: {:ok, :done}
  def present_done(error), do: error

  def invalidate_scope(_community, %{inner_id: inner_id}, _thread, _operation_ref)
      when not is_integer(inner_id) do
    {:ok, :pass}
  end

  def invalidate_scope(
        %Community{} = community,
        %{article_id: article_id, inner_id: inner_id},
        thread,
        operation_ref
      ) do
    case Effects.enqueue(
           "article.visibility_changed",
           "article",
           article_id,
           operation_ref,
           %{
             community: community.slug,
             community_id: community.id,
             thread: thread,
             inner_id: inner_id,
             article_id: article_id
           }
         ) do
      {:ok, _event} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
    end
  end
end
