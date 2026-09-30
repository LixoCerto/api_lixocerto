import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ModeloUsuarioDesafio extends Model<InferAttributes<ModeloUsuarioDesafio>, InferCreationAttributes<ModeloUsuarioDesafio>> {
  declare lcr_ude_id_usuario_desafio: CreationOptional<string>;
  declare lcr_ude_id_usuario: string;
  declare lcr_ude_id_desafio: string;
  declare lcr_ude_periodo_chave: CreationOptional<string>;
  declare lcr_ude_progresso_criterios: CreationOptional<Array<Record<string, unknown>>>;
  declare lcr_ude_quantidade_progresso: CreationOptional<number>;
  declare lcr_ude_status_participacao: CreationOptional<'participando' | 'concluido' | 'abandonado'>;
  declare lcr_ude_data_inicio: CreationOptional<Date>;
  declare lcr_ude_data_conclusao: Date | null;
  declare lcr_ude_data_atualizacao: CreationOptional<Date>;
}

export function inicializarModeloUsuarioDesafio(sequelize: Sequelize): void {
  ModeloUsuarioDesafio.init({
    lcr_ude_id_usuario_desafio: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lcr_ude_id_usuario: { type: DataTypes.UUID, allowNull: false },
    lcr_ude_id_desafio: { type: DataTypes.UUID, allowNull: false },
    lcr_ude_periodo_chave: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'unica' },
    lcr_ude_progresso_criterios: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    lcr_ude_quantidade_progresso: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lcr_ude_status_participacao: { type: DataTypes.ENUM('participando', 'concluido', 'abandonado'), allowNull: false, defaultValue: 'participando' },
    lcr_ude_data_inicio: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lcr_ude_data_conclusao: { type: DataTypes.DATE, allowNull: true },
    lcr_ude_data_atualizacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    tableName: 'lcr_usuarios_desafios',
    modelName: 'ModeloUsuarioDesafio',
    timestamps: false,
  });
}
