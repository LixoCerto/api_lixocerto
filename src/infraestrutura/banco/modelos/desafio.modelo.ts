import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ModeloDesafio extends Model<InferAttributes<ModeloDesafio>, InferCreationAttributes<ModeloDesafio>> {
  declare lcr_des_id_desafio: CreationOptional<string>;
  declare lcr_des_nome_desafio: string;
  declare lcr_des_descricao_desafio: string;
  declare lcr_des_tipo_acao: string;
  declare lcr_des_meta_quantidade: number;
  declare lcr_des_quantidade_pontos: CreationOptional<number>;
  declare lcr_des_periodicidade: CreationOptional<'unica' | 'diaria' | 'semanal' | 'mensal'>;
  declare lcr_des_criterios: CreationOptional<Array<Record<string, unknown>>>;
  declare lcr_des_status_desafio: CreationOptional<'rascunho' | 'publicado' | 'arquivado'>;
  declare lcr_des_data_inicio: CreationOptional<Date>;
  declare lcr_des_data_fim: Date | null;
  declare lcr_des_data_criacao: CreationOptional<Date>;
  declare lcr_des_data_atualizacao: CreationOptional<Date>;
}

export function inicializarModeloDesafio(sequelize: Sequelize): void {
  ModeloDesafio.init({
    lcr_des_id_desafio: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lcr_des_nome_desafio: { type: DataTypes.STRING(160), allowNull: false, unique: true },
    lcr_des_descricao_desafio: { type: DataTypes.TEXT, allowNull: false },
    lcr_des_tipo_acao: { type: DataTypes.STRING(100), allowNull: false },
    lcr_des_meta_quantidade: { type: DataTypes.INTEGER, allowNull: false },
    lcr_des_quantidade_pontos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lcr_des_periodicidade: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'unica' },
    lcr_des_criterios: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    lcr_des_status_desafio: { type: DataTypes.ENUM('rascunho', 'publicado', 'arquivado'), allowNull: false, defaultValue: 'rascunho' },
    lcr_des_data_inicio: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lcr_des_data_fim: { type: DataTypes.DATE, allowNull: true },
    lcr_des_data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lcr_des_data_atualizacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    tableName: 'lcr_desafios',
    modelName: 'ModeloDesafio',
    timestamps: false,
  });
}
