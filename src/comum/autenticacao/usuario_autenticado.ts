export interface UsuarioAutenticado {
  idExterno: string;
  nome: string;
  email: string;
  papeis: string[];
  permissoes: string[];
}
