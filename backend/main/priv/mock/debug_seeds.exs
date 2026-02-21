alias GroupherServer.CMS
# alias Helper.ORM

# ORM.delete_all(CMS.Model.Thread, :if_exist)

CMS.Seeds.clean_up_community(:home)
{:ok, community} = CMS.Seeds.community(:home)


CMS.Seeds.articles(community, :post, 5)
CMS.Seeds.articles(community, :blog, 5)
