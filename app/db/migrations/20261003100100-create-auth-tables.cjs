'use strict'

/**
 * STS Street identity service tables.
 *
 * AuthCredentials: one row per user that has a password (email + password
 * sign-in). Users that only use magic links or federated sign-in have no row.
 *
 * AuthTokens: single-use or revocable server-side tokens. Only a SHA-256 hash
 * of each token is stored. Types: refresh, magic_link, password_reset.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('AuthCredentials', {
      user_id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      password_hash: {
        allowNull: false,
        type: Sequelize.STRING(512),
      },
      password_updated_at: {
        type: Sequelize.DATE,
      },
      failed_attempts: {
        allowNull: false,
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      locked_until: {
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

    await queryInterface.createTable('AuthTokens', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
      },
      user_id: {
        type: Sequelize.STRING,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      type: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      token_hash: {
        allowNull: false,
        unique: true,
        type: Sequelize.STRING(128),
      },
      expires_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      used_at: {
        type: Sequelize.DATE,
      },
      revoked_at: {
        type: Sequelize.DATE,
      },
      metadata: {
        type: Sequelize.JSON,
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

    await queryInterface.addIndex('AuthTokens', ['user_id', 'type'])
    await queryInterface.addIndex('AuthTokens', ['expires_at'])
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('AuthTokens')
    await queryInterface.dropTable('AuthCredentials')
  },
}
