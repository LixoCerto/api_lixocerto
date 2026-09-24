import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ModeloSessaoAvaliacao extends Model<InferAttributes<ModeloSessaoAvaliacao>, InferCreationAttributes<ModeloSessaoAvaliacao>> {
  declare lcr_sea_id_sessao_avaliacao: CreationOptional<string>;
  declare lcr_sea_codigo_participante_hash: string;
  declare lcr_sea_indica_consentimento: boolean;
  declare lcr_sea_versao_instrumento: CreationOptional<string>;
  declare lcr_sea_data_inicio: CreationOptional<Date>;
  declare lcr_sea_data_conclusao: Date | null;
  declare lcr_sea_data_criacao: CreationOptional<Date>;
}

export function inicializarModeloSessaoAvaliacao(sequelize: Sequelize): void {
  ModeloSessaoAvaliacao.init({
    lcr_sea_id_sessao_avaliacao: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lcr_sea_codigo_participante_hash: { type: DataTypes.TEXT, allowNull: false },
    lcr_sea_indica_consentimento: { type: DataTypes.BOOLEAN, allowNull: false },
    lcr_sea_versao_instrumento: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'SUS-1.0' },
    lcr_sea_data_inicio: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lcr_sea_data_conclusao: { type: DataTypes.DATE, allowNull: true },
    lcr_sea_data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    tableName: 'lcr_sessoes_avaliacao',
    modelName: 'ModeloSessaoAvaliacao',
    timestamps: false,
  });
}
