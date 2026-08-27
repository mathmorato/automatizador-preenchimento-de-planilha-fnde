from pydantic import BaseModel, Field
from typing import Optional, List

class AttendanceRecord(BaseModel):
    cecate_responsavel: str = Field(default="CECATE CO", description="CECATE Responsável (padrão CECATE CO)")
    iniciativa: str = Field(default="Município", description="Iniciativa do contato: 'CECATE' ou 'Município'")
    tecnico: str = Field(..., description="Nome do Técnico do CECATE que prestou o atendimento")
    meio_contato: str = Field(default="Whats App", description="Meio de contato: Whats App, Ligação, E-mail, Vídeo Conferência, Presencial")
    data_atendimento: str = Field(..., description="Data do atendimento no formato DD/MM/AAAA")
    assunto: str = Field(..., description="Assunto principal: SETE, PNATE ou Caminho da Escola")
    resumo_demanda: str = Field(..., description="Resumo sucinto da demanda ou dúvida do município")
    resumo_options: Optional[List[str]] = Field(default=[], description="3 opções alternativas de resumo geradas pela IA")
    uf: str = Field(..., description="Sigla da Unidade Federativa com 2 letras (ex: GO, MT, MS)")
    municipio: str = Field(..., description="Nome do Município atendido")
    capacitacao_participou: str = Field(default="Não", description="Participou de capacitação? 'Sim' ou 'Não'")
    capacitacao_local: Optional[str] = Field(default="", description="Local da capacitação (se participou)")
    capacitacao_data: Optional[str] = Field(default="", description="Data da capacitação (se participou)")
    atendido_nome: Optional[str] = Field(default="", description="Nome da pessoa que foi atendida")
    atendido_telefone: Optional[str] = Field(default="", description="Telefone de contato do atendido")
    atendido_cargo: Optional[str] = Field(default="Gestor", description="Cargo do atendido: Gestor, CACs, etc.")
    municipio_respondeu: str = Field(default="Sim", description="Município respondeu? 'Sim' ou 'Não'")
    situacao: str = Field(default="Resolvida", description="Situação após contato: 'Resolvida' ou 'Pendente'")
    observacoes: Optional[str] = Field(default="", description="Observações e encaminhamentos detalhados")
    observacoes_options: Optional[List[str]] = Field(default=[], description="3 opções alternativas de observações geradas pela IA")

    def to_sheet_row(self) -> List[str]:
        return [
            self.cecate_responsavel,
            self.iniciativa,
            self.tecnico,
            self.meio_contato,
            self.data_atendimento,
            self.assunto,
            self.resumo_demanda,
            self.uf,
            self.municipio,
            self.capacitacao_participou,
            self.capacitacao_local or "",
            self.capacitacao_data or "",
            self.atendido_nome or "",
            self.atendido_telefone or "",
            self.atendido_cargo or "",
            self.municipio_respondeu,
            self.situacao,
            self.observacoes or ""
        ]

class ParseRequestMetadata(BaseModel):
    tecnico_name: str = Field(..., description="Nome do técnico logado ou selecionado")
    custom_instructions: Optional[str] = Field(default="", description="Instruções adicionais para a IA")

class ParseResponse(BaseModel):
    success: bool
    record: Optional[AttendanceRecord] = None
    extracted_names: Optional[List[str]] = Field(default=[], description="Lista de todos os nomes extraídos da conversa")
    extracted_dates: Optional[List[str]] = Field(default=[], description="Lista de todas as datas extraídas da conversa")
    raw_chat_text: Optional[str] = None
    raw_ai_output: Optional[str] = None
    error: Optional[str] = None
