defmodule GroupherServerWeb.Resolvers.CMS.ViewTracker do
  @moduledoc """
  Adapts article-view tracking and viewer-state fields to ViewTracker use cases.

      GraphQL view field -> this resolver -> CMS.ViewTracker facade
  """

  alias GroupherServer.{CMS, FrontDesk}
  alias GroupherServer.Accounts.Model.User

  @viewer_batch_size 100

  def track_article_view(_root, %{article: article_path}, info) do
    {viewer, actor_opts} = view_actor(info.context)

    with {:ok, classification} <- Map.fetch(info.context, :request_actor),
         {:ok, article} <- FrontDesk.article(article_path) do
      CMS.ViewTracker.track(
        article,
        viewer,
        classification,
        Keyword.put(actor_opts, :read_purpose, :public_read)
      )
    end
  end

  def article_viewer_states(_root, %{paths: paths}, info) do
    with {:ok, :pass} <- validate_viewer_batch(paths) do
      case Map.get(info.context, :cur_user) do
        %User{} = user -> CMS.ViewTracker.viewer_states_for_paths(paths, user)
        _ -> {:ok, []}
      end
    end
  end

  defp view_actor(%{delegated_actor: %{user_actor: viewer} = delegation}) do
    {viewer, delegation: delegation}
  end

  defp view_actor(%{service_actor: service}) do
    {nil, service_credential: service}
  end

  defp view_actor(%{service_auth_failure: _code}) do
    {nil, []}
  end

  defp view_actor(%{cur_user: viewer}) do
    {viewer, []}
  end

  defp view_actor(%{anonymous_session: session}) do
    {nil, anonymous_session: session}
  end

  defp view_actor(_context) do
    {nil, []}
  end

  defp validate_viewer_batch(paths) when is_list(paths) and length(paths) <= @viewer_batch_size do
    {:ok, :pass}
  end

  defp validate_viewer_batch(_paths) do
    {:error, "viewer batch cannot contain more than 100 paths"}
  end
end
