import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ModeloAlternativa extends Model<InferAttributes<ModeloAlternativa>, InferCreationAttributes<ModeloAlternativa>> {
  declare lcr_alt_id_alternativa: CreationOptional<string>;
  declare lcr_alt_id_questao: string;
  declare lcr_alt_texto_alternativa: string;
  declare lcr_alt_indica_correta: boolean;
  declare lcr_alt_ordem_exibicao: number;
}

export function inicializarModeloAlternativa(sequelize: Sequelize): void {
  ModeloAlternativa.init({
    lcr_alt_id_alternativa: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lcr_alt_id_questao: { type: DataTypes.UUID, allowNull: false },
    lcr_alt_texto_alternativa: { type: DataTypes.TEXT, allowNull: false },
    lcr_alt_indica_correta: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    lcr_alt_ordem_exibicao: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    sequelize,
    tableName: 'lcr_alternativas',
    modelName: 'ModeloAlternativa',
    timestamps: false,
  });
}
