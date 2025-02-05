import Ecto.Query, warn: false

alias Helper.ORM
alias GroupherServer.CMS.Delegate.CommunityCRUD

alias GroupherServer.Repo
alias GroupherServer.CMS.Model.Post

{:ok, all_posts} =
  Post
  |> order_by(asc: :inserted_at)
  |> where([p], is_nil(p.inner_id))
  |> ORM.find_all(%{page: 1, size: 100})

Enum.each(all_posts.entries, fn post ->
  post = Repo.preload(post, :original_community)

  inner_id = post.original_community.meta.posts_inner_id_index + 1

  ORM.update(post, %{inner_id: inner_id})
  CommunityCRUD.update_community_inner_id(post.original_community, :post, %{inner_id: inner_id})
end)
