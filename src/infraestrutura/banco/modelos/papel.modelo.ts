import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ModeloPapel extends Model<InferAttributes<ModeloPapel>, InferCreationAttributes<ModeloPapel>> {
  declare lcr_pap_id_papel: CreationOptional<string>;
  declare lcr_pap_nome_papel: string;
  declare lcr_pap_descricao_papel: string;
  declare lcr_pap_status_papel: CreationOptional<'ativo' | 'inativo'>;
  declare lcr_pap_data_criacao: CreationOptional<Date>;
  declare lcr_pap_data_atualizacao: CreationOptional<Date>;
}

export function inicializarModeloPapel(sequelize: Sequelize): void {
  ModeloPapel.init({
    lcr_pap_id_papel: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lcr_pap_nome_papel: { type: DataTypes.STRING(60), allowNull: false, unique: true },
    lcr_pap_descricao_papel: { type: DataTypes.TEXT, allowNull: false },
    lcr_pap_status_papel: { type: DataTypes.ENUM('ativo', 'inativo'), allowNull: false, defaultValue: 'ativo' },
    lcr_pap_data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lcr_pap_data_atualizacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    tableName: 'lcr_papeis',
    modelName: 'ModeloPapel',
    timestamps: false,
  });
}
