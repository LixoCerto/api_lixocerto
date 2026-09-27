import { Module } from '@nestjs/common';
import { ModuloEmail } from '../../infraestrutura/email/email.module.js';
import { ModuloAuditoria } from '../auditoria/auditoria.module.js';
import { ModuloUsuarios } from '../usuarios/usuarios.module.js';
import { ControladorGrpcFluxosEmail } from './fluxos_email.controlador.grpc.js';
import { ServicoFluxosEmail } from './fluxos_email.servico.js';
import { RepositorioTokensAutenticacao } from './tokens_autenticacao.repositorio.js';

/**
 * Fluxos de confirmação de e-mail e recuperação de senha.
 *
 * O módulo implementa RPCs adicionais do serviço `ServicoAutenticacao` e é mantido
 * separado de `ModuloAutenticacao` para evitar dependência circular: a auditoria
 * depende do módulo de autenticação, e não o contrário.
 */
@Module({
  imports: [ModuloUsuarios, ModuloAuditoria, ModuloEmail],
  controllers: [ControladorGrpcFluxosEmail],
  providers: [RepositorioTokensAutenticacao, ServicoFluxosEmail],
  exports: [ServicoFluxosEmail],
})
export class ModuloFluxosEmail {}