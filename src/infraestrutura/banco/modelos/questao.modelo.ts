import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ModeloQuestao extends Model<InferAttributes<ModeloQuestao>, InferCreationAttributes<ModeloQuestao>> {
  declare lcr_que_id_questao: CreationOptional<string>;
  declare lcr_que_enunciado_questao: string;
  declare lcr_que_explicacao_questao: string;
  declare lcr_que_quantidade_pontos: CreationOptional<number>;
  declare lcr_que_tema_questao: CreationOptional<string>;
  declare lcr_que_status_questao: CreationOptional<'rascunho' | 'publicada' | 'arquivada'>;
  declare lcr_que_data_criacao: CreationOptional<Date>;
  declare lcr_que_data_atualizacao: CreationOptional<Date>;
}

export function inicializarModeloQuestao(sequelize: Sequelize): void {
  ModeloQuestao.init({
    lcr_que_id_questao: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lcr_que_enunciado_questao: { type: DataTypes.TEXT, allowNull: false },
    lcr_que_explicacao_questao: { type: DataTypes.TEXT, allowNull: false },
    lcr_que_quantidade_pontos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50 },
    lcr_que_tema_questao: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'residuos' },
    lcr_que_status_questao: { type: DataTypes.ENUM('rascunho', 'publicada', 'arquivada'), allowNull: false, defaultValue: 'rascunho' },
    lcr_que_data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lcr_que_data_atualizacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    tableName: 'lcr_questoes',
    modelName: 'ModeloQuestao',
    timestamps: false,
  });
}
