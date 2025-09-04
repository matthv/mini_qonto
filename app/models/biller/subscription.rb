module Biller
  class Subscription < Biller::ApplicationRecord
    belongs_to :product
  end
end