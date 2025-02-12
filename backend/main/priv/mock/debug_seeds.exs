alias GroupherServer.CMS
# alias Helper.ORM

# ORM.delete_all(CMS.Model.Thread, :if_exist)

CMS.clean_up_community(:home)
{:ok, community} = CMS.seed_community(:home)


CMS.seed_articles(community, :post, 5)
CMS.seed_articles(community, :blog, 5)
