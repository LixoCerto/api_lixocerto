import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export type TipoTokenAutenticacao = 'verificacao_email' | 'redefinicao_senha';

export class ModeloTokenAutenticacao extends Model<InferAttributes<ModeloTokenAutenticacao>, InferCreationAttributes<ModeloTokenAutenticacao>> {
  declare lcr_tka_id_token: CreationOptional<string>;
  declare lcr_tka_id_usuario: string;
  declare lcr_tka_tipo_token: TipoTokenAutenticacao;
  declare lcr_tka_hash_token: string;
  declare lcr_tka_data_expiracao: Date;
  declare lcr_tka_data_consumo: Date | null;
  declare lcr_tka_quantidade_tentativas: CreationOptional<number>;
  declare lcr_tka_endereco_ip: string | null;
  declare lcr_tka_agente_usuario: string | null;
  declare lcr_tka_data_criacao: CreationOptional<Date>;
}

export function inicializarModeloTokenAutenticacao(sequelize: Sequelize): void {
  ModeloTokenAutenticacao.init({
    lcr_tka_id_token: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lcr_tka_id_usuario: { type: DataTypes.UUID, allowNull: false },
    lcr_tka_tipo_token: { type: DataTypes.STRING(30), allowNull: false },
    lcr_tka_hash_token: { type: DataTypes.TEXT, allowNull: false, unique: true },
    lcr_tka_data_expiracao: { type: DataTypes.DATE, allowNull: false },
    lcr_tka_data_consumo: { type: DataTypes.DATE, allowNull: true },
    lcr_tka_quantidade_tentativas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lcr_tka_endereco_ip: { type: DataTypes.INET, allowNull: true },
    lcr_tka_agente_usuario: { type: DataTypes.TEXT, allowNull: true },
    lcr_tka_data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    tableName: 'lcr_tokens_autenticacao',
    modelName: 'ModeloTokenAutenticacao',
    timestamps: false,
  });
}