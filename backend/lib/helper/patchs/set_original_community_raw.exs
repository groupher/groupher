import Ecto.Query, warn: false

alias Helper.ORM

alias GroupherServer.Repo
alias GroupherServer.CMS.Model.Post

{:ok, all_posts} =
  Post
  |> where([p], is_nil(p.original_community_slug))
  |> ORM.find_all(%{page: 1, size: 100})

Enum.each(all_posts.entries, fn post ->
  post = Repo.preload(post, :original_community)

  case post.original_community_slug do
    nil -> ORM.update(post, %{original_community_slug: post.original_community.slug})
    _ -> {:ok, :pass}
  end
end)
