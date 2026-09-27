import { Module } from '@nestjs/common';
import { ModuloConfiguracao } from './configuracao/configuracao.module.js';
import { ModuloBancoDados } from './infraestrutura/banco/banco.module.js';
import { ModuloCache } from './infraestrutura/cache/cache.module.js';
import { ModuloAutenticacao } from './modulos/autenticacao/autenticacao.module.js';
import { ModuloFluxosEmail } from './modulos/autenticacao/fluxos_email.module.js';
import { ModuloAutorizacao } from './modulos/autorizacao/autorizacao.module.js';
import { ModuloIdentidade } from './modulos/identidade/identidade.module.js';
import { ModuloUsuarios } from './modulos/usuarios/usuarios.module.js';
import { ModuloPapeis } from './modulos/papeis/papeis.module.js';
import { ModuloPermissoes } from './modulos/permissoes/permissoes.module.js';
import { ModuloSessoes } from './modulos/sessoes/sessoes.module.js';
import { ModuloAuditoria } from './modulos/auditoria/auditoria.module.js';
import { ModuloMateriais } from './modulos/materiais/materiais.module.js';
import { ModuloPontosColeta } from './modulos/pontos_coleta/pontos_coleta.module.js';
import { ModuloQuestionarios } from './modulos/questionarios/questionarios.module.js';
import { ModuloGamificacao } from './modulos/gamificacao/gamificacao.module.js';
import { ModuloDesafios } from './modulos/desafios/desafios.module.js';
import { ModuloPerfil } from './modulos/perfil/perfil.module.js';
import { ModuloAvaliacaoUsabilidade } from './modulos/avaliacao_usabilidade/avaliacao_usabilidade.module.js';
import { ModuloAdministracao } from './modulos/administracao/administracao.module.js';
import { ModuloSaude } from './modulos/saude/saude.module.js';

@Module({
  imports: [
    ModuloConfiguracao,
    ModuloBancoDados,
    ModuloCache,
    ModuloAutenticacao,
    ModuloFluxosEmail,
    ModuloAutorizacao,
    ModuloIdentidade,
    ModuloUsuarios,
    ModuloPapeis,
    ModuloPermissoes,
    ModuloSessoes,
    ModuloAuditoria,
    ModuloMateriais,
    ModuloPontosColeta,
    ModuloQuestionarios,
    ModuloGamificacao,
    ModuloDesafios,
    ModuloPerfil,
    ModuloAvaliacaoUsabilidade,
    ModuloAdministracao,
    ModuloSaude,
  ],
})
export class ModuloPrincipal {}
