import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ModeloMaterial extends Model<InferAttributes<ModeloMaterial>, InferCreationAttributes<ModeloMaterial>> {
  declare lcr_mat_id_material: CreationOptional<string>;
  declare lcr_mat_codigo_catalogo: string | null;
  declare lcr_mat_classificacao: CreationOptional<string>;
  declare lcr_mat_nome_material: string;
  declare lcr_mat_categoria_material: string;
  declare lcr_mat_instrucao_descarte: string;
  declare lcr_mat_observacao_impacto: string;
  declare lcr_mat_sinonimos: CreationOptional<string[]>;
  declare lcr_mat_preparacao: CreationOptional<string>;
  declare lcr_mat_cuidados: CreationOptional<string>;
  declare lcr_mat_categorias_pontos: CreationOptional<string[]>;
  declare lcr_mat_rotas_referencia: CreationOptional<string[]>;
  declare lcr_mat_abrangencia: CreationOptional<string>;
  declare lcr_mat_escopo_detalhado: CreationOptional<string>;
  declare lcr_mat_fontes_referencia: CreationOptional<Array<{ titulo: string; url: string; comprova: string }>>;
  declare lcr_mat_data_verificacao: string | null;
  declare lcr_mat_observacao_revisao: string | null;
  declare lcr_mat_id_usuario_criador: string | null;
  declare lcr_mat_id_usuario_editor: string | null;
  declare lcr_mat_id_usuario_revisor: string | null;
  declare lcr_mat_data_publicacao: Date | null;
  declare lcr_mat_icone_material: string | null;
  declare lcr_mat_versao_conteudo: CreationOptional<number>;
  declare lcr_mat_status_material: CreationOptional<'rascunho' | 'publicado' | 'arquivado'>;
  declare lcr_mat_data_criacao: CreationOptional<Date>;
  declare lcr_mat_data_atualizacao: CreationOptional<Date>;
}

export function inicializarModeloMaterial(sequelize: Sequelize): void {
  ModeloMaterial.init({
    lcr_mat_id_material: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lcr_mat_codigo_catalogo: { type: DataTypes.STRING(100), allowNull: true, unique: true },
    lcr_mat_classificacao: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    lcr_mat_nome_material: { type: DataTypes.STRING(160), allowNull: false },
    lcr_mat_categoria_material: { type: DataTypes.STRING(80), allowNull: false },
    lcr_mat_instrucao_descarte: { type: DataTypes.TEXT, allowNull: false },
    lcr_mat_observacao_impacto: { type: DataTypes.TEXT, allowNull: false },
    lcr_mat_sinonimos: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    lcr_mat_preparacao: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    lcr_mat_cuidados: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    lcr_mat_categorias_pontos: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    lcr_mat_rotas_referencia: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    lcr_mat_abrangencia: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'confirmar_localmente' },
    lcr_mat_escopo_detalhado: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    lcr_mat_fontes_referencia: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    lcr_mat_data_verificacao: { type: DataTypes.DATEONLY, allowNull: true },
    lcr_mat_observacao_revisao: { type: DataTypes.TEXT, allowNull: true },
    lcr_mat_id_usuario_criador: { type: DataTypes.UUID, allowNull: true },
    lcr_mat_id_usuario_editor: { type: DataTypes.UUID, allowNull: true },
    lcr_mat_id_usuario_revisor: { type: DataTypes.UUID, allowNull: true },
    lcr_mat_data_publicacao: { type: DataTypes.DATE, allowNull: true },
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
