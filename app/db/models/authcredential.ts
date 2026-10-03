import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize'

import { sequelize } from '../db.ts'

/**
 * Password credential for a user account (STS identity service).
 * Only the password hash is stored (see app/auth/password.ts).
 */
export class AuthCredential extends Model<
  InferAttributes<AuthCredential>,
  InferCreationAttributes<AuthCredential>
> {
  declare userId: string
  declare passwordHash: string
  declare passwordUpdatedAt: CreationOptional<Date | null>
  declare failedAttempts: CreationOptional<number>
  declare lockedUntil: CreationOptional<Date | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

AuthCredential.init(
  {
    userId: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.STRING,
      field: 'user_id',
    },
    passwordHash: {
      allowNull: false,
      type: DataTypes.STRING(512),
      field: 'password_hash',
    },
    passwordUpdatedAt: {
      type: DataTypes.DATE,
      field: 'password_updated_at',
    },
    failedAttempts: {
      allowNull: false,
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: 'failed_attempts',
    },
    lockedUntil: {
      type: DataTypes.DATE,
      field: 'locked_until',
    },
    createdAt: { type: DataTypes.DATE, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
  },
  {
    sequelize,
    modelName: 'AuthCredential',
    tableName: 'AuthCredentials',
    timestamps: true,
  }
)
