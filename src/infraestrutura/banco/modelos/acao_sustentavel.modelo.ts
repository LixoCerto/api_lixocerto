import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ModeloAcaoSustentavel extends Model<InferAttributes<ModeloAcaoSustentavel>, InferCreationAttributes<ModeloAcaoSustentavel>> {
  declare lcr_ast_id_acao_sustentavel: CreationOptional<string>;
  declare lcr_ast_id_usuario: string;
  declare lcr_ast_id_desafio: string | null;
  declare lcr_ast_tipo_acao: string;
  declare lcr_ast_descricao_acao: string | null;
  declare lcr_ast_quantidade_pontos: CreationOptional<number>;
  declare lcr_ast_data_registro: CreationOptional<Date>;
}

export function inicializarModeloAcaoSustentavel(sequelize: Sequelize): void {
  ModeloAcaoSustentavel.init({
    lcr_ast_id_acao_sustentavel: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lcr_ast_id_usuario: { type: DataTypes.UUID, allowNull: false },
    lcr_ast_id_desafio: { type: DataTypes.UUID, allowNull: true },
    lcr_ast_tipo_acao: { type: DataTypes.STRING(100), allowNull: false },
    lcr_ast_descricao_acao: { type: DataTypes.TEXT, allowNull: true },
    lcr_ast_quantidade_pontos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lcr_ast_data_registro: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    tableName: 'lcr_acoes_sustentaveis',
    modelName: 'ModeloAcaoSustentavel',
    timestamps: false,
  });
}
