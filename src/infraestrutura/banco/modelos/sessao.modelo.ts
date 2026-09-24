import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ModeloSessao extends Model<InferAttributes<ModeloSessao>, InferCreationAttributes<ModeloSessao>> {
  declare lcr_ses_id_sessao: CreationOptional<string>;
  declare lcr_ses_id_usuario: string;
  declare lcr_ses_hash_token: string;
  declare lcr_ses_hash_token_atualizacao: string;
  declare lcr_ses_endereco_ip: string | null;
  declare lcr_ses_agente_usuario: string | null;
  declare lcr_ses_data_expiracao: Date;
  declare lcr_ses_data_revogacao: Date | null;
  declare lcr_ses_data_criacao: CreationOptional<Date>;
}

export function inicializarModeloSessao(sequelize: Sequelize): void {
  ModeloSessao.init({
    lcr_ses_id_sessao: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lcr_ses_id_usuario: { type: DataTypes.UUID, allowNull: false },
    lcr_ses_hash_token: { type: DataTypes.TEXT, allowNull: false, unique: true },
    lcr_ses_hash_token_atualizacao: { type: DataTypes.TEXT, allowNull: false },
    lcr_ses_endereco_ip: { type: DataTypes.INET, allowNull: true },
    lcr_ses_agente_usuario: { type: DataTypes.TEXT, allowNull: true },
    lcr_ses_data_expiracao: { type: DataTypes.DATE, allowNull: false },
    lcr_ses_data_revogacao: { type: DataTypes.DATE, allowNull: true },
    lcr_ses_data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    tableName: 'lcr_sessoes',
    modelName: 'ModeloSessao',
    timestamps: false,
  });
}
