import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class ModeloRegistroAuditoria extends Model<InferAttributes<ModeloRegistroAuditoria>, InferCreationAttributes<ModeloRegistroAuditoria>> {
  declare lcr_aud_id_registro_auditoria: CreationOptional<string>;
  declare lcr_aud_id_usuario: string | null;
  declare lcr_aud_tipo_evento: string;
  declare lcr_aud_recurso_evento: string | null;
  declare lcr_aud_id_recurso: string | null;
  declare lcr_aud_endereco_ip: string | null;
  declare lcr_aud_id_correlacao: string;
  declare lcr_aud_detalhes_evento: Record<string, unknown> | null;
  declare lcr_aud_data_criacao: CreationOptional<Date>;
}

export function inicializarModeloRegistroAuditoria(sequelize: Sequelize): void {
  ModeloRegistroAuditoria.init({
    lcr_aud_id_registro_auditoria: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    lcr_aud_id_usuario: { type: DataTypes.UUID, allowNull: true },
    lcr_aud_tipo_evento: { type: DataTypes.STRING(100), allowNull: false },
    lcr_aud_recurso_evento: { type: DataTypes.STRING(120), allowNull: true },
    lcr_aud_id_recurso: { type: DataTypes.UUID, allowNull: true },
    lcr_aud_endereco_ip: { type: DataTypes.INET, allowNull: true },
    lcr_aud_id_correlacao: { type: DataTypes.STRING(120), allowNull: false },
    lcr_aud_detalhes_evento: { type: DataTypes.JSONB, allowNull: true },
    lcr_aud_data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    sequelize,
    tableName: 'lcr_registros_auditoria',
    modelName: 'ModeloRegistroAuditoria',
    timestamps: false,
  });
}
