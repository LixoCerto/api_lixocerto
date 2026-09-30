import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export type StatusPontoColeta = 'pendente' | 'verificado' | 'rejeitado' | 'expirado';

export class ModeloPontoColeta extends Model<InferAttributes<ModeloPontoColeta>, InferCreationAttributes<ModeloPontoColeta>> {
  declare lcr_pco_id_ponto_coleta: CreationOptional<string>;
  declare lcr_pco_nome_ponto_coleta: string;
  declare lcr_pco_endereco_ponto_coleta: string;
  declare lcr_pco_cep_ponto_coleta: string | null;
  declare lcr_pco_cidade_ponto_coleta: string;
  declare lcr_pco_estado_ponto_coleta: string;
  declare lcr_pco_latitude_ponto_coleta: number | null;
  declare lcr_pco_longitude_ponto_coleta: number | null;
  declare lcr_pco_categorias_aceitas: CreationOptional<string[]>;
  declare lcr_pco_status_verificacao: CreationOptional<StatusPontoColeta>;
  declare lcr_pco_origem_informacao: string | null;
  declare lcr_pco_data_verificacao: Date | null;
  declare lcr_pco_horario_funcionamento: string | null;
  declare lcr_pco_telefone_contato: string | null;
  declare lcr_pco_url_informacoes: string | null;
  declare lcr_pco_id_usuario_cadastrador: string | null;
  declare lcr_pco_data_criacao: CreationOptional<Date>;
  declare lcr_pco_data_atualizacao: CreationOptional<Date>;
}

export function inicializarModeloPontoColeta(sequelize: Sequelize): void {
  ModeloPontoColeta.init({
    lcr_pco_id_ponto_coleta: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lcr_pco_nome_ponto_coleta: { type: DataTypes.STRING(180), allowNull: false },
    lcr_pco_endereco_ponto_coleta: { type: DataTypes.TEXT, allowNull: false },
    lcr_pco_cep_ponto_coleta: { type: DataTypes.STRING(8), allowNull: true },
    lcr_pco_cidade_ponto_coleta: { type: DataTypes.STRING(100), allowNull: false },
    lcr_pco_estado_ponto_coleta: { type: DataTypes.CHAR(2), allowNull: false },
    lcr_pco_latitude_ponto_coleta: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    lcr_pco_longitude_ponto_coleta: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
    lcr_pco_categorias_aceitas: { type: DataTypes.ARRAY(DataTypes.STRING(80)), allowNull: false, defaultValue: [] },
    lcr_pco_status_verificacao: { type: DataTypes.ENUM('pendente', 'verificado', 'rejeitado', 'expirado'), allowNull: false, defaultValue: 'pendente' },
    lcr_pco_origem_informacao: { type: DataTypes.TEXT, allowNull: true },
    lcr_pco_data_verificacao: { type: DataTypes.DATE, allowNull: true },
    lcr_pco_horario_funcionamento: { type: DataTypes.STRING(500), allowNull: true },
    lcr_pco_telefone_contato: { type: DataTypes.STRING(40), allowNull: true },
    lcr_pco_url_informacoes: { type: DataTypes.TEXT, allowNull: true },
    lcr_pco_id_usuario_cadastrador: { type: DataTypes.UUID, allowNull: true },
    lcr_pco_data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lcr_pco_data_atualizacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    tableName: 'lcr_pontos_coleta',
    modelName: 'ModeloPontoColeta',
    timestamps: false,
  });
}
