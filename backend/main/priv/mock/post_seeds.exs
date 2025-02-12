alias GroupherServer.CMS.Delegate.Seeds

alias GroupherServer.CMS
alias CMS.Model.{Post, ArticleTag}
alias Helper.{Constant,ORM}

{:ok, post} = Seeds.Articles.seed_articles("home", :post)

# {:ok, post} = CMS.set_article_tag(:post, post.id, tag.id)
# {:ok, post} = CMS.set_article_tag(:post, post.id, tag2.id)
