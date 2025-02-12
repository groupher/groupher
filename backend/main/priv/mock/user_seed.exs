# use /test/support/populater

alias GroupherServer.CMS
alias Helper.ORM

{:ok, root_user} = ORM.find_user("bot")
{:ok, user2} = ORM.find_user("simon")
{:ok, user3} = ORM.find_user("park")
{:ok, user4} = ORM.find_user("dude")

rules = %{
  "post.article_tag.create" => true,
  "post.article_tag.edit" => true,
  # "post.mark_delete" => true
}

IO.inspect root_user, label: "root_user"
# Helper.seed_user("simon")
# Helper.seed_user("park")
# Helper.seed_user("dude")

# {:ok, _} = CMS.add_moderator("home", "moderator", user2, root_user)
# {:ok, _} = CMS.add_moderator("home", "moderator", user3, root_user)
# {:ok, _} = CMS.add_moderator("home", "moderator", user4, root_user)
