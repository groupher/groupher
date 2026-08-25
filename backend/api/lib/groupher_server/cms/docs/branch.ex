defmodule GroupherServer.CMS.Docs.Branch do
  require GroupherServer.CMS.Docs.Const
  @moduledoc """
  Resolves the Docs-only workspace branch coordinate.

  community + branch ref -> canonical DocBranch -> branch-scoped Docs reads/writes
  """

  import Ecto.Query, warn: false

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.CMS.Model.{Community, DocBranch}
  alias Helper.{ORM, Transaction}


  @main_slug "main"

  @doc "Returns the canonical main DocBranch slug."
  def main_slug, do: @main_slug

  @doc """
  Resolves a community-scoped DocBranch reference to its canonical row.

  Accepts a `%DocBranch{}`, a map or keyword with `:branch_id`, `:branch` or
  `:branch_slug`, the main slug (or `nil`/empty), a branch id integer, or a
  branch slug string. The main branch is created on first access.

  ## Examples

      Branch.resolve(community, "main")
      #=> {:ok, %DocBranch{slug: "main"}}

      Branch.resolve(community, "missing")
      #=> {:error, GroupherServer.ErrorCat.custom("Doc branch not found")}

  """
  def resolve(%Community{} = community, %DocBranch{} = branch) do
    if branch.community_id == community.id,
      do: {:ok, branch},
      else:
        {:error,
         GroupherServer.ErrorCat.custom("Doc branch does not belong to the requested scope")}
  end

  def resolve(%Community{} = community, ref) when is_map(ref) or is_list(ref) do
    resolve(
      community,
      option(ref, :branch_id) || option(ref, :branch) || option(ref, :branch_slug)
    )
  end

  def resolve(%Community{} = community, nil), do: ensure_main(community)
  def resolve(%Community{} = community, ""), do: ensure_main(community)
  def resolve(%Community{} = community, @main_slug), do: ensure_main(community)

  def resolve(%Community{} = community, id) when is_integer(id),
    do: ORM.find_by(DocBranch, id: id, community_id: community.id)

  def resolve(%Community{} = community, ref) when is_binary(ref) do
    DocBranch
    |> where([branch], branch.community_id == ^community.id)
    |> where([branch], branch.slug == ^ref or fragment("?::text", branch.id) == ^ref)
    |> limit(1)
    |> Repo.one()
    |> case do
      %DocBranch{} = branch -> {:ok, branch}
      nil -> {:error, GroupherServer.ErrorCat.custom("Doc branch not found")}
    end
  end

  def resolve(_community, _ref),
    do: {:error, GroupherServer.ErrorCat.custom("Doc branch is invalid")}

  def branch_id(%Community{} = community, ref) do
    with {:ok, branch} <- resolve(community, ref), do: {:ok, branch.id}
  end

  def main?(%DocBranch{type: type}), do: type == CMS.Docs.Const.doc_branch_type(:main)
  def preview?(%DocBranch{type: type}), do: type == CMS.Docs.Const.doc_branch_type(:preview)

  def create_preview(%Community{} = community, attrs, %User{} = user) do
    source_ref = option(attrs, :source_branch_id) || @main_slug

    with {:ok, source_branch} <- resolve(community, source_ref) do
      ORM.create(DocBranch, %{
        community_id: community.id,
        source_branch_id: source_branch.id,
        created_by_id: user.id,
        slug: option(attrs, :slug),
        title: option(attrs, :title) || option(attrs, :slug),
        type: CMS.Docs.Const.doc_branch_type(:preview),
        status: CMS.Docs.Const.doc_branch_status(:active)
      })
    end
  end

  defp ensure_main(%Community{} = community) do
    Transaction.lock_global("doc_branch:init:#{community.id}:#{@main_slug}", fn ->
      case ORM.find_by(DocBranch, community_id: community.id, slug: @main_slug) do
        {:ok, branch} ->
          {:ok, branch}

        {:error, _} ->
          ORM.create(DocBranch, %{
            community_id: community.id,
            slug: @main_slug,
            title: @main_slug,
            type: CMS.Docs.Const.doc_branch_type(:main),
            status: CMS.Docs.Const.doc_branch_status(:active)
          })
      end
    end)
  end

  defp option(opts, key) when is_map(opts),
    do: Map.get(opts, key) || Map.get(opts, Atom.to_string(key))

  defp option(opts, key) when is_list(opts), do: Keyword.get(opts, key)
end
