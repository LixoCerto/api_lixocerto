import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ModeloProgressoUsuario extends Model<InferAttributes<ModeloProgressoUsuario>, InferCreationAttributes<ModeloProgressoUsuario>> {
  declare lcr_prg_id_progresso_usuario: CreationOptional<string>;
  declare lcr_prg_id_usuario: string;
  declare lcr_prg_quantidade_pontos: CreationOptional<number>;
  declare lcr_prg_nivel_gamificacao: CreationOptional<string>;
  declare lcr_prg_sequencia_dias: CreationOptional<number>;
  declare lcr_prg_data_ultima_atividade: Date | null;
  declare lcr_prg_proximo_quiz_em: Date | null;
  declare lcr_prg_ultimo_tema_quiz: string | null;
  declare lcr_prg_data_atualizacao: CreationOptional<Date>;
}

export function inicializarModeloProgressoUsuario(sequelize: Sequelize): void {
  ModeloProgressoUsuario.init({
    lcr_prg_id_progresso_usuario: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lcr_prg_id_usuario: { type: DataTypes.UUID, allowNull: false, unique: true },
    lcr_prg_quantidade_pontos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lcr_prg_nivel_gamificacao: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'iniciante' },
    lcr_prg_sequencia_dias: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lcr_prg_data_ultima_atividade: { type: DataTypes.DATE, allowNull: true },
    lcr_prg_proximo_quiz_em: { type: DataTypes.DATE, allowNull: true },
    lcr_prg_ultimo_tema_quiz: { type: DataTypes.STRING(80), allowNull: true },
    lcr_prg_data_atualizacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    tableName: 'lcr_progresso_usuarios',
    modelName: 'ModeloProgressoUsuario',
    timestamps: false,
  });
}
