import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ModeloTentativaQuestionario extends Model<InferAttributes<ModeloTentativaQuestionario>, InferCreationAttributes<ModeloTentativaQuestionario>> {
  declare lcr_tqu_id_tentativa_questionario: CreationOptional<string>;
  declare lcr_tqu_id_usuario: string;
  declare lcr_tqu_id_questao: string;
  declare lcr_tqu_id_alternativa: string;
  declare lcr_tqu_indica_correta: boolean;
  declare lcr_tqu_quantidade_pontos: number;
  declare lcr_tqu_data_tentativa: CreationOptional<Date>;
}

export function inicializarModeloTentativaQuestionario(sequelize: Sequelize): void {
  ModeloTentativaQuestionario.init({
    lcr_tqu_id_tentativa_questionario: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lcr_tqu_id_usuario: { type: DataTypes.UUID, allowNull: false },
    lcr_tqu_id_questao: { type: DataTypes.UUID, allowNull: false },
    lcr_tqu_id_alternativa: { type: DataTypes.UUID, allowNull: false },
    lcr_tqu_indica_correta: { type: DataTypes.BOOLEAN, allowNull: false },
    lcr_tqu_quantidade_pontos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lcr_tqu_data_tentativa: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    tableName: 'lcr_tentativas_questionario',
    modelName: 'ModeloTentativaQuestionario',
    timestamps: false,
  });
}
