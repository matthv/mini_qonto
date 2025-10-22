module Api
  class Order < Api::ApplicationRecord
    belongs_to :user
    has_many :addresses, as: :addressable, dependent: :destroy
  end
end