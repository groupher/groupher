alias GroupherServer.CMS.Delegate.Seeds

alias GroupherServer.CMS

alias CMS.Model.{CommunityTag, Post}
alias Helper.{Constant, ORM}

{:ok, post} = Seeds.Articles.seed_articles("home", :post)

# {:ok, post} = CMS.set_article_tag(post, tag.id)
# {:ok, post} = CMS.set_article_tag(post, tag2.id)
