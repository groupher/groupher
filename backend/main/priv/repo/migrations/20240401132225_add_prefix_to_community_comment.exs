defmodule GroupherServer.Repo.Migrations.AddPrefixToCommunityComment do
  use Ecto.Migration

  def up do
    execute "ALTER TABLE communities SET SCHEMA cms"
    execute "ALTER TABLE comments SET SCHEMA cms"
    execute "ALTER TABLE comments_users_emotions SET SCHEMA cms"
    execute "ALTER TABLE comments_replies SET SCHEMA cms"
    execute "ALTER TABLE comments_upvotes SET SCHEMA cms"

    execute "ALTER TABLE community_dashboards SET SCHEMA cms"
    execute "ALTER TABLE communities_moderators SET SCHEMA cms"
    execute "ALTER TABLE communities_subscribers SET SCHEMA cms"

    execute "ALTER TABLE categories SET SCHEMA cms"
    execute "ALTER TABLE communities_threads SET SCHEMA cms"

    execute "ALTER TABLE communities_categories SET SCHEMA cms"
    execute "ALTER TABLE threads SET SCHEMA cms"
  end

  def down do
    execute "ALTER TABLE cms.communities SET SCHEMA public"
    execute "ALTER TABLE cms.comments SET SCHEMA public"
    execute "ALTER TABLE cms.comments_users_emotions SET SCHEMA public"
    execute "ALTER TABLE cms.comments_replies SET SCHEMA public"
    execute "ALTER TABLE cms.comments_upvotes SET SCHEMA public"

    execute "ALTER TABLE cms.community_dashboards SET SCHEMA public"
    execute "ALTER TABLE cms.communities_moderators SET SCHEMA public"
    execute "ALTER TABLE cms.communities_subscribers SET SCHEMA public"

    execute "ALTER TABLE cms.categories SET SCHEMA public"
    execute "ALTER TABLE cms.communities_threads SET SCHEMA public"
    execute "ALTER TABLE cms.communities_categories SET SCHEMA public"
    execute "ALTER TABLE cms.threads SET SCHEMA public"
  end
end
