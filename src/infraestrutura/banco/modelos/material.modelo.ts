import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ModeloMaterial extends Model<InferAttributes<ModeloMaterial>, InferCreationAttributes<ModeloMaterial>> {
  declare lcr_mat_id_material: CreationOptional<string>;
  declare lcr_mat_nome_material: string;
  declare lcr_mat_categoria_material: string;
  declare lcr_mat_instrucao_descarte: string;
  declare lcr_mat_observacao_impacto: string;
  declare lcr_mat_icone_material: string | null;
  declare lcr_mat_versao_conteudo: CreationOptional<number>;
  declare lcr_mat_status_material: CreationOptional<'rascunho' | 'publicado' | 'arquivado'>;
  declare lcr_mat_data_criacao: CreationOptional<Date>;
  declare lcr_mat_data_atualizacao: CreationOptional<Date>;
}

export function inicializarModeloMaterial(sequelize: Sequelize): void {
  ModeloMaterial.init({
    lcr_mat_id_material: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lcr_mat_nome_material: { type: DataTypes.STRING(160), allowNull: false },
    lcr_mat_categoria_material: { type: DataTypes.STRING(80), allowNull: false },
    lcr_mat_instrucao_descarte: { type: DataTypes.TEXT, allowNull: false },
    lcr_mat_observacao_impacto: { type: DataTypes.TEXT, allowNull: false },
    lcr_mat_icone_material: { type: DataTypes.STRING(80), allowNull: true },
    lcr_mat_versao_conteudo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    lcr_mat_status_material: { type: DataTypes.ENUM('rascunho', 'publicado', 'arquivado'), allowNull: false, defaultValue: 'rascunho' },
    lcr_mat_data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lcr_mat_data_atualizacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    tableName: 'lcr_materiais',
    modelName: 'ModeloMaterial',
    timestamps: false,
  });
}
