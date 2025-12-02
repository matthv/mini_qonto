module Biller
  class Subscription < Biller::ApplicationRecord
    STATUS = {
      active: 0,
      inactive: 2,
      pending_termination: 3
    }.freeze

    RECURRENCE = {
      monthly: 0,
      annual: 1
    }.freeze

    enum :status, STATUS
    enum :recurrence, RECURRENCE

    belongs_to :product
  end
end
