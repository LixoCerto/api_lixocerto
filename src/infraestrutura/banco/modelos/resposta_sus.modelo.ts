import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ModeloRespostaSus extends Model<InferAttributes<ModeloRespostaSus>, InferCreationAttributes<ModeloRespostaSus>> {
  declare lcr_rsu_id_resposta_sus: CreationOptional<string>;
  declare lcr_rsu_id_sessao_avaliacao: string;
  declare lcr_rsu_numero_item: number;
  declare lcr_rsu_nota_item: number;
  declare lcr_rsu_data_criacao: CreationOptional<Date>;
}

export function inicializarModeloRespostaSus(sequelize: Sequelize): void {
  ModeloRespostaSus.init({
    lcr_rsu_id_resposta_sus: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lcr_rsu_id_sessao_avaliacao: { type: DataTypes.UUID, allowNull: false },
    lcr_rsu_numero_item: { type: DataTypes.INTEGER, allowNull: false },
    lcr_rsu_nota_item: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
    lcr_rsu_data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    tableName: 'lcr_respostas_sus',
    modelName: 'ModeloRespostaSus',
    timestamps: false,
  });
}
