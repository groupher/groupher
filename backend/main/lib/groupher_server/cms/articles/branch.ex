defmodule GroupherServer.CMS.Articles.Branch do
  @moduledoc """
  Resolves the shared branch coordinate for every Article lifecycle.

      product boundary
            |
            | community + thread + optional branch ref
            v
      ArticleBranch(main | preview)
            |
            +--> Draft / Snapshot / Diff / Restore
            |
            +--> main only: official Publish

  Missing branch input resolves to the per-Community, per-thread `main` branch.
  Core lifecycle modules receive the resolved row and never guess a branch.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Artiment.Threads
  alias CMS.Model.{ArticleBranch, Community}
  alias Helper.{ORM, Transaction}

  require CMS.Const

  @main_slug "main"

  @doc "Returns the canonical slug of every thread's official branch."
  @spec main_slug() :: String.t()
  def main_slug, do: @main_slug

  @doc """
  Resolves an Article branch in the given Community and thread.

  Accepted references are an `ArticleBranch`, database id, slug, or an option
  map/list containing `branch_id`, `branch`, or `branch_slug`.
  """
  @spec resolve(
          Community.t(),
          atom(),
          ArticleBranch.t() | integer() | String.t() | map() | list()
        ) ::
          {:ok, ArticleBranch.t()} | {:error, term()}
  def resolve(community, thread, branch_ref \\ [])

  def resolve(%Community{} = community, thread, %ArticleBranch{} = branch) do
    if branch.community_id == community.id and branch.thread == thread do
      {:ok, branch}
    else
      {:error, {:custom, "Article branch does not belong to the requested scope"}}
    end
  end

  def resolve(%Community{} = community, thread, opts) when is_map(opts) or is_list(opts) do
    branch_ref = option(opts, :branch_id) || option(opts, :branch) || option(opts, :branch_slug)
    resolve_ref(community, thread, branch_ref)
  end

  def resolve(%Community{} = community, thread, branch_ref) do
    resolve_ref(community, thread, branch_ref)
  end

  @doc "Resolves a branch and returns its database id."
  @spec branch_id(
          Community.t(),
          atom(),
          ArticleBranch.t() | integer() | String.t() | map() | list()
        ) ::
          {:ok, integer()} | {:error, term()}
  def branch_id(%Community{} = community, thread, branch_ref \\ []) do
    with {:ok, branch} <- resolve(community, thread, branch_ref), do: {:ok, branch.id}
  end

  @doc "Returns whether the branch is the official main branch."
  @spec main?(ArticleBranch.t()) :: boolean()
  def main?(%ArticleBranch{type: type}), do: type == CMS.Const.article_branch_type(:main)

  @doc "Returns whether the branch is an isolated preview branch."
  @spec preview?(ArticleBranch.t()) :: boolean()
  def preview?(%ArticleBranch{type: type}), do: type == CMS.Const.article_branch_type(:preview)

  @doc "Creates an isolated draft-only Preview branch sourced from main or another branch."
  @spec create_preview(Community.t(), atom(), map(), User.t()) ::
          {:ok, ArticleBranch.t()} | {:error, term()}
  def create_preview(%Community{} = community, thread, attrs, %User{} = user) do
    source_ref = option(attrs, :source_branch_id) || @main_slug

    with {:ok, source_branch} <- resolve(community, thread, source_ref) do
      ORM.create(ArticleBranch, %{
        community_id: community.id,
        thread: thread,
        source_branch_id: source_branch.id,
        created_by_id: user.id,
        slug: option(attrs, :slug),
        title: option(attrs, :title) || option(attrs, :slug),
        type: CMS.Const.article_branch_type(:preview),
        status: CMS.Const.article_branch_status(:active)
      })
    end
  end

  defp resolve_ref(%Community{} = community, thread, nil), do: ensure_main(community, thread)
  defp resolve_ref(%Community{} = community, thread, ""), do: ensure_main(community, thread)

  defp resolve_ref(%Community{} = community, thread, @main_slug) do
    ensure_main(community, thread)
  end

  defp resolve_ref(%Community{} = community, thread, id) when is_integer(id) do
    ORM.find_by(ArticleBranch, id: id, community_id: community.id, thread: thread)
  end

  defp resolve_ref(%Community{} = community, thread, ref) when is_binary(ref) do
    ArticleBranch
    |> where([branch], branch.community_id == ^community.id)
    |> where([branch], branch.thread == ^thread)
    |> where([branch], branch.slug == ^ref or fragment("?::text", branch.id) == ^ref)
    |> limit(1)
    |> Repo.one()
    |> case do
      %ArticleBranch{} = branch -> {:ok, branch}
      nil -> {:error, {:custom, "Article branch not found"}}
    end
  end

  defp resolve_ref(_community, _thread, _ref) do
    {:error, {:custom, "Article branch is invalid"}}
  end

  defp ensure_main(%Community{} = community, thread) do
    if thread in Threads.article_enums() do
      Transaction.lock_global("article_branch:init:#{community.id}:#{thread}:#{@main_slug}", fn ->
        case ORM.find_by(ArticleBranch,
               community_id: community.id,
               thread: thread,
               slug: @main_slug
             ) do
          {:ok, branch} ->
            {:ok, branch}

          {:error, _} ->
            ORM.create(ArticleBranch, %{
              community_id: community.id,
              thread: thread,
              slug: @main_slug,
              title: @main_slug,
              type: CMS.Const.article_branch_type(:main),
              status: CMS.Const.article_branch_status(:active)
            })
        end
      end)
    else
      {:error, {:custom, "Article thread does not support branches"}}
    end
  end

  defp option(opts, key) when is_map(opts) do
    Map.get(opts, key) || Map.get(opts, Atom.to_string(key))
  end

  defp option(opts, key) when is_list(opts), do: Keyword.get(opts, key)
end
