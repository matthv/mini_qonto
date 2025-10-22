module Api
  class User < Api::ApplicationRecord
    has_many :orders, dependent: :nullify
    has_many :addresses, as: :addressable, dependent: :destroy
  end
end