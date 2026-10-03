import {
  DataTypes,
  Model,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from 'sequelize'

import { sequelize } from '../db.ts'

export class NewsletterSubscription extends Model<
  InferAttributes<NewsletterSubscription>,
  InferCreationAttributes<NewsletterSubscription>
> {
  declare id: string
  declare email: string
  declare source: CreationOptional<string | null>
  declare locale: CreationOptional<string | null>
  declare unsubscribedAt: CreationOptional<Date | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>
}

NewsletterSubscription.init(
  {
    id: {
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
    },
    email: {
      allowNull: false,
      unique: true,
      type: DataTypes.STRING,
    },
    source: DataTypes.STRING,
    locale: DataTypes.STRING,
    unsubscribedAt: {
      type: DataTypes.DATE,
      field: 'unsubscribed_at',
    },
    createdAt: { type: DataTypes.DATE, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, field: 'updated_at' },
  },
  {
    sequelize,
    modelName: 'NewsletterSubscription',
    tableName: 'NewsletterSubscriptions',
    timestamps: true,
  }
)
