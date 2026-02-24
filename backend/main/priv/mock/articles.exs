# TODO: remove later
# import GroupherServer.Support.Factory

alias GroupherServer.{Accounts, CMS}
alias Helper.ORM

alias Accounts.Model.User
alias CMS.Model.{Community, Embeds, Post}

default_meta = Embeds.ArticleMeta.default_meta()

# {:ok, home_community} = ORM.find_by(Community, %{slug: "home"})
# {:ok, bot} = ORM.find(User, 1)

# ret = CMS.update_community_count_field(home_community, bot.id, :subscribers_count, :inc)
{:ok, all_posts} = ORM.find_all(Post, %{page: 1, size: 300})

all_posts.entries
|> Enum.each(fn post ->
  cur_updated_at = post.updated_at

  with {:ok, post} <- ORM.update_meta(post, default_meta) do
    {:ok, _} = ORM.update(post, %{updated_at: cur_updated_at, active_at: cur_updated_at})
  end
end)
