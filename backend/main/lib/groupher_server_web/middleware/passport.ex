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
          -> read cur_user.cur_passport[community_slug]["cms"]
          -> check if that community whitelist contains required grant
          -> true: allow, false/missing: deny

  Notes:

  - `community_slug` comes from request arguments, then selects one community whitelist bucket.
  - `grant_by_thread` requirements are expanded at runtime into concrete grants via `thread` argument.
  - Article mutations parse `arguments.article` into `arguments.article_path` here, but the
    article is still loaded later by the `FrontDesk` article middleware.
  - `global.god == true` bypasses normal checks.
  - `<community_slug>.root == true` bypasses checks only inside that community.
  """

  @behaviour Absinthe.Middleware

  import Helper.Utils
  import Helper.ErrorCode

  alias GroupherServer.FrontDesk
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Helper.ArticlePath
  alias GroupherServer.CMS.Model.Comment
  alias Helper.PermissionRegistry

  def call(%{errors: errors} = resolution, _) when length(errors) > 0 do
    resolution
  end

  def call(resolution, opts) when is_list(opts) do
    case Keyword.fetch(opts, :action) do
      {:ok, action} when is_binary(action) -> authorize_action(resolution, action, opts)
      _ -> missing_action(resolution)
    end
  end

  def call(resolution, _) do
    missing_action(resolution)
  end

  defp authorize_action(resolution, action, opts) do
    case PermissionRegistry.requirement(action) do
      {:ok, requirement} ->
        case maybe_put_article_path(resolution, opts) do
          {:ok, resolution} -> check_requirement(resolution, requirement)
          {:error, :invalid_article_path} -> invalid_article_path(resolution)
        end

      {:error, :unknown_action} ->
        resolution
        |> handle_absinthe_error("PassportError: unknown action #{action}.", ecode(:passport))
    end
  end

  defp check_requirement(resolution, requirement) do
    if owner_pass?(resolution, requirement) do
      resolution
    else
      with {:ok, cur_passport} <- fetch_cur_passport(resolution),
           true <- has_permission?(cur_passport, resolution, requirement) do
        resolution
      else
        {:error, :missing_passport} ->
          passport_denied(resolution)

        false ->
          passport_denied(resolution)
      end
    end
  end

  defp maybe_put_article_path(%{arguments: arguments} = resolution, opts)
       when is_map(arguments) do
    if Map.has_key?(arguments, :article) or Map.has_key?(arguments, :article_path) do
      # Passport runs before article loading, so it can only prepare the public
      # locator for permission checks. It must not load the article here.
      case ArticlePath.parse_arguments(arguments, Keyword.take(opts, [:thread])) do
        {:ok, arguments} -> {:ok, %{resolution | arguments: arguments}}
        {:error, :invalid_article_path} -> {:error, :invalid_article_path}
      end
    else
      {:ok, resolution}
    end
  end

  defp maybe_put_article_path(resolution, _), do: {:ok, resolution}

  defp missing_action(resolution) do
    resolution
    |> handle_absinthe_error("PassportError: action is required.", ecode(:passport))
  end

  defp invalid_article_path(resolution) do
    resolution
    |> handle_absinthe_error("invalid article input", ecode(:custom))
  end

  defp passport_denied(resolution) do
    resolution
    |> handle_absinthe_error(
      "PassportError: your passport not qualified.",
      ecode(:passport)
    )
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

    has_god_permission?(normalized_passport) or
      check_scope_permission(normalized_passport, resolution, requirement)
  end

  defp check_scope_permission(
         passport,
         resolution,
         %{scope: :context, context: context} = requirement
       ) do
    with {:ok, community} <- fetch_community_slug(resolution),
         {:ok, grant} <- resolve_grant(requirement, resolution) do
      get_in(passport, [community, "root"]) == true or
        get_in(passport, [community, to_string(context), grant]) == true
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

  defp check_scope_permission(_passport, _resolution, %{owner_fallback: true, grant: nil}),
    do: false

  defp check_scope_permission(_passport, _resolution, %{owner_fallback: true}), do: false
  defp check_scope_permission(_passport, _resolution, _), do: false

  defp resolve_grant(%{grant: grant}, _resolution) when is_binary(grant), do: {:ok, grant}

  defp resolve_grant(%{grant_by_thread: suffix}, resolution) do
    with {:ok, thread} <- fetch_thread(resolution) do
      {:ok, "#{thread}.#{suffix}"}
    end
  end

  defp resolve_grant(_, _), do: {:error, :invalid_requirement}

  defp fetch_thread(%{arguments: %{article_path: %{thread: thread}}}) when is_atom(thread),
    do: {:ok, Atom.to_string(thread)}

  defp fetch_thread(%{arguments: %{thread: thread}}) when is_atom(thread),
    do: {:ok, Atom.to_string(thread)}

  defp fetch_thread(%{arguments: %{thread: thread}}) when is_binary(thread), do: {:ok, thread}
  defp fetch_thread(_), do: {:error, :missing_thread}

  defp fetch_community_slug(%{arguments: %{article_path: %{community: %{slug: slug}}}})
       when is_binary(slug),
       do: {:ok, slug}

  defp fetch_community_slug(%{arguments: %{article_path: %{community: community}}})
       when is_binary(community),
       do: {:ok, community}

  defp fetch_community_slug(%{arguments: %{community: %{slug: slug}}}) when is_binary(slug),
    do: {:ok, slug}

  defp fetch_community_slug(%{arguments: %{community: community}}) when is_binary(community),
    do: {:ok, community}

  defp fetch_community_slug(%{arguments: %{input: %{community: community}}})
       when is_binary(community),
       do: {:ok, community}

  defp fetch_community_slug(_), do: {:error, :missing_community}

  defp has_global_permission?(passport, permission) do
    get_in(passport, ["global", permission]) == true
  end

  defp has_god_permission?(passport) do
    has_global_permission?(passport, "god")
  end

  defp infer_owner?(%{
         context: %{cur_user: cur_user},
         arguments: %{article_path: %{community: community, thread: thread, inner_id: inner_id}}
       })
       when not is_nil(cur_user) do
    case apply(FrontDesk, :article, [community_slug(community), thread, inner_id]) do
      {:ok, article} -> article.author.user.id == cur_user.id
      _ -> false
    end
  end

  defp infer_owner?(%{
         context: %{cur_user: cur_user},
         arguments: %{comment: %Comment{author: %User{id: author_id}}}
       })
       when not is_nil(cur_user) do
    author_id == cur_user.id
  end

  defp infer_owner?(%{arguments: %{comment: %Comment{}}}), do: false

  defp infer_owner?(%{context: %{cur_user: cur_user}, arguments: %{comment: comment_path}})
       when not is_nil(cur_user) and is_map(comment_path) do
    case apply(FrontDesk, :comment, [comment_path]) do
      {:ok, %Comment{author: %User{id: author_id}}} -> author_id == cur_user.id
      _ -> false
    end
  end

  defp infer_owner?(_), do: false

  defp community_slug(%{slug: slug}) when is_binary(slug), do: slug
  defp community_slug(community) when is_binary(community), do: community
  defp community_slug(_), do: nil
end
