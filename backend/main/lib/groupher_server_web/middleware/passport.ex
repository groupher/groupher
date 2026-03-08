# ---
# Absinthe.Middleware behaviour
# see https://hexdocs.pm/absinthe/Absinthe.Middleware.html#content
# ---
defmodule GroupherServerWeb.Middleware.Passport do
  @moduledoc """
  Action-based passport check middleware.

  Permission check flow (wireframe):

      GraphQL field
          -> middleware(M.Passport, action: "...")
          -> PermissionRegistry.requirement(action)
          -> resolve_grant(requirement, resolution)
          -> read cur_user.cur_passport
          -> match grant in proper context scope

  Global action example (`community.create`):

      action: "community.create"
          -> requirement: %{scope: :global, grant: "community.create"}
          -> passport["global"]["community.create"] == true ? allow : deny

  Community-scoped action example (`post.edit` style):

      action (for post operations) -> requirement: %{scope: :context, context: :cms, grant: "post.*"}
          -> fetch community_slug from resolution.arguments.community
          -> read cur_user.cur_passport["cms"][community_slug]
          -> check if that community whitelist contains required grant
          -> true: allow, false/missing: deny

  Notes:

  - `community_slug` comes from request arguments, then selects one community whitelist bucket.
  - `grant_by_thread` requirements are expanded at runtime into concrete grants via `thread` argument.
  - `global.root == true` bypasses normal checks.
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
    case PermissionRegistry.requirement(action) do
      {:ok, requirement} ->
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
    normalized_passport = PermissionRegistry.normalize_rules(cur_passport)

    has_root_permission?(normalized_passport) or
      check_scope_permission(normalized_passport, resolution, requirement)
  end

  defp check_scope_permission(
         passport,
         resolution,
         %{scope: :context, context: context} = requirement
       ) do
    with {:ok, community} <- fetch_community_slug(resolution),
         {:ok, grant} <- resolve_grant(requirement, resolution) do
      get_in(passport, [to_string(context), community, grant]) == true
    else
      _ -> false
    end
  end

  defp check_scope_permission(passport, resolution, %{scope: :global} = requirement) do
    with {:ok, grant} <- resolve_grant(requirement, resolution) do
      has_global_permission?(passport, grant)
    else
      _ -> false
    end
  end

  defp check_scope_permission(_cms_passport, _resolution, %{owner_fallback: true, grant: nil}),
    do: false

  defp check_scope_permission(_cms_passport, _resolution, %{owner_fallback: true}), do: false
  defp check_scope_permission(_cms_passport, _resolution, _), do: false

  defp resolve_grant(%{grant: grant}, _resolution) when is_binary(grant), do: {:ok, grant}

  defp resolve_grant(%{grant_by_thread: suffix}, resolution) do
    with {:ok, thread} <- fetch_thread(resolution) do
      {:ok, "#{thread}.#{suffix}"}
    end
  end

  defp resolve_grant(_, _), do: {:error, :invalid_requirement}

  defp fetch_thread(%{arguments: %{thread: thread}}) when is_atom(thread),
    do: {:ok, Atom.to_string(thread)}

  defp fetch_thread(%{arguments: %{thread: thread}}) when is_binary(thread), do: {:ok, thread}
  defp fetch_thread(_), do: {:error, :missing_thread}

  defp fetch_community_slug(%{arguments: %{community: %{slug: slug}}}) when is_binary(slug),
    do: {:ok, slug}

  defp fetch_community_slug(%{arguments: %{community: community}}) when is_binary(community),
    do: {:ok, community}

  defp fetch_community_slug(_), do: {:error, :missing_community}

  defp has_global_permission?(passport, permission) do
    get_in(passport, ["global", permission]) == true
  end

  defp has_root_permission?(passport) do
    has_global_permission?(passport, "root")
  end

  defp infer_owner?(%{
         context: %{cur_user: cur_user},
         arguments: %{id: id, thread: thread, community: community}
       })
       when not is_nil(cur_user) do
    case apply(FrontDesk, :article, [community_slug(community), thread, id]) do
      {:ok, article} -> article.author.user.id == cur_user.id
      _ -> false
    end
  end

  defp infer_owner?(%{context: %{cur_user: cur_user}, arguments: %{id: id}})
       when not is_nil(cur_user) do
    case apply(FrontDesk, :comment, [id]) do
      {:ok, comment} -> comment.author.id == cur_user.id
      _ -> false
    end
  end

  defp infer_owner?(_), do: false

  defp community_slug(%{slug: slug}) when is_binary(slug), do: slug
  defp community_slug(community) when is_binary(community), do: community
  defp community_slug(_), do: nil
end
