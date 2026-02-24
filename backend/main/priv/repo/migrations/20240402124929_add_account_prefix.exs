defmodule GroupherServer.Repo.Migrations.AddAccountPrefix do
  use Ecto.Migration

  def up do
    execute "CREATE SCHEMA IF NOT EXISTS account"
    execute "ALTER TABLE public.users SET SCHEMA account"

    # user_socials
    execute "ALTER TABLE user_socials RENAME TO socials"
    execute "ALTER TABLE public.socials SET SCHEMA account"

    # user_followers
    execute "ALTER TABLE users_followers RENAME TO followers"
    execute "ALTER TABLE public.followers SET SCHEMA account"

    # user_followings
    execute "ALTER TABLE users_followings RENAME TO followings"
    execute "ALTER TABLE public.followings SET SCHEMA account"

    # github_users
    execute "ALTER TABLE github_users SET SCHEMA account"

    # user_contributes
    execute "ALTER TABLE user_contributes RENAME TO contributes"
    execute "ALTER TABLE public.contributes SET SCHEMA account"

    # geo
    execute "ALTER TABLE public.geos SET SCHEMA account"

    # customizations
    execute "ALTER TABLE public.customizations SET SCHEMA account"

    # collect_folders
    execute "ALTER TABLE public.collect_folders SET SCHEMA account"

    # user_achievements
    execute "ALTER TABLE user_achievements RENAME TO achievements"
    execute "ALTER TABLE public.achievements SET SCHEMA account"
  end

  def down do
    execute "ALTER TABLE account.users SET SCHEMA public"

    execute "ALTER TABLE account.socials SET SCHEMA public"
    execute "ALTER TABLE public.socials RENAME TO user_socials"

    execute "ALTER TABLE account.followers SET SCHEMA public"
    execute "ALTER TABLE public.followers RENAME TO users_followers"

    execute "ALTER TABLE account.followings SET SCHEMA public"
    execute "ALTER TABLE public.followings RENAME TO users_followings"

    execute "ALTER TABLE account.github_users SET SCHEMA public"

    execute "ALTER TABLE account.contributes SET SCHEMA public"
    execute "ALTER TABLE public.contributes RENAME TO user_contributes"

    execute "ALTER TABLE account.geos SET SCHEMA public"

    execute "ALTER TABLE account.customizations SET SCHEMA public"

    execute "ALTER TABLE account.collect_folders SET SCHEMA public"

    execute "ALTER TABLE account.achievements SET SCHEMA public"
    execute "ALTER TABLE public.achievements RENAME TO user_achievements"

    execute "DROP SCHEMA IF EXISTS account"
  end
end
