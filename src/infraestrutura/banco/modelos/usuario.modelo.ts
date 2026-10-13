import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ModeloUsuario extends Model<InferAttributes<ModeloUsuario>, InferCreationAttributes<ModeloUsuario>> {
  declare lcr_usr_id_usuario: CreationOptional<string>;
  declare lcr_usr_id_externo: string;
  declare lcr_usr_nome: string;
  declare lcr_usr_email: string;
  declare lcr_usr_hash_senha: string | null;
  declare lcr_usr_email_verificado_em: Date | null;
  declare lcr_usr_google_subject: string | null;
  declare lcr_usr_status_usuario: CreationOptional<'ativo' | 'bloqueado' | 'anonimizado'>;
  declare lcr_usr_data_criacao: CreationOptional<Date>;
  declare lcr_usr_data_atualizacao: CreationOptional<Date>;
  declare lcr_usr_data_ultimo_acesso: Date | null;
}

export function inicializarModeloUsuario(sequelize: Sequelize): void {
  ModeloUsuario.init({
    lcr_usr_id_usuario: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lcr_usr_id_externo: { type: DataTypes.STRING(180), allowNull: false, unique: true },
    lcr_usr_nome: { type: DataTypes.STRING(180), allowNull: false },
    lcr_usr_email: { type: DataTypes.STRING(320), allowNull: false, unique: true },
    lcr_usr_hash_senha: { type: DataTypes.TEXT, allowNull: true },
    lcr_usr_email_verificado_em: { type: DataTypes.DATE, allowNull: true },
    lcr_usr_google_subject: { type: DataTypes.STRING(255), allowNull: true },
    lcr_usr_status_usuario: { type: DataTypes.ENUM('ativo', 'bloqueado', 'anonimizado'), allowNull: false, defaultValue: 'ativo' },
    lcr_usr_data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lcr_usr_data_atualizacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    lcr_usr_data_ultimo_acesso: { type: DataTypes.DATE, allowNull: true },
  }, {
    sequelize,
    tableName: 'lcr_usuarios',
    modelName: 'ModeloUsuario',
    timestamps: false,
  });
}
