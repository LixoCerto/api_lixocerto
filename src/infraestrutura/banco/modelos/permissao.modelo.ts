import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ModeloPermissao extends Model<InferAttributes<ModeloPermissao>, InferCreationAttributes<ModeloPermissao>> {
  declare lcr_prm_id_permissao: CreationOptional<string>;
  declare lcr_prm_codigo_permissao: string;
  declare lcr_prm_nome_permissao: string;
  declare lcr_prm_descricao_permissao: string;
  declare lcr_prm_status_permissao: CreationOptional<'ativo' | 'inativo'>;
  declare lcr_prm_data_criacao: CreationOptional<Date>;
  declare lcr_prm_data_atualizacao: CreationOptional<Date>;
}

export function inicializarModeloPermissao(sequelize: Sequelize): void {
  ModeloPermissao.init({
    lcr_prm_id_permissao: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lcr_prm_codigo_permissao: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    lcr_prm_nome_permissao: { type: DataTypes.STRING(120), allowNull: false },
    lcr_prm_descricao_permissao: { type: DataTypes.TEXT, allowNull: false },
    lcr_prm_status_permissao: { type: DataTypes.ENUM('ativo', 'inativo'), allowNull: false, defaultValue: 'ativo' },
    lcr_prm_data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lcr_prm_data_atualizacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    tableName: 'lcr_permissoes',
    modelName: 'ModeloPermissao',
    timestamps: false,
  });
}
