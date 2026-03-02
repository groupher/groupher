# ---
# Absinthe.Middleware behaviour
# see https://hexdocs.pm/absinthe/Absinthe.Middleware.html#content
# ---
defmodule GroupherServerWeb.Middleware.Passport do
  @moduledoc """
  Action-based passport check middleware.
  """

  @behaviour Absinthe.Middleware

  import Helper.Utils
  import Helper.ErrorCode

  alias GroupherServer.FrontDesk
  alias Helper.PermissionRegistry

  def call(%{errors: errors} = resolution, _) when length(errors) > 0 do
    resolution
  end

  def call(resolution, action: action) when is_binary(action) do
    with {:ok, requirement} <- PermissionRegistry.requirement(action) do
      if owner_pass?(resolution, requirement) do
        resolution
      else
        with {:ok, cur_passport} <- fetch_cur_passport(resolution),
             true <- has_permission?(cur_passport, resolution, requirement) do
          resolution
        else
          {:error, :missing_passport} ->
            resolution
            |> handle_absinthe_error(
              "PassportError: your passport not qualified.",
              ecode(:passport)
            )

          false ->
            resolution
            |> handle_absinthe_error(
              "PassportError: your passport not qualified.",
              ecode(:passport)
            )
        end
      end
    else
      {:error, :unknown_action} ->
        resolution
        |> handle_absinthe_error("PassportError: unknown action #{action}.", ecode(:passport))
    end
  end

  def call(resolution, _) do
    resolution
    |> handle_absinthe_error("PassportError: action is required.", ecode(:passport))
  end

  defp owner_pass?(%{arguments: %{passport_is_owner: true}}, %{owner_fallback: true}), do: true
  defp owner_pass?(resolution, %{owner_fallback: true}), do: infer_owner?(resolution)
  defp owner_pass?(_, _), do: false

  defp fetch_cur_passport(%{context: %{cur_user: %{cur_passport: cur_passport}}})
       when is_map(cur_passport),
       do: {:ok, cur_passport}

  defp fetch_cur_passport(_), do: {:error, :missing_passport}

  defp has_permission?(cur_passport, resolution, requirement) do
    cms_passport =
      cur_passport
      |> Map.get("cms", PermissionRegistry.empty_rules())
      |> PermissionRegistry.normalize_rules()

    has_root_permission?(cms_passport) or
      check_scope_permission(cms_passport, resolution, requirement)
  end

  defp check_scope_permission(cms_passport, _resolution, %{scope: :global, permission: permission}),
       do: has_global_permission?(cms_passport, permission)

  defp check_scope_permission(cms_passport, resolution, %{scope: :thread} = requirement) do
    with {:ok, permission} <- resolve_permission(requirement, resolution) do
      has_global_permission?(cms_passport, permission)
    else
      _ -> false
    end
  end

  defp check_scope_permission(cms_passport, resolution, %{scope: scope} = requirement)
       when scope in [:community, :community_thread] do
    with {:ok, community} <- fetch_community_slug(resolution),
         {:ok, permission} <- resolve_permission(requirement, resolution) do
      get_in(cms_passport, ["communities", community, permission]) == true
    else
      _ -> false
    end
  end

  defp check_scope_permission(_cms_passport, _resolution, %{owner_fallback: true, permission: nil}),
       do: false

  defp check_scope_permission(_cms_passport, _resolution, %{owner_fallback: true}), do: false
  defp check_scope_permission(_cms_passport, _resolution, _), do: false

  defp resolve_permission(%{permission: permission}, _resolution) when is_binary(permission),
    do: {:ok, permission}

  defp resolve_permission(%{permission_template: template}, resolution) do
    with {:ok, thread} <- fetch_thread(resolution) do
      {:ok, String.replace(template, "{thread}", thread)}
    end
  end

  defp resolve_permission(_, _), do: {:error, :invalid_requirement}

  defp fetch_thread(%{arguments: %{thread: thread}}) when is_atom(thread),
    do: {:ok, Atom.to_string(thread)}

  defp fetch_thread(%{arguments: %{thread: thread}}) when is_binary(thread), do: {:ok, thread}
  defp fetch_thread(_), do: {:error, :missing_thread}

  defp fetch_community_slug(%{arguments: %{community: %{slug: slug}}}) when is_binary(slug),
    do: {:ok, slug}

  defp fetch_community_slug(%{arguments: %{community: community}}) when is_binary(community),
    do: {:ok, community}

  defp fetch_community_slug(_), do: {:error, :missing_community}

  defp has_global_permission?(cms_passport, permission) do
    get_in(cms_passport, ["global", permission]) == true
  end

  defp has_root_permission?(cms_passport) do
    has_global_permission?(cms_passport, "root") or
      has_global_permission?(cms_passport, "root.spec")
  end

  defp infer_owner?(%{
         context: %{cur_user: cur_user},
         arguments: %{id: id, thread: thread, community: community}
       })
       when not is_nil(cur_user) do
    case FrontDesk.article(community_slug(community), thread, id) do
      {:ok, article} -> article.author.user.id == cur_user.id
      _ -> false
    end
  end

  defp infer_owner?(%{context: %{cur_user: cur_user}, arguments: %{id: id}})
       when not is_nil(cur_user) do
    case FrontDesk.comment(id) do
      {:ok, comment} -> comment.author.id == cur_user.id
      _ -> false
    end
  end

  defp infer_owner?(_), do: false

  defp community_slug(%{slug: slug}) when is_binary(slug), do: slug
  defp community_slug(community) when is_binary(community), do: community
  defp community_slug(_), do: nil
end
