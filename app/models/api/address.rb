module Api
  class Address < Api::ApplicationRecord
    belongs_to :addressable, polymorphic: true
  end
end