'use strict'

/**
 * STS Street: first-party newsletter subscription list. Upstream posted
 * subscriptions to a third-party mailing list provider; STS Street stores
 * them in its own database so no user data leaves STS infrastructure.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('NewsletterSubscriptions', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
      },
      email: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING,
      },
      source: {
        type: Sequelize.STRING,
      },
      locale: {
        type: Sequelize.STRING,
      },
      unsubscribed_at: {
        type: Sequelize.DATE,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    })
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('NewsletterSubscriptions')
  },
}
