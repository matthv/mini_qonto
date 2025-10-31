class AddTagsToEmails < ActiveRecord::Migration[7.0]
  def change
    add_column :emails, :tags, :string, array: true, default: []
  end
end
