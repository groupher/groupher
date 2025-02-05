defmodule GroupherServer.Mock.CMS.Comment do
  import GroupherServer.Support.Factory

  # alias GroupherServer.Repo
  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.Post
  alias Helper.ORM

  # CMS.comment_post(post_id, body)

  # def random_attrs do
  # %{
  # title: Faker.Name.first_name() <> " " <> Faker.Name.last_name(),
  # body: Faker.Lorem.paragraph(%Range{first: 1, last: 2})
  # }
  # end



  def gen() do
    {:ok, user} = ORM.find(User, 1)
    IO.inspect  user, label: "got user"
    {:ok, post} = ORM.find(Post, 21)
    IO.inspect  post, label: "got post"

    {:ok, comment} = CMS.create_comment(:post, post.id, mock_comment(), user)
  end
end
