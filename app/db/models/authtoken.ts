import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize'

import { sequelize } from '../db.ts'

export type AuthTokenType = 'refresh' | 'magic_link' | 'password_reset'

/**
 * Server-side token record (STS identity service). The token value itself
 * is never stored; only its SHA-256 hash.
 */
export class AuthToken extends Model<
  InferAttributes<AuthToken>,
  InferCreationAttributes<AuthToken>
> {
  declare id: string
  declare userId: CreationOptional<string | null>
  declare type: AuthTokenType
  declare tokenHash: string
  declare expiresAt: Date
  declare usedAt: CreationOptional<Date | null>
  declare revokedAt: CreationOptional<Date | null>
  declare metadata: CreationOptional<Record<string, unknown> | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

AuthToken.init(
  {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
    },
    userId: {
      type: DataTypes.STRING,
      field: 'user_id',
    },
    type: {
      allowNull: false,
      type: DataTypes.STRING,
    },
    tokenHash: {
      allowNull: false,
      unique: true,
      type: DataTypes.STRING(128),
      field: 'token_hash',
    },
    expiresAt: {
      allowNull: false,
      type: DataTypes.DATE,
      field: 'expires_at',
    },
    usedAt: {
      type: DataTypes.DATE,
      field: 'used_at',
    },
    revokedAt: {
      type: DataTypes.DATE,
      field: 'revoked_at',
    },
    metadata: DataTypes.JSON,
    createdAt: { type: DataTypes.DATE, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
  },
  {
    sequelize,
    modelName: 'AuthToken',
    tableName: 'AuthTokens',
    timestamps: true,
  }
)
