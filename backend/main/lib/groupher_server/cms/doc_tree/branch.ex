defmodule GroupherServer.CMS.DocTree.Branch do
  @moduledoc """
  Resolves the branch context for docs tree workflows.

  Current dashboard calls omit branch information, so they resolve to the
  per-community `main` branch. Future branch preview UI can pass a branch slug
  or id through the same API surface without changing the publish/write internals.

      caller opts
          |
          v
      branch_id / branch_slug / branch
          |
          +--> explicit branch row
          |
          +--> nil / "" / "main"
                    |
                    v
               ensure per-community main branch
                    |
                    v
               branch-scoped doc tree workflow
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, DocsBranch}
  alias Helper.{ORM, Transaction}

  require CMS.Const

  @main_slug "main"

  @doc """
  Returns the canonical default docs branch slug.
  """
  def main_slug, do: @main_slug

  @doc """
  Resolves a branch from opts, a branch row, id, slug, or the implicit main branch.
  """
  def resolve(community, opts \\ [])

  def resolve(%Community{} = community, %DocsBranch{} = branch) do
    if branch.community_id == community.id do
      {:ok, branch}
    else
      {:error, {:custom, "docs branch does not belong to this community"}}
    end
  end

  def resolve(%Community{} = community, opts) when is_map(opts) or is_list(opts) do
    branch_ref = option(opts, :branch_id) || option(opts, :branch) || option(opts, :branch_slug)
    resolve_ref(community, branch_ref)
  end

  def resolve(%Community{} = community, branch_ref), do: resolve_ref(community, branch_ref)

  @doc """
  Resolves the branch and returns only its database id.
  """
  def branch_id(%Community{} = community, opts \\ []) do
    with {:ok, branch} <- resolve(community, opts), do: {:ok, branch.id}
  end

  defp resolve_ref(%Community{} = community, nil), do: ensure_main(community)
  defp resolve_ref(%Community{} = community, ""), do: ensure_main(community)
  defp resolve_ref(%Community{} = community, @main_slug), do: ensure_main(community)

  defp resolve_ref(%Community{} = community, id) when is_integer(id) do
    ORM.find_by(DocsBranch, id: id, community_id: community.id)
  end

  defp resolve_ref(%Community{} = community, ref) when is_binary(ref) do
    query =
      DocsBranch
      |> where([branch], branch.community_id == ^community.id)
      |> where([branch], branch.slug == ^ref or fragment("?::text", branch.id) == ^ref)
      |> limit(1)

    case Repo.one(query) do
      %DocsBranch{} = branch -> {:ok, branch}
      nil -> {:error, {:custom, "docs branch not found"}}
    end
  end

  defp resolve_ref(_community, _ref), do: {:error, {:custom, "docs branch is invalid"}}

  defp ensure_main(%Community{} = community) do
    Transaction.lock_global("docs_branch:init:#{community.id}:#{@main_slug}", fn ->
      case ORM.find_by(DocsBranch, community_id: community.id, slug: @main_slug) do
        {:ok, branch} ->
          {:ok, branch}

        {:error, _} ->
          ORM.create(DocsBranch, %{
            community_id: community.id,
            slug: @main_slug,
            title: @main_slug,
            kind: CMS.Const.docs_branch_kind(:main),
            status: CMS.Const.docs_branch_status(:active)
          })
      end
    end)
  end

  defp option(opts, key) when is_map(opts) do
    Map.get(opts, key) || Map.get(opts, Atom.to_string(key))
  end

  defp option(opts, key) when is_list(opts), do: Keyword.get(opts, key)
end
