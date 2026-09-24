import { Inject, Injectable } from '@nestjs/common';
import { QueryTypes, Sequelize } from 'sequelize';

export interface ResumoAdministrativo {
  quantidadeUsuarios: number;
  quantidadeMateriais: number;
  quantidadePontosPendentes: number;
  quantidadeAvaliacoes: number;
}

@Injectable()
export class ServicoAdministracao {
  constructor(@Inject('CONEXAO_BANCO_DADOS') private readonly banco: Sequelize | null) {}

  async obterResumo(): Promise<ResumoAdministrativo> {
    if (!this.banco) {
      return { quantidadeUsuarios: 0, quantidadeMateriais: 0, quantidadePontosPendentes: 0, quantidadeAvaliacoes: 0 };
    }
    const [usuarios, materiais, pontos, avaliacoes] = await Promise.all([
      this.contar('SELECT COUNT(*)::int AS quantidade FROM lcr_usuarios WHERE lcr_usr_status_usuario = \'ativo\''),
      this.contar('SELECT COUNT(*)::int AS quantidade FROM lcr_materiais WHERE lcr_mat_status_material = \'publicado\''),
      this.contar('SELECT COUNT(*)::int AS quantidade FROM lcr_pontos_coleta WHERE lcr_pco_status_verificacao = \'pendente\''),
      this.contar('SELECT COUNT(*)::int AS quantidade FROM lcr_sessoes_avaliacao WHERE lcr_sea_indica_consentimento = TRUE'),
    ]);
    return {
      quantidadeUsuarios: usuarios,
      quantidadeMateriais: materiais,
      quantidadePontosPendentes: pontos,
      quantidadeAvaliacoes: avaliacoes,
    };
  }

  private async contar(sql: string): Promise<number> {
    const resultado = await this.banco!.query<{ quantidade: number }>(sql, { type: QueryTypes.SELECT });
    return Number(resultado[0]?.quantidade ?? 0);
  }
}
